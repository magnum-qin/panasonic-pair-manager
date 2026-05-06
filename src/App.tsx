import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import {
  CheckCircle2,
  FileText,
  FolderPlus,
  Image,
  Images,
  Info,
  Layers,
  Link2,
  RefreshCw,
  Search,
  Settings,
  SquareCheckBig,
  Trash2,
} from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  deletePhotoGroups,
  getPhotoGroup,
  getPhotoGroupMetadata,
  listPhotoGroups,
  listRemovableRoots,
  openPhotoFile,
  openPhotoGroup,
  pathExists,
  scanRoot,
  selectRootFolder,
} from "./api";
import { Button } from "./components/Button";
import { IconButton } from "./components/IconButton";
import { PhotoGrid } from "./components/PhotoGrid";
import { SidebarItem } from "./components/SidebarItem";
import { SummaryButton, SummaryRow } from "./components/Summary";
import { ToolbarButton } from "./components/ToolbarButton";
import {
  LANGUAGE_OPTIONS,
  normalizeLanguage,
  translate,
  type LanguageCode,
  type TranslationKey,
} from "./i18n";
import { THEME_OPTIONS, normalizeTheme, type ThemeCode } from "./theme-options";
import type { GroupKindFilter, PhotoGroupFilter, ScanSummary } from "./types";
import { fileName, formatBytes, PAGE_SIZE } from "./utils";

const CARD_SIZE_PRESETS = [
  { label: "S", value: 190 },
  { label: "M", value: 230 },
  { label: "L", value: 280 },
  { label: "XL", value: 330 },
] as const;

type CardSizePreset = (typeof CARD_SIZE_PRESETS)[number]["value"];

function nearestCardSizePreset(value: number): CardSizePreset {
  return CARD_SIZE_PRESETS.reduce((nearest, preset) =>
    Math.abs(preset.value - value) < Math.abs(nearest.value - value) ? preset : nearest,
  ).value;
}

function makeTranslator(language: LanguageCode) {
  return (key: TranslationKey, values?: Record<string, string | number>) =>
    translate(language, key, values);
}

function getGroupsFilter(
  rootPath: string,
  query: string,
  groupKind: GroupKindFilter,
  offset: number,
): PhotoGroupFilter {
  return {
    rootPath: rootPath || undefined,
    query: query || undefined,
    groupKind: groupKind === "all" ? undefined : groupKind,
    limit: PAGE_SIZE + 1,
    offset,
  };
}

