import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { CheckCircle2, Info, Settings, Video } from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  lazy,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";
import {
  clearThumbnailCache,
  deletePhotoGroups,
  listRemovableRoots,
  openPhotoFile,
  openPhotoGroup,
  pathExists,
  scanRoot,
  selectRootFolder,
} from "./api";
import { PhotoGrid } from "./components/PhotoGrid";
import { MANUAL_ROOTS_STORAGE_KEY } from "./features/app/app-config";
import { AboutModal, DeleteModal, SettingsModal } from "./features/app/AppModals";
import {
  activeMemoryKey,
  dirName,
  isPreviewWindowRoute,
  loadStoredManualRoots,
} from "./features/app/app-utils";
import { MainToolbar } from "./features/app/MainToolbar";
import { GalleryControls } from "./features/gallery/GalleryControls";
import { PhotoContextMenu } from "./features/gallery/PhotoContextMenu";
import { InspectorPanel } from "./features/inspector/InspectorPanel";
import { SourcePanel } from "./features/sources/SourcePanel";
import { useSelectionMode } from "./hooks/useSelectionMode";
import { usePreviewWindow } from "./hooks/usePreviewWindow";
import { useMediaLibrary } from "./hooks/useMediaLibrary";
import { useSourceSelection } from "./hooks/useSourceSelection";
import { useAppPreferences } from "./hooks/useAppPreferences";
import { useDeleteWorkflow } from "./hooks/useDeleteWorkflow";
import { useGalleryLayoutTransition } from "./hooks/useGalleryLayoutTransition";
import { useMediaMode } from "./hooks/useMediaMode";
import type {
  DriveCandidate,
  GroupKindFilter,
  MediaKindFilter,
  PhotoGroup,
  ScanProgress,
  ScanSummary,
} from "./types";
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [closingModal, setClosingModal] = useState<"about" | "settings" | "delete" | null>(null);
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
  const [manualRoots, setManualRoots] = useState<string[]>(loadStoredManualRoots);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const deferredQuery = useDeferredValue(query);
  const activeByRootRef = useRef<Record<string, string>>({});
  const knownDrivePathsRef = useRef<Set<string>>(new Set());
  const seenRemovablePathsRef = useRef<Set<string>>(new Set());
  const initialManualRootSelectedRef = useRef(false);
  const refreshTimerRef = useRef<number | undefined>(undefined);
  const refreshDelayTimerRef = useRef<number | undefined>(undefined);
  const refreshLockedRef = useRef(false);

  const clearActiveSource = useCallback((nextMessage?: string) => {
    setRootPath("");
    setActiveId("");
    setScanSummary(null);
    if (nextMessage) setMessage(nextMessage);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(MANUAL_ROOTS_STORAGE_KEY, JSON.stringify(manualRoots));
  }, [manualRoots]);

  const closeModal = useCallback(
    (modal: "about" | "settings" | "delete", setOpen: (open: boolean) => void) => {
      setClosingModal(modal);
      window.setTimeout(() => {
        setOpen(false);
        setClosingModal((current) => (current === modal ? null : current));
      }, 160);
    },
    [],
  );

  const closeAbout = useCallback(() => {
    closeModal("about", setAboutOpen);
  }, [closeModal]);

  const closeSettings = useCallback(() => {
    closeModal("settings", setSettingsOpen);
  }, [closeModal]);

  const closeDelete = useCallback(() => {
    closeModal("delete", setDeleteOpen);
  }, [closeModal]);

  const manualAvailabilityQueries = useQueries({
    queries: manualRoots.map((path) => ({
      queryFn: () => pathExists(path),
      queryKey: ["path-exists", path],
      refetchInterval: 10_000,
    })),
  });

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

  const drivesQuery = useQuery({
    queryFn: listRemovableRoots,
    queryKey: ["removable-roots"],
    refetchInterval: 30_000,
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

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    listen<DriveCandidate[]>("removable-roots-changed", (event) => {
      queryClient.setQueryData(["removable-roots"], event.payload);
      if (rootPath) {
        queryClient.invalidateQueries({ queryKey: ["path-exists", rootPath] });
      }
    }).then((nextUnlisten) => {
      if (cancelled) {
        nextUnlisten();
        return;
      }
      unlisten = nextUnlisten;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [queryClient, rootPath]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    listen<ScanProgress>("scan-progress", (event) => {
      setScanProgress(event.payload);
    }).then((nextUnlisten) => {
      if (cancelled) {
        nextUnlisten();
        return;
      }
      unlisten = nextUnlisten;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const scanMutation = useMutation({
    mutationFn: scanRoot,
    onMutate: (path) => {
      setScanProgress({
        rootPath: path,
        scannedFiles: 0,
        matchedFiles: 0,
        currentDir: path,
        done: false,
      });
      setMessage(t("status.scanning"));
    },
    onSuccess: async (summary) => {
      setRootPath(summary.rootPath);
      setScanSummary(summary);
      clearSelection();
      setActiveId("");
      setQuery("");
      await queryClient.invalidateQueries({ queryKey: ["photo-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["photo-group-count"] });
      await queryClient.invalidateQueries({ queryKey: ["root-scan-state", summary.rootPath] });
      await queryClient.invalidateQueries({ queryKey: ["scan-summary", summary.rootPath] });
      setMessage(t("status.scanCompleted", { groups: summary.groups, files: summary.files }));
    },
    onError: (error) => {
      setScanProgress(null);
      setMessage(String(error));
    },
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

  const scanning = scanMutation.isPending;
  const deleting = deleteMutation.isPending;
  const busy = scanning || deleting;
  const detectedRoots = drivesQuery.data ?? [];
  const {
    activeSourceIsManual,
    activeSourceIsRemovable,
    manualAvailability,
    manualRootSet,
    sourceName,
  } = useSourceSelection({
    detectedRoots,
    manualAvailabilityValues: manualAvailabilityQueries.map((query) => query.data),
    manualRoots,
    rootPath,
  });
  const sourceWasScanned =
    rootScanQuery.data === true || (scanSummary?.rootPath === rootPath && !scanning);
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
  const scanProgressText =
    scanning && scanProgress?.rootPath === rootPath
      ? t("status.scanProgress", {
          scanned: scanProgress.scannedFiles,
          matched: scanProgress.matchedFiles,
          dir: fileName(scanProgress.currentDir) || scanProgress.currentDir,
        })
      : "";
  const statusMessage = scanProgressText || message;
  const emptyState = useMemo(() => {
    if (hasSource && !rootIsAvailable) {
      return {
        title: t("empty.sourceOfflineTitle"),
        description: activeSourceIsManual
          ? t("empty.fixedOfflineDescription")
          : t("empty.removableOfflineDescription"),
      };
    }
    if (scanning && rootPath) {
      return {
        title: t("empty.scanningTitle", { name: sourceName || rootPath }),
        description: scanProgressText || t("empty.scanningDescription"),
      };
    }
    if (hasSource && !sourceWasScanned) {
      return {
        title: t("empty.unscannedTitle"),
        description: activeSourceIsRemovable
          ? t("empty.unscannedRemovableDescription")
          : t("empty.unscannedDescription"),
      };
    }
    if (hasSource && sourceWasScanned) {
      return {
        title: mediaKind === "videos" ? t("empty.noVideos") : t("empty.noGroups"),
        description:
          mediaKind === "videos"
            ? t("empty.noVideosInSource")
            : activeSourceIsRemovable
              ? t("empty.noGroupsInRemovable")
              : t("empty.noGroupsInSource"),
      };
    }
    return {
      title: t("empty.waiting"),
      description: t("empty.waitingDescription"),
    };
  }, [
    activeSourceIsManual,
    activeSourceIsRemovable,
    hasSource,
    mediaKind,
    rootIsAvailable,
    rootPath,
    rootScanQuery.data,
    scanProgressText,
    scanning,
    sourceName,
    sourceWasScanned,
    t,
  ]);
  const modalOpen = aboutOpen || settingsOpen || deleteOpen;
  const { deleteDetailLoading, deleteFiles, deletePlan } = useDeleteWorkflow({
    deleteOpen,
    selectedGroups,
    selectedIds,
  });

  useEffect(() => {
    if (initialManualRootSelectedRef.current || rootPath || !manualRoots.length) return;

    const pending = manualAvailabilityQueries.some((query) => query.isLoading || query.isFetching);
    if (pending) return;

    initialManualRootSelectedRef.current = true;
    const firstAvailableRoot =
      manualRoots.find((path, index) => manualAvailabilityQueries[index]?.data !== false) ?? "";
    if (!firstAvailableRoot) return;

    setRootPath(firstAvailableRoot);
    setMessage(
      t("source.selectedManual", { name: fileName(firstAvailableRoot) || firstAvailableRoot }),
    );
  }, [manualAvailabilityQueries, manualRoots, rootPath, t]);

  const chooseFolder = useCallback(async () => {
    const path = await selectRootFolder();
    if (!path) return;
    setManualRoots((current) => (current.includes(path) ? current : [...current, path]));
    setRootPath(path);
    if (scanMutation.isPending) {
      setMessage(t("source.selectedManual", { name: fileName(path) || path }));
      return;
    }
    setMessage(t("source.folderSelected"));
    scanMutation.mutate(path);
  }, [scanMutation, t]);

  const scan = useCallback(
    (path = rootPath) => {
      if (!path) return;
      scanMutation.mutate(path);
    },
    [rootPath, scanMutation],
  );

  const refreshRemovableRoots = useCallback(() => {
    if (refreshLockedRef.current) return;
    refreshLockedRef.current = true;
    window.clearTimeout(refreshDelayTimerRef.current);
    window.clearTimeout(refreshTimerRef.current);
    refreshDelayTimerRef.current = window.setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["removable-roots"] });
      refreshTimerRef.current = window.setTimeout(() => {
        refreshLockedRef.current = false;
        refreshTimerRef.current = undefined;
      }, 650);
    }, 160);
  }, [queryClient]);

  const selectManualRoot = useCallback(
    (path: string) => {
      setRootPath(path);
      setMessage(t("source.selectedManual", { name: fileName(path) || path }));
      queryClient.invalidateQueries({ queryKey: ["photo-groups", path] });
    },
    [queryClient, t],
  );

  const clearManualRoot = useCallback(
    (path: string) => {
      setManualRoots((current) => current.filter((root) => root !== path));
      if (rootPath === path) {
        clearActiveSource(t("source.folderRemoved"));
        return;
      }
      setMessage(t("source.folderRemoved"));
    },
    [clearActiveSource, rootPath, t],
  );

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

  const deleteContextGroup = useCallback((group: PhotoGroup) => {
    setSelected(new Set([group.id]));
    setSelectionMode(true);
    setClosingModal(null);
    setDeleteOpen(true);
    setContextMenu(null);
  }, []);

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
    return () => window.clearTimeout(refreshTimerRef.current);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(refreshDelayTimerRef.current);
  }, []);

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

  useEffect(() => {
    const candidates = drivesQuery.data;
    if (!candidates) return;

    const currentPaths = new Set(candidates.map((candidate) => candidate.scanPath));
    const removedActiveRemovableRoot =
      rootPath &&
      !manualRootSet.has(rootPath) &&
      seenRemovablePathsRef.current.has(rootPath) &&
      !currentPaths.has(rootPath);

    candidates.forEach((candidate) => seenRemovablePathsRef.current.add(candidate.scanPath));

    if (removedActiveRemovableRoot) {
      clearActiveSource(t("source.removableRemoved"));
    }

    const nextCandidate = candidates.find(
      (candidate) => !knownDrivePathsRef.current.has(candidate.scanPath),
    );

    if (!nextCandidate) {
      knownDrivePathsRef.current = currentPaths;
      return;
    }
    if (busy) return;

    knownDrivePathsRef.current = currentPaths;
    const scanPath = nextCandidate.scanPath;
    setRootPath(scanPath);
    setMessage(t("status.detectedIndexing", { name: nextCandidate.displayName }));
    scanMutation.mutate(scanPath);
  }, [
    busy,
    clearActiveSource,
    drivesQuery.data,
    manualRootSet,
    queryClient,
    rootPath,
    scanMutation,
    t,
  ]);

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
          onDeleteSelected={() => {
            setClosingModal(null);
            setDeleteOpen(true);
          }}
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
            onSelectRemovableRoot={(drive) => {
              setRootPath(drive.scanPath);
              if (scanMutation.isPending) {
                setMessage(t("source.selectedManual", { name: drive.displayName }));
                return;
              }
              setMessage(t("status.detectedIndexing", { name: drive.displayName }));
              scanMutation.mutate(drive.scanPath);
            }}
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
            <button
              className="status-info"
              aria-label={t("common.info")}
              onClick={() => {
                setClosingModal(null);
                setAboutOpen(true);
              }}
            >
              <Info size={15} />
            </button>
            <button
              className="status-info"
              aria-label={t("setting.open")}
              onClick={() => {
                setClosingModal(null);
                setSettingsOpen(true);
              }}
            >
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
