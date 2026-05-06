import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CheckCircle2,
  FolderPlus,
  Info,
  RefreshCw,
  Search,
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
  const [message, setMessage] = useState("Ready.");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
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
      setMessage("Scanning folders...");
    },
    onSuccess: async (summary) => {
      setRootPath(summary.rootPath);
      setScanSummary(summary);
      setSelected(new Set());
      setActiveId("");
      setQuery("");
      await queryClient.invalidateQueries({ queryKey: ["photo-groups"] });
      setMessage(`Scan completed: ${summary.groups} groups, ${summary.files} files.`);
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
        `Moved ${summary.files - summary.failed.length} files to Recycle Bin. ${
          summary.failed.length ? `${summary.failed.length} failed.` : ""
        }`,
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
    setMessage("Folder selected; indexing photos...");
    scanMutation.mutate(path);
  }, [scanMutation]);

  const scan = useCallback(
    (path = rootPath) => {
      if (!path) return;
      scanMutation.mutate(path);
    },
    [rootPath, scanMutation],
  );

  const refreshRemovableRoots = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["removable-roots"] });
  }, [queryClient]);

  const clearManualRoot = useCallback(() => {
    setRootPath("");
    setActiveId("");
    setSelected(new Set());
    setScanSummary(null);
    setMessage("Folder removed.");
  }, []);

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
      setMessage("Opening photo...");
      try {
        const path = await openPhotoGroup(id);
        setMessage(`Opened ${fileName(path)}.`);
      } catch (error) {
        setMessage(String(error));
      }
    },
    [],
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
    setMessage("Source is offline. Insert the SD card or add a folder manually.");
  }, [rootAvailableQuery.data]);

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
      setMessage(`Detected ${nextCandidate.displayName}; cached photos loaded.`);
      return;
    }

    autoScannedPathsRef.current.add(scanPath);
    setMessage(`Detected ${nextCandidate.displayName}; indexing photos...`);
    scanMutation.mutate(scanPath);
  }, [busy, drivesQuery.data, queryClient, scanMutation]);

  return (
    <div className={`app-shell ${selectionMode ? "selection-mode" : ""}`}>
      <div className="toolbar">
        <ToolbarButton disabled={busy || !hasSource} onClick={() => scan()}>
          <RefreshCw size={17} /> Rescan
        </ToolbarButton>
        <ToolbarButton
          active={selectionMode}
          disabled={busy || !hasSource || !visibleGroups.length}
          onClick={toggleSelectionMode}
        >
          <SquareCheckBig size={17} /> Multi Select
        </ToolbarButton>
        <ToolbarButton
          disabled={busy || !selectionMode || !selected.size}
          hidden={!selectionMode}
          onClick={() => setDeleteOpen(true)}
          variant="danger"
        >
          <Trash2 size={17} /> Delete Selected
        </ToolbarButton>
        <div className="toolbar-spacer" />
        <div className="size-control" aria-label="Photo card size" title="Photo card size">
          <span>Card Size</span>
          <div className="size-options" role="group" aria-label="Photo card size presets">
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
            placeholder="Search filename"
            disabled={!hasSource}
          />
        </label>
        {selectionMode && <div className="selection-meter">{selected.size} selected</div>}
      </div>

      <main className="workspace">
        <aside className="sidebar">
          <section>
            <div className="section-heading">
              <span>Auto Detect</span>
              <div className="heading-actions">
                <IconButton disabled={busy} label="Add folder" onClick={chooseFolder}>
                  <FolderPlus size={15} />
                </IconButton>
                <IconButton
                  disabled={drivesQuery.isFetching}
                  label="Refresh removable drives"
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
                        setMessage(`${drive.displayName} selected. Press Rescan to re-index files.`);
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
                      subtitle={rootPath}
                    />
                  ) : null}
                </>
              ) : (
                <div className="empty-note">Insert an SD card, or add a folder manually.</div>
              )}
            </div>
          </section>

          <section className="scan-summary">
            <div className="section-heading">
              <span>Scan Summary</span>
            </div>
            <SummaryButton
              active={groupKind === "all"}
              label="Groups"
              onClick={() => applyKindFilter("all")}
              value={hasSource ? (scanSummary?.groups ?? visibleGroups.length) : 0}
            />
            <SummaryButton
              active={groupKind === "paired"}
              label="Paired RAW + JPG"
              onClick={() => applyKindFilter("paired")}
              value={hasSource ? (scanSummary?.pairedGroups ?? 0) : 0}
            />
            <SummaryButton
              active={groupKind === "rawOnly"}
              label="RAW only"
              onClick={() => applyKindFilter("rawOnly")}
              value={hasSource ? (scanSummary?.rawOnlyGroups ?? 0) : 0}
            />
            <SummaryButton
              active={groupKind === "jpgOnly"}
              label="JPG only"
              onClick={() => applyKindFilter("jpgOnly")}
              value={hasSource ? (scanSummary?.jpgOnlyGroups ?? 0) : 0}
            />
          </section>
        </aside>

        <PhotoGrid
          activeId={activeId}
          emptyActionLabel="Choose Folder"
          emptyDescription={
            hasSource
              ? "No RAW/JPG groups found in this source."
              : "Insert an SD card, or choose a folder to start browsing photos."
          }
          emptyTitle={hasSource ? "No photo groups yet" : "Waiting for photos"}
          groups={visibleGroups}
          hasMore={visibleHasMoreGroups}
          isFetchingMore={groupsQuery.isFetchingNextPage}
          minCardWidth={cardSize}
          onActivate={activateOrSelect}
          onEmptyAction={chooseFolder}
          onLoadMore={loadMoreGroups}
          onOpen={openGroup}
          onToggle={toggleSelected}
          selected={selected}
        />

        <aside className="inspector">
          <div className="tabs">
            <button
              className={inspectorTab === "info" ? "active" : ""}
              onClick={() => setInspectorTab("info")}
            >
              Info
            </button>
            <button
              className={inspectorTab === "metadata" ? "active" : ""}
              onClick={() => setInspectorTab("metadata")}
              disabled={!activeId}
            >
              Metadata
            </button>
          </div>
          {detailQuery.isFetching && !detailQuery.data ? (
            <InspectorSkeleton />
          ) : detailQuery.data && inspectorTab === "info" ? (
            <>
              <section>
                <div className="section-heading">
                  <span>Files</span>
                  <span>{detailQuery.data.files.length} selected</span>
                </div>
                <div className="file-list">
                  {detailQuery.data.files.map((file) => (
                    <div className="file-row" key={file.id}>
                      <strong>{file.fileName}</strong>
                      <span>{file.kind.toUpperCase()}</span>
                      <em>{formatBytes(file.size)}</em>
                    </div>
                  ))}
                </div>
              </section>
              <section className="kv">
                <SummaryRow
                  label="Capture Time"
                  value={
                    metadataQuery.data?.captureTime ??
                    detailQuery.data.captureTime ??
                    (metadataQuery.isFetching ? "Reading..." : "Unknown")
                  }
                />
                <SummaryRow
                  label="Camera"
                  value={
                    metadataQuery.data?.cameraModel ??
                    detailQuery.data.cameraModel ??
                    (metadataQuery.isFetching ? "Reading..." : "Unknown")
                  }
                />
                <SummaryRow
                  label="Lens"
                  value={
                    metadataQuery.data?.lens ??
                    detailQuery.data.lens ??
                    (metadataQuery.isFetching ? "Reading..." : "Unknown")
                  }
                />
                <SummaryRow label="Folder" value={detailQuery.data.folderName} />
                <SummaryRow label="Total Size" value={formatBytes(detailQuery.data.totalSize)} />
              </section>
              <section>
                <div className="section-heading">
                  <span>Path</span>
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
            />
          ) : (
            <div className="empty-note">Select a photo group to inspect files.</div>
          )}
        </aside>
      </main>

      <footer className="statusbar">
        <div className="status-message">
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </div>
        <button className="status-info" aria-label="About this project" onClick={() => setAboutOpen(true)}>
          <Info size={15} />
        </button>
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
            <p>
              A Windows-first photo manager for Panasonic RAW/JPG pairs. It scans SD card folders,
              groups matching files, previews JPGs, and helps safely manage paired RAW/JPG sets.
            </p>
            <div className="about-list">
              <SummaryRow label="Stack" value="Tauri 2, Rust, React, SQLite" />
              <SummaryRow label="Preview" value="Paired JPG" />
              <SummaryRow label="Delete" value="Windows Recycle Bin" />
              <SummaryRow label="Metadata" value="ExifTool or built-in JPG EXIF" />
            </div>
            <div className="modal-actions">
              <Button onClick={() => setAboutOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <header>
              <Trash2 size={20} />
              <h2>Delete Selected Items</h2>
            </header>
            <p>Move the selected RAW/JPG groups to the Windows Recycle Bin.</p>
            <div className="delete-stats">
              <SummaryRow label="Groups" value={deletePlan.groups} />
              <SummaryRow label="Files" value={deletePlan.files} />
              <SummaryRow label="RAW files" value={deletePlan.rawFiles} />
              <SummaryRow label="JPG files" value={deletePlan.jpgFiles} />
              <SummaryRow label="Total size" value={formatBytes(deletePlan.totalSize)} />
            </div>
            <label className="recycle-check">
              <input type="checkbox" checked readOnly />
              Move to Recycle Bin
            </label>
            <div className="modal-actions">
              <Button disabled={busy} onClick={confirmDelete} variant="solidDanger">
                Delete
              </Button>
              <Button disabled={busy} onClick={() => setDeleteOpen(false)}>
                Cancel
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
}) {
  if (isLoading && !metadata) {
    return <MetadataSkeleton />;
  }

  if (error && !metadata?.available) {
    return (
      <section>
        <div className="section-heading">
          <span>Metadata</span>
        </div>
        <div className="metadata-error">
          <strong>ExifTool unavailable or failed</strong>
          <p>{error}</p>
          <span>Scanning still works; install ExifTool or add it to PATH to read camera metadata.</span>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="kv">
        <SummaryRow label="Capture Time" value={metadata?.captureTime ?? "Unknown"} />
        <SummaryRow label="Camera" value={metadata?.cameraModel ?? "Unknown"} />
        <SummaryRow label="Lens" value={metadata?.lens ?? "Unknown"} />
        <SummaryRow
          label="Dimensions"
          value={
            metadata?.width && metadata.height
              ? `${metadata.width} x ${metadata.height}`
              : "Unknown"
          }
        />
      </section>
      <section>
        <div className="section-heading">
          <span>Metadata Source</span>
        </div>
        <div className="paths">
          <p>{metadata?.sourcePath ?? "No metadata source file."}</p>
        </div>
      </section>
      <section>
        <div className="section-heading">
          <span>All Metadata</span>
          <span>{metadata?.items.length ?? 0} fields</span>
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
          <div className="empty-note">No embedded EXIF fields found.</div>
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
