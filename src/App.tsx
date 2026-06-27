import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Info, Settings, Video } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, lazy, useRef, useState, Suspense } from "react";
import { clearThumbnailCache, deletePhotoGroups, openPhotoFile, openPhotoGroup } from "./api";
import { PhotoGrid } from "./components/PhotoGrid";
import { AboutModal, DeleteModal, SettingsModal } from "./features/app/AppModals";
import { activeMemoryKey, dirName, isPreviewWindowRoute } from "./features/app/app-utils";
import { MainToolbar } from "./features/app/MainToolbar";
import { GalleryControls } from "./features/gallery/GalleryControls";
import { PhotoContextMenu } from "./features/gallery/PhotoContextMenu";
import { InspectorPanel } from "./features/inspector/InspectorPanel";
import { SourcePanel } from "./features/sources/SourcePanel";
import { useSelectionMode } from "./hooks/useSelectionMode";
import { usePreviewWindow } from "./hooks/usePreviewWindow";
import { useMediaLibrary } from "./hooks/useMediaLibrary";
import { useAppPreferences } from "./hooks/useAppPreferences";
import { useDeleteWorkflow } from "./hooks/useDeleteWorkflow";
import { useGalleryLayoutTransition } from "./hooks/useGalleryLayoutTransition";
import { useGalleryEmptyState } from "./hooks/useGalleryEmptyState";
import { useMediaMode } from "./hooks/useMediaMode";
import { useModalLifecycle } from "./hooks/useModalLifecycle";
import { useScanWorkflow } from "./hooks/useScanWorkflow";
import { useSourceLifecycle } from "./hooks/useSourceLifecycle";
import type { GroupKindFilter, MediaKindFilter, PhotoGroup, ScanSummary } from "./types";
import { fileName } from "./utils";

const PreviewWindow = lazy(() => import("./PreviewWindow"));