export default function App() {
  const queryClient = useQueryClient();
  const [rootPath, setRootPath] = useState("");
  const [activeId, setActiveId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [groupKind, setGroupKind] = useState<GroupKindFilter>("all");
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
  const [language, setLanguage] = useState<LanguageCode>(() =>
    normalizeLanguage(window.localStorage.getItem("ppm.language")),
  );
  const [theme, setTheme] = useState<ThemeCode>(() =>
    normalizeTheme(window.localStorage.getItem("ppm.theme")),
  );
  const t = useMemo(() => makeTranslator(language), [language]);
  const [message, setMessage] = useState(() => translate(language, "status.ready"));
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"info" | "metadata">("info");
  const [cardSize, setCardSize] = useState(() => {
    const stored = Number(window.localStorage.getItem("ppm.cardSize"));
    return Number.isFinite(stored) ? nearestCardSizePreset(stored) : 230;
  });
  const deferredQuery = useDeferredValue(query);
  const selectionModeRef = useRef(selectionMode);
  const knownDrivePathsRef = useRef<Set<string>>(new Set());
  const autoScannedPathsRef = useRef<Set<string>>(new Set());
  const refreshTimerRef = useRef<number | undefined>(undefined);
  const refreshDelayTimerRef = useRef<number | undefined>(undefined);
  const refreshLockedRef = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("ppm.theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("ppm.language", language);
  }, [language]);

  const rootAvailableQuery = useQuery({
    enabled: Boolean(rootPath),
    queryFn: () => pathExists(rootPath),
    queryKey: ["path-exists", rootPath],
    refetchInterval: 5_000,
  });

  const groupsQuery = useInfiniteQuery({
    queryKey: ["photo-groups", rootPath, deferredQuery, groupKind],
    queryFn: ({ pageParam }) =>
      listPhotoGroups(getGroupsFilter(rootPath, deferredQuery, groupKind, pageParam)),
    enabled: Boolean(rootPath) && rootAvailableQuery.data !== false,
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.length <= PAGE_SIZE) return undefined;
      return pages.reduce((sum, page) => sum + Math.min(page.length, PAGE_SIZE), 0);
    },
    placeholderData: keepPreviousData,
  });

  const groups = useMemo(
    () => groupsQuery.data?.pages.flatMap((page) => page.slice(0, PAGE_SIZE)) ?? [],
    [groupsQuery.data],
  );
  const hasMoreGroups = groupsQuery.hasNextPage;

  const detailQuery = useQuery({
    enabled: Boolean(activeId),
    queryFn: () => getPhotoGroup(activeId),
    queryKey: ["photo-group-detail", activeId],
  });

  const metadataQuery = useQuery({
    enabled: Boolean(activeId),
    queryFn: () => getPhotoGroupMetadata(activeId),
    queryKey: ["photo-group-metadata", activeId],
  });

  const drivesQuery = useQuery({
    queryFn: listRemovableRoots,
    queryKey: ["removable-roots"],
    refetchInterval: 30_000,
  });

  const scanMutation = useMutation({
    mutationFn: scanRoot,
    onMutate: () => {
      setMessage(t("status.scanning"));
    },
    onSuccess: async (summary) => {
      setRootPath(summary.rootPath);
      setScanSummary(summary);
      setSelected(new Set());
      setActiveId("");
      setQuery("");
      await queryClient.invalidateQueries({ queryKey: ["photo-groups"] });
      setMessage(t("status.scanCompleted", { groups: summary.groups, files: summary.files }));
    },
    onError: (error) => setMessage(String(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePhotoGroups,
    onSuccess: async (summary) => {
      setDeleteOpen(false);
      setSelected(new Set());
      setActiveId("");
      await queryClient.invalidateQueries({ queryKey: ["photo-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["photo-group-detail"] });
      setMessage(
        t("status.deleted", {
          count: summary.files - summary.failed.length,
          failed: summary.failed.length ? t("status.deletedFailed", { count: summary.failed.length }) : "",
        }),
      );
    },
    onError: (error) => setMessage(String(error)),
  });

  const busy = scanMutation.isPending || deleteMutation.isPending;
  const detectedRoots = drivesQuery.data ?? [];
  const rootIsAvailable = !rootPath || rootAvailableQuery.data !== false;
  const hasSource = Boolean(rootPath) && rootIsAvailable;
  const visibleGroups = hasSource ? groups : [];
  const visibleHasMoreGroups = hasSource ? hasMoreGroups : false;
  const selectedGroups = useMemo(
    () => visibleGroups.filter((group) => selected.has(group.id)),
    [selected, visibleGroups],
  );

  const deletePlan = useMemo(() => {
    return selectedGroups.reduce(
      (acc, group) => {
        acc.groups += 1;
        acc.rawFiles += group.rawCount;
        acc.jpgFiles += group.jpgCount;
        acc.files += group.rawCount + group.jpgCount + group.sidecarCount;
        acc.totalSize += group.totalSize;
        return acc;
      },
      { groups: 0, files: 0, rawFiles: 0, jpgFiles: 0, totalSize: 0 },
    );
  }, [selectedGroups]);

  const chooseFolder = useCallback(async () => {
    const path = await selectRootFolder();
    if (!path) return;
    setRootPath(path);
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

  const clearManualRoot = useCallback(() => {
    setRootPath("");
    setActiveId("");
    setSelected(new Set());
    setScanSummary(null);
    setMessage(t("source.folderRemoved"));
  }, [t]);

  const toggleSelected = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const activateOrSelect = useCallback(
    (id: string) => {
      if (selectionModeRef.current) {
        toggleSelected(id);
      } else {
        setActiveId(id);
      }
    },
    [toggleSelected],
  );

  const applyKindFilter = useCallback((nextKind: GroupKindFilter) => {
    setGroupKind(nextKind);
    setSelected(new Set());
    setActiveId("");
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((current) => {
      if (current) setSelected(new Set());
      return !current;
    });
  }, []);

  const confirmDelete = useCallback(() => {
    if (!selected.size) return;
    deleteMutation.mutate([...selected]);
  }, [deleteMutation, selected]);

  const openGroup = useCallback(
    async (id: string) => {
      if (selectionModeRef.current) return;
      setActiveId(id);
      setMessage(t("status.opening"));
      try {
        const path = await openPhotoGroup(id);
        setMessage(t("status.opened", { name: fileName(path) }));
      } catch (error) {
        setMessage(String(error));
      }
    },
    [t],
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

  const updateCardSize = useCallback((value: CardSizePreset) => {
    const nextSize = nearestCardSizePreset(value);
    setCardSize(nextSize);
    window.localStorage.setItem("ppm.cardSize", String(nextSize));
  }, []);

  const loadMoreGroups = useCallback(() => {
    if (groupsQuery.hasNextPage && !groupsQuery.isFetchingNextPage) {
      groupsQuery.fetchNextPage();
    }
  }, [groupsQuery.fetchNextPage, groupsQuery.hasNextPage, groupsQuery.isFetchingNextPage]);

  useEffect(() => {
    selectionModeRef.current = selectionMode;
  }, [selectionMode]);

  useEffect(() => {
    return () => window.clearTimeout(refreshTimerRef.current);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(refreshDelayTimerRef.current);
  }, []);

  useEffect(() => {
    if (!visibleGroups.length || activeId) return;
    setActiveId(visibleGroups[0].id);
  }, [activeId, visibleGroups]);

  useEffect(() => {
    if (hasSource) return;
    setActiveId("");
    setSelected(new Set());
    setScanSummary(null);
  }, [hasSource]);

  useEffect(() => {
    if (rootAvailableQuery.data !== false) return;
    setActiveId("");
    setSelected(new Set());
    setScanSummary(null);
    setMessage(t("source.offline"));
  }, [rootAvailableQuery.data, t]);

  useEffect(() => {
    setInspectorTab("info");
  }, [activeId]);

  useEffect(() => {
    const candidates = drivesQuery.data;
    if (!candidates) return;

    const currentPaths = new Set(candidates.map((candidate) => candidate.scanPath));
    const nextCandidate = candidates.find(
      (candidate) => !knownDrivePathsRef.current.has(candidate.scanPath),
    );
    knownDrivePathsRef.current = currentPaths;

    if (!nextCandidate || busy) return;

    const scanPath = nextCandidate.scanPath;
    setRootPath(scanPath);
    if (autoScannedPathsRef.current.has(scanPath)) {
      queryClient.invalidateQueries({ queryKey: ["photo-groups", scanPath] });
      setMessage(t("status.detectedCached", { name: nextCandidate.displayName }));
      return;
    }

    autoScannedPathsRef.current.add(scanPath);
    setMessage(t("status.detectedIndexing", { name: nextCandidate.displayName }));
    scanMutation.mutate(scanPath);
  }, [busy, drivesQuery.data, queryClient, scanMutation, t]);

  return (
    <div className={`app-shell ${selectionMode ? "selection-mode" : ""}`}>
      <div className="toolbar">
        <ToolbarButton disabled={busy || !hasSource} onClick={() => scan()}>
          <RefreshCw size={17} /> {t("action.rescan")}
        </ToolbarButton>
        <ToolbarButton
          active={selectionMode}
          disabled={busy || !hasSource || !visibleGroups.length}
          onClick={toggleSelectionMode}
        >
          <SquareCheckBig size={17} /> {t("action.multiSelect")}
        </ToolbarButton>
        <ToolbarButton
          disabled={busy || !selectionMode || !selected.size}
          hidden={!selectionMode}
          onClick={() => setDeleteOpen(true)}
          variant="danger"
        >
          <Trash2 size={17} /> {t("action.deleteSelected")}
        </ToolbarButton>
        <div className="toolbar-spacer" />
        <div className="size-control" aria-label={t("size.card")} title={t("size.card")}>
          <span>{t("size.card")}</span>
          <div className="size-options" role="group" aria-label={t("size.presets")}>
            {CARD_SIZE_PRESETS.map((preset) => (
              <button
                aria-pressed={cardSize === preset.value}
                className={cardSize === preset.value ? "active" : ""}
                key={preset.value}
                onClick={() => updateCardSize(preset.value)}
                type="button"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <label className="searchbox">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveId("");
              setSelected(new Set());
            }}
            placeholder={t("search.placeholder")}
            disabled={!hasSource}
          />
        </label>
        {selectionMode && (
          <div className="selection-meter">{t("common.selected", { count: selected.size })}</div>
        )}
      </div>

      <main className="workspace">
        <aside className="sidebar">
          <section>
            <div className="section-heading">
              <span>{t("source.autoDetect")}</span>
              <div className="heading-actions">
                <IconButton disabled={busy} label={t("source.addFolder")} onClick={chooseFolder}>
                  <FolderPlus size={15} />
                </IconButton>
                <IconButton
                  disabled={false}
                  label={t("source.refresh")}
                  onClick={refreshRemovableRoots}
                >
                  <RefreshCw size={14} />
                </IconButton>
              </div>
            </div>
            <div className="detected-drives">
              {detectedRoots.length || rootPath ? (
                <>
                  {detectedRoots.map((drive) => (
                    <SidebarItem
                      active={rootPath === drive.scanPath}
                      disabled={busy}
                      key={drive.scanPath}
                      label={drive.displayName}
                      onClick={() => {
                        setRootPath(drive.scanPath);
                        setMessage(t("source.selectedManual", { name: drive.displayName }));
                      }}
                      subtitle={drive.scanPath}
                    />
                  ))}
                  {!detectedRoots.some((drive) => drive.scanPath === rootPath) && rootPath ? (
                    <SidebarItem
                      active
                      disabled={busy}
                      label={fileName(rootPath) || rootPath}
                      onClear={clearManualRoot}
                      onClick={() => queryClient.invalidateQueries({ queryKey: ["photo-groups"] })}
                      removeLabel={t("source.removeFolder")}
                      subtitle={rootPath}
                    />
                  ) : null}
                </>
              ) : (
                <div className="empty-note">{t("source.empty")}</div>
              )}
            </div>
          </section>

          <section className="scan-summary">
            <div className="section-heading">
              <span>{t("summary.scan")}</span>
            </div>
            <SummaryButton
              active={groupKind === "all"}
              icon={<Layers size={15} />}
              label={t("common.groups")}
              onClick={() => applyKindFilter("all")}
              value={hasSource ? (scanSummary?.groups ?? visibleGroups.length) : 0}
            />
            <SummaryButton
              active={groupKind === "paired"}
              icon={<Link2 size={15} />}
              label={t("filter.paired")}
              onClick={() => applyKindFilter("paired")}
              value={hasSource ? (scanSummary?.pairedGroups ?? 0) : 0}
            />
            <SummaryButton
              active={groupKind === "rawOnly"}
              icon={<FileText size={15} />}
              label={t("filter.rawOnly")}
              onClick={() => applyKindFilter("rawOnly")}
              value={hasSource ? (scanSummary?.rawOnlyGroups ?? 0) : 0}
            />
            <SummaryButton
              active={groupKind === "jpgOnly"}
              icon={<Image size={15} />}
              label={t("filter.jpgOnly")}
              onClick={() => applyKindFilter("jpgOnly")}
              value={hasSource ? (scanSummary?.jpgOnlyGroups ?? 0) : 0}
            />
          </section>
        </aside>

        <PhotoGrid
          activeId={activeId}
          emptyActionLabel={t("action.chooseFolder")}
          emptyDescription={
            hasSource
              ? t("empty.noGroupsInSource")
              : t("empty.waitingDescription")
          }
          emptyTitle={hasSource ? t("empty.noGroups") : t("empty.waiting")}
          galleryTitle={t("gallery.allItems")}
          groups={visibleGroups}
          hasMore={visibleHasMoreGroups}
          isFetchingMore={groupsQuery.isFetchingNextPage}
          loadingMoreLabel={t("gallery.loadingMore")}
          minCardWidth={cardSize}
          noPreviewLabel={t("empty.noPreview")}
          onActivate={activateOrSelect}
          onEmptyAction={chooseFolder}
          onLoadMore={loadMoreGroups}
          onOpen={openGroup}
          onToggle={toggleSelected}
          photoGroupsLabel={t("gallery.photoGroups", { count: visibleGroups.length })}
          scrollToContinueLabel={t("gallery.scrollToContinue")}
          selected={selected}
        />

        <aside className="inspector">
          <div className="tabs">
            <button
              className={inspectorTab === "info" ? "active" : ""}
              onClick={() => setInspectorTab("info")}
            >
              {t("common.info")}
            </button>
            <button
              className={inspectorTab === "metadata" ? "active" : ""}
              onClick={() => setInspectorTab("metadata")}
              disabled={!activeId}
            >
              {t("common.metadata")}
            </button>
          </div>
          {detailQuery.isFetching && !detailQuery.data ? (
            <InspectorSkeleton />
          ) : detailQuery.data && inspectorTab === "info" ? (
            <>
              <section>
                <div className="section-heading">
                  <span>{t("common.files")}</span>
                  <span>{t("common.selected", { count: detailQuery.data.files.length })}</span>
                </div>
                <div className="file-list">
                  {detailQuery.data.files.map((file) => (
                    <button
                      className="file-row"
                      key={file.id}
                      onClick={() => openFile(file.path)}
                      title={file.path}
                    >
                      <strong>{file.fileName}</strong>
                      <span>{file.kind.toUpperCase()}</span>
                      <em>{formatBytes(file.size)}</em>
                    </button>
                  ))}
                </div>
              </section>
              <section className="kv">
                <SummaryRow
                  label={t("common.captureTime")}
                  value={
                    metadataQuery.data?.captureTime ??
                    detailQuery.data.captureTime ??
                    (metadataQuery.isFetching ? t("metadata.reading") : t("metadata.unknown"))
                  }
                />
                <SummaryRow
                  label={t("common.camera")}
                  value={
                    metadataQuery.data?.cameraModel ??
                    detailQuery.data.cameraModel ??
                    (metadataQuery.isFetching ? t("metadata.reading") : t("metadata.unknown"))
                  }
                />
                <SummaryRow
                  label={t("common.lens")}
                  value={
                    metadataQuery.data?.lens ??
                    detailQuery.data.lens ??
                    (metadataQuery.isFetching ? t("metadata.reading") : t("metadata.unknown"))
                  }
                />
                <SummaryRow label={t("common.folder")} value={detailQuery.data.folderName} />
                <SummaryRow label={t("common.totalSize")} value={formatBytes(detailQuery.data.totalSize)} />
              </section>
              <section>
                <div className="section-heading">
                  <span>{t("common.path")}</span>
                </div>
                <div className="paths">
                  {detailQuery.data.files.map((file) => (
                    <p key={file.id}>{file.path}</p>
                  ))}
                </div>
              </section>
            </>
          ) : detailQuery.data && inspectorTab === "metadata" ? (
            <MetadataPanel
              error={metadataQuery.data?.error}
              isLoading={metadataQuery.isFetching}
              metadata={metadataQuery.data}
              t={t}
            />
          ) : (
            <div className="inspector-empty">
              <Images size={42} />
              <strong>{t("empty.inspectorTitle")}</strong>
              <span>{t("empty.inspector")}</span>
            </div>
          )}
        </aside>
      </main>

      <footer className="statusbar">
        <div className="status-message">
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </div>
        <div className="status-actions">
          <button className="status-info" aria-label={t("common.info")} onClick={() => setAboutOpen(true)}>
            <Info size={15} />
          </button>
          <button className="status-info" aria-label={t("setting.open")} onClick={() => setSettingsOpen(true)}>
            <Settings size={15} />
          </button>
        </div>
      </footer>

      {aboutOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setAboutOpen(false)}>
          <div
            className="modal about-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <Info size={20} />
              <h2>Panasonic Pair Manager</h2>
            </header>
            <p>{t("about.description")}</p>
            <div className="about-list">
              <SummaryRow label="Stack" value={t("about.stack")} />
              <SummaryRow label="Preview" value={t("about.preview")} />
              <SummaryRow label="Delete" value={t("about.delete")} />
              <SummaryRow label="Metadata" value={t("about.metadata")} />
            </div>
            <div className="modal-actions">
              <Button onClick={() => setAboutOpen(false)}>{t("action.close")}</Button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSettingsOpen(false)}>
          <div
            className="modal settings-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <Settings size={20} />
              <h2>{t("setting.title")}</h2>
            </header>
            <div className="settings-list">
              <label className="setting-row">
                <span>{t("setting.theme")}</span>
                <Select
                  className="setting-select"
                  MenuProps={{ classes: { paper: "setting-select-menu" } }}
                  size="small"
                  value={theme}
                  onChange={(event) => setTheme(normalizeTheme(event.target.value))}
                >
                  {THEME_OPTIONS.map((option) => (
                    <MenuItem key={option.code} value={option.code}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </label>
              <label className="setting-row">
                <span>{t("setting.language")}</span>
                <Select
                  className="setting-select"
                  MenuProps={{ classes: { paper: "setting-select-menu" } }}
                  size="small"
                  value={language}
                  onChange={(event) => setLanguage(normalizeLanguage(event.target.value))}
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <MenuItem key={option.code} value={option.code}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </label>
            </div>
            <div className="modal-actions">
              <Button onClick={() => setSettingsOpen(false)}>{t("action.close")}</Button>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <header>
              <Trash2 size={20} />
              <h2>{t("delete.title")}</h2>
            </header>
            <p>{t("delete.confirmDescription")}</p>
            <div className="delete-stats">
              <SummaryRow label={t("common.groups")} value={deletePlan.groups} />
              <SummaryRow label={t("common.files")} value={deletePlan.files} />
              <SummaryRow label={t("delete.rawFiles")} value={deletePlan.rawFiles} />
              <SummaryRow label={t("delete.jpgFiles")} value={deletePlan.jpgFiles} />
              <SummaryRow label={t("common.totalSize")} value={formatBytes(deletePlan.totalSize)} />
            </div>
            <label className="recycle-check">
              <input type="checkbox" checked readOnly />
              {t("delete.moveToRecycle")}
            </label>
            <div className="modal-actions">
              <Button disabled={busy} onClick={confirmDelete} variant="solidDanger">
                {t("action.delete")}
              </Button>
              <Button disabled={busy} onClick={() => setDeleteOpen(false)}>
                {t("action.cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetadataPanel({
  error,
  isLoading,
  metadata,
  t,
}: {
  error?: string;
  isLoading: boolean;
  metadata?: {
    available: boolean;
    sourcePath?: string;
    captureTime?: string;
    cameraModel?: string;
    lens?: string;
    width?: number;
    height?: number;
    items: { tag: string; value: string }[];
  };
  t: ReturnType<typeof makeTranslator>;
}) {
  if (isLoading && !metadata) {
    return <MetadataSkeleton />;
  }

  if (error && !metadata?.available) {
    return (
      <section>
        <div className="section-heading">
          <span>{t("common.metadata")}</span>
        </div>
        <div className="metadata-error">
          <strong>{t("metadata.errorTitle")}</strong>
          <p>{error}</p>
          <span>{t("metadata.errorDetail")}</span>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="kv">
        <SummaryRow label={t("common.captureTime")} value={metadata?.captureTime ?? t("metadata.unknown")} />
        <SummaryRow label={t("common.camera")} value={metadata?.cameraModel ?? t("metadata.unknown")} />
        <SummaryRow label={t("common.lens")} value={metadata?.lens ?? t("metadata.unknown")} />
        <SummaryRow
          label={t("common.dimensions")}
          value={
            metadata?.width && metadata.height
              ? `${metadata.width} x ${metadata.height}`
              : t("metadata.unknown")
          }
        />
      </section>
      <section>
        <div className="section-heading">
          <span>{t("metadata.source")}</span>
        </div>
        <div className="paths">
          <p>{metadata?.sourcePath ?? t("metadata.sourceEmpty")}</p>
        </div>
      </section>
      <section>
        <div className="section-heading">
          <span>{t("metadata.all")}</span>
          <span>{t("metadata.fields", { count: metadata?.items.length ?? 0 })}</span>
        </div>
        {metadata?.items.length ? (
          <div className="metadata-list">
            {metadata.items.map((item) => (
              <div className="metadata-row" key={`${item.tag}-${item.value}`}>
                <span>{item.tag}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-note">{t("empty.noExif")}</div>
        )}
      </section>
    </>
  );
}

function InspectorSkeleton() {
  return (
    <div className="inspector-skeleton" aria-live="polite">
      <div className="skeleton-block skeleton-title" />
      <div className="skeleton-card" />
      <div className="skeleton-card" />
      <div className="skeleton-lines">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function MetadataSkeleton() {
  return (
    <div className="inspector-skeleton" aria-live="polite">
      <div className="skeleton-block skeleton-title" />
      <div className="skeleton-lines">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
