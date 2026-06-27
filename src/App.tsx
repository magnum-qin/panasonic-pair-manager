import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Info, Settings, Video } from "lucide-react";
import { useCallback, useDeferredValue, lazy, useRef, useState, Suspense } from "react";
import { clearThumbnailCache, deletePhotoGroups } from "./api";
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
import { useGalleryStateCoordinator } from "./hooks/useGalleryStateCoordinator";
import { useGalleryLayoutTransition } from "./hooks/useGalleryLayoutTransition";
import { useGalleryEmptyState } from "./hooks/useGalleryEmptyState";
import { useMediaMode } from "./hooks/useMediaMode";
import { useModalLifecycle } from "./hooks/useModalLifecycle";
import { usePhotoActions } from "./hooks/usePhotoActions";
import { useScanWorkflow } from "./hooks/useScanWorkflow";
import { useSourceLifecycle } from "./hooks/useSourceLifecycle";
import type { ScanSummary } from "./types";

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

  const confirmDelete = useCallback(() => {
    if (!selected.size) return;
    deleteMutation.mutate([...selected]);
  }, [deleteMutation, selected]);

  const {
    closePhotoContextMenu,
    contextMenu,
    deleteContextGroup,
    openFile,
    openGroup,
    openPhotoContextMenu,
  } = usePhotoActions({
    onOpenDelete: openDelete,
    rememberActiveGroup,
    selectionModeRef,
    setMessage,
    setSelected,
    setSelectionMode,
    t,
  });

  const openPreview = usePreviewWindow({
    onActivate: rememberActiveGroup,
    onError: setMessage,
    queryClient,
    selectionModeRef,
    setContextMenuClosed: closePhotoContextMenu,
    theme,
    visibleGroups,
  });

  const { applyKindFilter, loadMoreGroups, switchMediaKind } = useGalleryStateCoordinator({
    activeByRootRef,
    activeId,
    clearActiveSource,
    clearSelection,
    fetchNextGroups: groupsQuery.fetchNextPage,
    groupsHasNextPage: Boolean(groupsQuery.hasNextPage),
    groupsIsFetchingNextPage: groupsQuery.isFetchingNextPage,
    hasSource,
    mediaKind,
    rememberActiveGroup,
    rootPath,
    setActiveId,
    setGroupKind,
    setInspectorTab,
    transitionMediaKind,
    visibleGroups,
  });

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