export default function App() {
  if (isPreviewWindowRoute()) {
    return (
      <Suspense fallback={null}>
        <PreviewWindow />
      </Suspense>
    );
  }

  const queryClient = useQueryClient();
  const [rootPath, setRootPath] = useState("");
  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
  const {
    cardSize,
    language,
    message,
    photoSort,
    setLanguage,
    setMessage,
    setPhotoSort,
    setTheme,
    t,
    theme,
    updateCardSize,
  } = useAppPreferences();
  const {
    aboutOpen,
    closeAbout,
    closeDelete,
    closeSettings,
    closingModal,
    deleteOpen,
    modalOpen,
    openAbout,
    openDelete,
    openSettings,
    settingsOpen,
  } = useModalLifecycle();
  const [inspectorTab, setInspectorTab] = useState<"info" | "metadata">("info");
  const { galleryLayoutTransitioning, inspectorCollapsed, toggleInspector } =
    useGalleryLayoutTransition();
  const {
    groupKind,
    mediaKind,
    mediaTransitioning,
    setGroupKind,
    switchMediaKind: transitionMediaKind,
  } = useMediaMode();
  const [contextMenu, setContextMenu] = useState<{
    group: PhotoGroup;
    x: number;
    y: number;
  } | null>(null);
  const deferredQuery = useDeferredValue(query);
  const activeByRootRef = useRef<Record<string, string>>({});

  const clearActiveSource = useCallback((nextMessage?: string) => {
    setRootPath("");
    setActiveId("");
    setScanSummary(null);
    if (nextMessage) setMessage(nextMessage);
  }, []);

  const {
    currentSummary,
    detailQuery,
    groupsQuery,
    hasSource,
    metadataQuery,
    rootIsAvailable,
    rootScanQuery,
    thumbnailCacheQuery,
    visibleGroupCount,
    visibleGroups,
    visibleHasMoreGroups,
  } = useMediaLibrary({
    activeId,
    deferredQuery,
    groupKind,
    mediaKind,
    photoSort,
    rootPath,
    scanSummary,
  });

  const clearThumbnailCacheMutation = useMutation({
    mutationFn: clearThumbnailCache,
    onSuccess: (stats) => {
      queryClient.setQueryData(["thumbnail-cache-stats"], stats);
      queryClient.removeQueries({ queryKey: ["photo-thumbnail"] });
      setMessage(t("status.thumbnailCacheCleared"));
    },
    onError: (error) => setMessage(String(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePhotoGroups,
    onSuccess: async (summary) => {
      closeDelete();
      clearSelection();
      setActiveId("");
      await queryClient.invalidateQueries({ queryKey: ["photo-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["photo-group-count"] });
      await queryClient.invalidateQueries({ queryKey: ["scan-summary", rootPath] });
      await queryClient.invalidateQueries({ queryKey: ["photo-group-detail"] });
      setMessage(
        t("status.deleted", {
          count: summary.files - summary.failed.length,
          failed: summary.failed.length
            ? t("status.deletedFailed", { count: summary.failed.length })
            : "",
        }),
      );
    },
    onError: (error) => setMessage(String(error)),
  });

  const deleting = deleteMutation.isPending;
  const rememberActiveGroup = useCallback(
    (id: string, sourcePath = rootPath) => {
      setActiveId(id);
      if (!sourcePath) return;
      activeByRootRef.current = {
        ...activeByRootRef.current,
        [activeMemoryKey(sourcePath, mediaKind)]: id,
      };
    },
    [mediaKind, rootPath],
  );
  const {
    activateOrSelect,
    clearSelection,
    selected,
    selectedGroups,
    selectedIds,
    selectionMode,
    selectionModeRef,
    selectAllVisibleGroups,
    setSelected,
    setSelectionMode,
    toggleSelected,
    toggleSelectionMode,
  } = useSelectionMode({
    hasSource,
    onActivate: rememberActiveGroup,
    visibleGroups,
  });
  const { scan, scanMutation, scanProgressText, scanning } = useScanWorkflow({
    clearSelection,
    queryClient,
    rootPath,
    setActiveId,
    setMessage,
    setQuery,
    setRootPath,
    setScanSummary,
    t,
  });
  const busy = scanning || deleting;
  const {
    activeSourceIsManual,
    activeSourceIsRemovable,
    chooseFolder,
    clearManualRoot,
    detectedRoots,
    manualAvailability,
    manualRootSet,
    manualRoots,
    refreshRemovableRoots,
    selectManualRoot,
    selectRemovableRoot,
    sourceName,
  } = useSourceLifecycle({
    busy,
    clearActiveSource,
    queryClient,
    rootPath,
    scanPending: scanMutation.isPending,
    scanRootPath: scanMutation.mutate,
    setMessage,
    setRootPath,
    t,
  });
  const sourceWasScanned =
    rootScanQuery.data === true || (scanSummary?.rootPath === rootPath && !scanning);
  const statusMessage = scanProgressText || message;
  const emptyState = useGalleryEmptyState({
    activeSourceIsManual,
    activeSourceIsRemovable,
    hasSource,
    mediaKind,
    rootIsAvailable,
    rootPath,
    scanProgressText,
    scanning,
    sourceName,
    sourceWasScanned,
    t,
  });
  const { deleteDetailLoading, deleteFiles, deletePlan } = useDeleteWorkflow({
    deleteOpen,
    selectedGroups,
    selectedIds,
  });

  const applyKindFilter = useCallback(
    (nextKind: GroupKindFilter) => {
      setGroupKind(nextKind);
      clearSelection();
      setActiveId("");
    },
    [clearSelection],
  );

  const switchMediaKind = useCallback(
    (nextKind: MediaKindFilter) => {
      transitionMediaKind(nextKind, () => {
        clearSelection();
        setActiveId("");
        setInspectorTab("info");
      });
    },
    [clearSelection, transitionMediaKind],
  );

  const openPhotoContextMenu = useCallback((group: PhotoGroup, x: number, y: number) => {
    setContextMenu({ group, x, y });
  }, []);

  const closePhotoContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const deleteContextGroup = useCallback(
    (group: PhotoGroup) => {
      setSelected(new Set([group.id]));
      setSelectionMode(true);
      openDelete();
      setContextMenu(null);
    },
    [openDelete, setSelected, setSelectionMode],
  );

  const confirmDelete = useCallback(() => {
    if (!selected.size) return;
    deleteMutation.mutate([...selected]);
  }, [deleteMutation, selected]);

  const openPreview = usePreviewWindow({
    onActivate: rememberActiveGroup,
    onError: setMessage,
    queryClient,
    selectionModeRef,
    setContextMenuClosed: closePhotoContextMenu,
    theme,
    visibleGroups,
  });

  const openGroup = useCallback(
    async (id: string, force = false) => {
      if (selectionModeRef.current && !force) return;
      setContextMenu(null);
      rememberActiveGroup(id);
      setMessage(t("status.opening"));
      try {
        const path = await openPhotoGroup(id);
        setMessage(t("status.opened", { name: fileName(path) }));
      } catch (error) {
        setMessage(String(error));
      }
    },
    [rememberActiveGroup, t],
  );

  const openFile = useCallback(
    async (path: string) => {
      setMessage(t("status.opening"));
      try {
        const openedPath = await openPhotoFile(path);
        setMessage(t("status.opened", { name: fileName(openedPath) }));
      } catch (error) {
        setMessage(String(error));
      }
    },
    [t],
  );

  const loadMoreGroups = useCallback(() => {
    if (groupsQuery.hasNextPage && !groupsQuery.isFetchingNextPage) {
      groupsQuery.fetchNextPage();
    }
  }, [groupsQuery.fetchNextPage, groupsQuery.hasNextPage, groupsQuery.isFetchingNextPage]);

  useEffect(() => {
    clearSelection();
    setActiveId(
      rootPath ? (activeByRootRef.current[activeMemoryKey(rootPath, mediaKind)] ?? "") : "",
    );
    setInspectorTab("info");
  }, [clearSelection, mediaKind, rootPath]);

  useEffect(() => {
    if (!visibleGroups.length) {
      if (activeId) setActiveId("");
      return;
    }

    if (activeId && visibleGroups.some((group) => group.id === activeId)) return;

    const rememberedId = rootPath
      ? activeByRootRef.current[activeMemoryKey(rootPath, mediaKind)]
      : "";
    const nextId =
      rememberedId && visibleGroups.some((group) => group.id === rememberedId)
        ? rememberedId
        : visibleGroups[0].id;
    rememberActiveGroup(nextId, rootPath);
  }, [activeId, mediaKind, rememberActiveGroup, rootPath, visibleGroups]);

  useEffect(() => {
    if (hasSource) return;
    clearActiveSource();
  }, [clearActiveSource, hasSource]);

  useEffect(() => {
    setInspectorTab("info");
  }, [activeId]);

  return (
    <div className={`app-shell ${selectionMode ? "selection-mode" : ""}`}>
      <div className="app-content" aria-hidden={modalOpen ? true : undefined}>
        <MainToolbar
          deleting={deleting}
          hasSource={hasSource}
          inspectorCollapsed={inspectorCollapsed}
          mediaKind={mediaKind}
          query={query}
          rootIsAvailable={rootIsAvailable}
          scanning={scanning}
          selectedCount={selected.size}
          selectionMode={selectionMode}
          t={t}
          visibleGroupCount={visibleGroups.length}
          onChooseFolder={chooseFolder}
          onDeleteSelected={openDelete}
          onQueryChange={(value) => {
            setQuery(value);
            setActiveId("");
            clearSelection();
          }}
          onRescan={() => scan()}
          onSelectAll={selectAllVisibleGroups}
          onSwitchMediaKind={switchMediaKind}
          onToggleInspector={toggleInspector}
          onToggleSelectionMode={toggleSelectionMode}
        />

        <main
          className={`workspace ${inspectorCollapsed ? "inspector-collapsed" : ""} ${
            galleryLayoutTransitioning ? "gallery-layout-transitioning" : ""
          }`}
        >
          <SourcePanel
            currentSummary={currentSummary}
            deleting={deleting}
            detectedRoots={detectedRoots}
            groupKind={groupKind}
            hasSource={hasSource}
            manualAvailability={manualAvailability}
            manualRootSet={manualRootSet}
            manualRoots={manualRoots}
            mediaKind={mediaKind}
            mediaTransitioning={mediaTransitioning}
            rootPath={rootPath}
            scanPending={scanMutation.isPending}
            t={t}
            visibleGroupCount={visibleGroups.length}
            onAddFolder={chooseFolder}
            onApplyKindFilter={applyKindFilter}
            onClearManualRoot={clearManualRoot}
            onRefreshRemovableRoots={refreshRemovableRoots}
            onSelectCurrentSource={() =>
              queryClient.invalidateQueries({ queryKey: ["photo-groups"] })
            }
            onSelectManualRoot={selectManualRoot}
            onSelectRemovableRoot={selectRemovableRoot}
          />

          <PhotoGrid
            activeId={activeId}
            emptyActionLabel={t("action.chooseFolder")}
            emptyDescription={emptyState.description}
            emptyIcon={mediaKind === "videos" ? <Video size={38} /> : undefined}
            emptyTitle={emptyState.title}
            galleryTitle={mediaKind === "videos" ? t("media.videos") : t("gallery.allItems")}
            groups={visibleGroups}
            hasMore={visibleHasMoreGroups}
            headerControls={
              <GalleryControls
                cardSize={cardSize}
                hasSource={hasSource}
                photoSort={photoSort}
                t={t}
                onCardSizeChange={updateCardSize}
                onSortChange={(value) => {
                  setPhotoSort(value);
                  setActiveId("");
                  clearSelection();
                }}
              />
            }
            isFetchingMore={groupsQuery.isFetchingNextPage}
            isMediaTransitioning={mediaTransitioning}
            loadingMoreLabel={t("gallery.loadingMore")}
            minCardWidth={cardSize}
            noPreviewLabel={
              mediaKind === "videos" ? t("empty.noVideoPreview") : t("empty.noPreview")
            }
            onActivate={activateOrSelect}
            onContextMenu={openPhotoContextMenu}
            onEmptyAction={chooseFolder}
            onLoadMore={loadMoreGroups}
            onOpen={mediaKind === "videos" ? openGroup : openPreview}
            onToggle={toggleSelected}
            photoGroupsLabel={t("gallery.photoGroups", { count: visibleGroupCount })}
            scrollToContinueLabel={t("gallery.scrollToContinue")}
            selected={selected}
            totalGroups={visibleGroupCount}
          />

          {!inspectorCollapsed && (
            <InspectorPanel
              activeId={activeId}
              detail={detailQuery.data}
              detailFetching={detailQuery.isFetching}
              inspectorTab={inspectorTab}
              mediaKind={mediaKind}
              mediaTransitioning={mediaTransitioning}
              metadata={metadataQuery.data}
              metadataFetching={metadataQuery.isFetching}
              onOpenFile={openFile}
              onTabChange={setInspectorTab}
              t={t}
            />
          )}
        </main>

        <footer className="statusbar">
          <div className="status-message">
            <CheckCircle2 size={16} />
            <span>{statusMessage}</span>
          </div>
          <div className="status-actions">
            <button className="status-info" aria-label={t("common.info")} onClick={openAbout}>
              <Info size={15} />
            </button>
            <button className="status-info" aria-label={t("setting.open")} onClick={openSettings}>
              <Settings size={15} />
            </button>
          </div>
        </footer>
      </div>

      {contextMenu && (
        <PhotoContextMenu
          deleteDisabled={deleting}
          group={contextMenu.group}
          onClose={closePhotoContextMenu}
          onDelete={() => deleteContextGroup(contextMenu.group)}
          onOpen={() =>
            mediaKind === "videos"
              ? openGroup(contextMenu.group.id, true)
              : openPreview(contextMenu.group.id, true)
          }
          onOpenExternal={() => openGroup(contextMenu.group.id, true)}
          t={t}
          x={contextMenu.x}
          y={contextMenu.y}
        />
      )}

      {aboutOpen && <AboutModal closing={closingModal === "about"} onClose={closeAbout} t={t} />}

      {settingsOpen && (
        <SettingsModal
          cacheStats={thumbnailCacheQuery.data}
          clearingCache={clearThumbnailCacheMutation.isPending}
          closing={closingModal === "settings"}
          language={language}
          onClearCache={() => clearThumbnailCacheMutation.mutate()}
          onClose={closeSettings}
          onLanguageChange={setLanguage}
          onThemeChange={setTheme}
          t={t}
          theme={theme}
        />
      )}

      {deleteOpen && (
        <DeleteModal
          deleting={deleting}
          detailLoading={deleteDetailLoading}
          files={deleteFiles}
          closing={closingModal === "delete"}
          onClose={closeDelete}
          onConfirm={confirmDelete}
          onOpenContainingFolder={() => {
            const firstFile = deleteFiles[0];
            if (firstFile) openFile(dirName(firstFile.path));
          }}
          plan={deletePlan}
          t={t}
        />
      )}
    </div>
  );
}
