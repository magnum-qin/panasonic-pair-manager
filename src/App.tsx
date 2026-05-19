import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  useQueries,
} from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
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
  X,
} from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  countPhotoGroups,
  clearThumbnailCache,
  deletePhotoGroups,
  getPhotoGroup,
  getPhotoGroupMetadata,
  getPhotoThumbnail,
  getScanSummary,
  getThumbnailCacheStats,
  hasScanForRoot,
  listPhotoGroups,
  listRemovableRoots,
  openPhotoFile,
  openPhotoGroup,
  pathExists,
  scanRoot,
  selectRootFolder,
} from "./api";
import { convertFileSrc } from "@tauri-apps/api/core";
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
import type { DriveCandidate, GroupKindFilter, PhotoGroup, PhotoGroupFilter, ScanProgress, ScanSummary } from "./types";
import { fileName, formatBytes, PAGE_SIZE } from "./utils";

const CARD_SIZE_PRESETS = [
  { label: "S", value: 190 },
  { label: "M", value: 230 },
  { label: "L", value: 280 },
  { label: "XL", value: 330 },
] as const;

type CardSizePreset = (typeof CARD_SIZE_PRESETS)[number]["value"];

const MANUAL_ROOTS_STORAGE_KEY = "ppm.manualRoots";
const DELETE_FILE_PREVIEW_LIMIT = 18;

function loadStoredManualRoots() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MANUAL_ROOTS_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed.filter((path): path is string => typeof path === "string" && Boolean(path.trim())),
      ),
    );
  } catch {
    return [];
  }
}

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

function dirName(path: string) {
  const index = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return index > 0 ? path.slice(0, index) : path;
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
  const [closingModal, setClosingModal] = useState<"about" | "settings" | "delete" | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"info" | "metadata">("info");
  const [contextMenu, setContextMenu] = useState<{
    group: PhotoGroup;
    x: number;
    y: number;
  } | null>(null);
  const [previewId, setPreviewId] = useState("");
  const [manualRoots, setManualRoots] = useState<string[]>(loadStoredManualRoots);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [cardSize, setCardSize] = useState(() => {
    const stored = Number(window.localStorage.getItem("ppm.cardSize"));
    return Number.isFinite(stored) ? nearestCardSizePreset(stored) : 230;
  });
  const deferredQuery = useDeferredValue(query);
  const selectionModeRef = useRef(selectionMode);
  const activeByRootRef = useRef<Record<string, string>>({});
  const selectionAnchorRef = useRef<string>("");
  const knownDrivePathsRef = useRef<Set<string>>(new Set());
  const seenRemovablePathsRef = useRef<Set<string>>(new Set());
  const refreshTimerRef = useRef<number | undefined>(undefined);
  const refreshDelayTimerRef = useRef<number | undefined>(undefined);
  const refreshLockedRef = useRef(false);

  const clearActiveSource = useCallback(
    (nextMessage?: string) => {
      setRootPath("");
      setActiveId("");
      setSelected(new Set());
      setScanSummary(null);
      if (nextMessage) setMessage(nextMessage);
    },
    [],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("ppm.theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("ppm.language", language);
  }, [language]);

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

  const summaryQuery = useQuery({
    enabled: Boolean(rootPath) && rootAvailableQuery.data !== false,
    queryFn: () => getScanSummary(rootPath),
    queryKey: ["scan-summary", rootPath],
  });

  const groupCountQuery = useQuery({
    enabled: Boolean(rootPath) && rootAvailableQuery.data !== false,
    queryFn: () => countPhotoGroups(getGroupsFilter(rootPath, deferredQuery, groupKind, 0)),
    queryKey: ["photo-group-count", rootPath, deferredQuery, groupKind],
  });

  const rootScanQuery = useQuery({
    enabled: Boolean(rootPath) && rootAvailableQuery.data !== false,
    queryFn: () => hasScanForRoot(rootPath),
    queryKey: ["root-scan-state", rootPath],
  });

  const thumbnailCacheQuery = useQuery({
    queryFn: getThumbnailCacheStats,
    queryKey: ["thumbnail-cache-stats"],
  });

  const manualAvailabilityQueries = useQueries({
    queries: manualRoots.map((path) => ({
      queryFn: () => pathExists(path),
      queryKey: ["path-exists", path],
      refetchInterval: 10_000,
    })),
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
      setSelected(new Set());
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
      setSelected(new Set());
      setActiveId("");
      await queryClient.invalidateQueries({ queryKey: ["photo-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["photo-group-count"] });
      await queryClient.invalidateQueries({ queryKey: ["scan-summary", rootPath] });
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

  const scanning = scanMutation.isPending;
  const deleting = deleteMutation.isPending;
  const busy = scanning || deleting;
  const detectedRoots = drivesQuery.data ?? [];
  const manualRootSet = useMemo(() => new Set(manualRoots), [manualRoots]);
  const manualAvailability = useMemo(
    () =>
      new Map(
        manualRoots.map((path, index) => [
          path,
          manualAvailabilityQueries[index]?.data,
        ]),
      ),
    [manualAvailabilityQueries, manualRoots],
  );
  const rootIsAvailable = !rootPath || rootAvailableQuery.data !== false;
  const hasSource = Boolean(rootPath);
  const activeSourceIsManual = Boolean(rootPath && manualRootSet.has(rootPath));
  const activeSourceIsRemovable = Boolean(rootPath && detectedRoots.some((drive) => drive.scanPath === rootPath));
  const visibleGroups = hasSource && rootIsAvailable ? groups : [];
  const visibleHasMoreGroups = hasSource && rootIsAvailable ? hasMoreGroups : false;
  const currentSummary =
    hasSource ? (summaryQuery.data ?? (scanSummary?.rootPath === rootPath ? scanSummary : null)) : null;
  const visibleGroupCount = hasSource ? (groupCountQuery.data ?? visibleGroups.length) : 0;
  const sourceWasScanned = rootScanQuery.data === true || (scanSummary?.rootPath === rootPath && !scanning);
  const selectedDrive = detectedRoots.find((drive) => drive.scanPath === rootPath);
  const sourceName = selectedDrive?.displayName ?? (rootPath ? fileName(rootPath) || rootPath : "");
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
        title: t("empty.noGroups"),
        description: activeSourceIsRemovable
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
    rootIsAvailable,
    rootPath,
    rootScanQuery.data,
    scanProgressText,
    scanning,
    sourceName,
    sourceWasScanned,
    t,
  ]);
  const modalOpen = aboutOpen || settingsOpen || deleteOpen || Boolean(previewId);
  const selectedGroups = useMemo(
    () => visibleGroups.filter((group) => selected.has(group.id)),
    [selected, visibleGroups],
  );
  const previewIndex = previewId ? visibleGroups.findIndex((group) => group.id === previewId) : -1;
  const previewGroup = previewIndex >= 0 ? visibleGroups[previewIndex] : null;
  const selectedIds = useMemo(() => [...selected], [selected]);
  const deleteDetailQueries = useQueries({
    queries: selectedIds.map((id) => ({
      enabled: deleteOpen,
      queryFn: () => getPhotoGroup(id),
      queryKey: ["photo-group-detail", id],
    })),
  });
  const deleteDetailLoading = deleteOpen && deleteDetailQueries.some((query) => query.isFetching);
  const deleteFiles = useMemo(
    () => deleteDetailQueries.flatMap((query) => query.data?.files ?? []),
    [deleteDetailQueries],
  );

  const deletePlan = useMemo(() => {
    return selectedGroups.reduce(
      (acc, group) => {
        acc.groups += 1;
        acc.rawFiles += group.rawCount;
        acc.jpgFiles += group.jpgCount;
        acc.sidecarFiles += group.sidecarCount;
        acc.files += group.rawCount + group.jpgCount + group.sidecarCount;
        acc.totalSize += group.totalSize;
        return acc;
      },
      { groups: 0, files: 0, rawFiles: 0, jpgFiles: 0, sidecarFiles: 0, totalSize: 0 },
    );
  }, [selectedGroups]);

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

  const toggleSelected = useCallback((id: string) => {
    selectionAnchorRef.current = id;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const rememberActiveGroup = useCallback(
    (id: string, sourcePath = rootPath) => {
      setActiveId(id);
      if (!sourcePath) return;
      activeByRootRef.current = {
        ...activeByRootRef.current,
        [sourcePath]: id,
      };
    },
    [rootPath],
  );

  const activateOrSelect = useCallback(
    (id: string, range = false) => {
      if (selectionModeRef.current) {
        if (range && selectionAnchorRef.current) {
          const start = visibleGroups.findIndex((group) => group.id === selectionAnchorRef.current);
          const end = visibleGroups.findIndex((group) => group.id === id);
          if (start >= 0 && end >= 0) {
            const [from, to] = start < end ? [start, end] : [end, start];
            setSelected((current) => {
              const next = new Set(current);
              visibleGroups.slice(from, to + 1).forEach((group) => next.add(group.id));
              return next;
            });
            return;
          }
        }
        toggleSelected(id);
      } else {
        rememberActiveGroup(id);
      }
    },
    [rememberActiveGroup, toggleSelected, visibleGroups],
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

  const openPreview = useCallback(
    (id: string, force = false) => {
      if (selectionModeRef.current && !force) return;
      setContextMenu(null);
      rememberActiveGroup(id);
      setPreviewId(id);
      queryClient.prefetchQuery({
        queryFn: () => getPhotoThumbnail(id, 1800),
        queryKey: ["photo-thumbnail", id, 1800],
      });
    },
    [queryClient, rememberActiveGroup],
  );

  const closePreview = useCallback(() => {
    setPreviewId("");
  }, []);

  const movePreview = useCallback(
    (direction: -1 | 1) => {
      if (previewIndex < 0 || !visibleGroups.length) return;
      const nextIndex = (previewIndex + direction + visibleGroups.length) % visibleGroups.length;
      const nextGroup = visibleGroups[nextIndex];
      rememberActiveGroup(nextGroup.id);
      setPreviewId(nextGroup.id);
      queryClient.prefetchQuery({
        queryFn: () => getPhotoThumbnail(nextGroup.id, 1800),
        queryKey: ["photo-thumbnail", nextGroup.id, 1800],
      });
    },
    [previewIndex, queryClient, rememberActiveGroup, visibleGroups],
  );

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
    if (!previewId) return;
    if (visibleGroups.some((group) => group.id === previewId)) return;
    setPreviewId("");
  }, [previewId, visibleGroups]);

  useEffect(() => {
    if (!previewId || previewIndex < 0 || visibleGroups.length < 2) return;
    const adjacent = [
      visibleGroups[(previewIndex - 1 + visibleGroups.length) % visibleGroups.length],
      visibleGroups[(previewIndex + 1) % visibleGroups.length],
    ];
    adjacent.forEach((group) => {
      queryClient.prefetchQuery({
        queryFn: () => getPhotoThumbnail(group.id, 1800),
        queryKey: ["photo-thumbnail", group.id, 1800],
      });
    });
  }, [previewId, previewIndex, queryClient, visibleGroups]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (isEditable || previewId || !hasSource || !visibleGroups.length) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelectionMode(true);
        setSelected(new Set(visibleGroups.map((group) => group.id)));
        selectionAnchorRef.current = visibleGroups[0].id;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasSource, previewId, visibleGroups]);

  useEffect(() => {
    return () => window.clearTimeout(refreshTimerRef.current);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(refreshDelayTimerRef.current);
  }, []);

  useEffect(() => {
    setSelected(new Set());
    setActiveId(rootPath ? (activeByRootRef.current[rootPath] ?? "") : "");
    setInspectorTab("info");
  }, [rootPath]);

  useEffect(() => {
    if (!visibleGroups.length) {
      if (activeId) setActiveId("");
      return;
    }

    if (activeId && visibleGroups.some((group) => group.id === activeId)) return;

    const rememberedId = rootPath ? activeByRootRef.current[rootPath] : "";
    const nextId =
      rememberedId && visibleGroups.some((group) => group.id === rememberedId)
        ? rememberedId
        : visibleGroups[0].id;
    rememberActiveGroup(nextId, rootPath);
  }, [activeId, rememberActiveGroup, rootPath, visibleGroups]);

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
  }, [busy, clearActiveSource, drivesQuery.data, manualRootSet, queryClient, rootPath, scanMutation, t]);

  return (
    <div className={`app-shell ${selectionMode ? "selection-mode" : ""}`}>
      <div className="app-content" aria-hidden={modalOpen ? true : undefined}>
      <div className="toolbar">
        {hasSource && (
          <>
            <ToolbarButton disabled={scanning || deleting || !rootIsAvailable} onClick={() => scan()}>
              <RefreshCw size={17} /> {t("action.rescan")}
            </ToolbarButton>
            <ToolbarButton
              active={selectionMode}
              disabled={deleting || !visibleGroups.length}
              onClick={toggleSelectionMode}
            >
              <SquareCheckBig size={17} /> {t("action.multiSelect")}
            </ToolbarButton>
            {selectionMode && (
              <ToolbarButton
                disabled={deleting || !selected.size}
                onClick={() => {
                  setClosingModal(null);
                  setDeleteOpen(true);
                }}
                variant="danger"
              >
                <Trash2 size={17} /> {t("action.deleteSelected")}
              </ToolbarButton>
            )}
          </>
        )}
        {!hasSource && (
          <ToolbarButton disabled={deleting} onClick={chooseFolder}>
            <FolderPlus size={17} /> {t("action.chooseFolder")}
          </ToolbarButton>
        )}
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
        {hasSource && (
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
            />
          </label>
        )}
        {selectionMode && (
          <div className="selection-meter">{t("common.selected", { count: selected.size })}</div>
        )}
      </div>

      <main className="workspace">
        <aside className="sidebar">
          <section className="sidebar-module sources-module">
            <div className="source-group">
              <div className="source-group-header">
                <span>{t("source.fixedFolders")}</span>
                <IconButton disabled={deleting} label={t("source.addFolder")} onClick={chooseFolder}>
                  <FolderPlus size={15} />
                </IconButton>
              </div>
              {manualRoots.length ? (
                manualRoots.map((path) => (
                  <SidebarItem
                    active={rootPath === path}
                    disabled={deleting}
                    key={path}
                    label={fileName(path) || path}
                    onClear={() => clearManualRoot(path)}
                    onClick={() => selectManualRoot(path)}
                    removeLabel={t("source.removeFolder")}
                    subtitle={
                      manualAvailability.get(path) === false
                        ? `${path} · ${t("source.unavailable")}`
                        : path
                    }
                    tone={manualAvailability.get(path) === false ? "offline" : undefined}
                  />
                ))
              ) : (
                <div className="empty-note compact">{t("source.fixedEmpty")}</div>
              )}
            </div>

            <div className="source-group">
              <div className="source-group-header">
                <span>{t("source.removableDevices")}</span>
                <IconButton
                  disabled={false}
                  label={t("source.refresh")}
                  onClick={refreshRemovableRoots}
                >
                  <RefreshCw size={14} />
                </IconButton>
              </div>
              {detectedRoots.length ? (
                <>
                  {detectedRoots.map((drive) => (
                    <SidebarItem
                      active={rootPath === drive.scanPath}
                      disabled={deleting}
                      key={drive.scanPath}
                      label={drive.displayName}
                      onClick={() => {
                        setRootPath(drive.scanPath);
                        if (scanMutation.isPending) {
                          setMessage(t("source.selectedManual", { name: drive.displayName }));
                          return;
                        }
                        setMessage(t("status.detectedIndexing", { name: drive.displayName }));
                        scanMutation.mutate(drive.scanPath);
                      }}
                      subtitle={drive.scanPath}
                    />
                  ))}
                </>
              ) : (
                <div className="empty-note">{t("source.empty")}</div>
              )}
            </div>

              {rootPath && !manualRootSet.has(rootPath) && !detectedRoots.some((drive) => drive.scanPath === rootPath) ? (
                <div className="source-group">
                  <div className="source-group-header">
                    <span>{t("source.currentSource")}</span>
                  </div>
                  <SidebarItem
                    active
                    disabled={deleting}
                    label={fileName(rootPath) || rootPath}
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["photo-groups"] })}
                    subtitle={rootPath}
                  />
                </div>
              ) : null}
          </section>

          <section className="sidebar-module scan-summary">
            <div className="section-heading">
              <span>{t("summary.scan")}</span>
            </div>
            <SummaryButton
              active={groupKind === "all"}
              icon={<Layers size={15} />}
              label={t("common.groups")}
              onClick={() => applyKindFilter("all")}
              value={hasSource ? (currentSummary?.groups ?? visibleGroups.length) : 0}
            />
            <SummaryButton
              active={groupKind === "paired"}
              icon={<Link2 size={15} />}
              label={t("filter.paired")}
              onClick={() => applyKindFilter("paired")}
              value={hasSource ? (currentSummary?.pairedGroups ?? 0) : 0}
            />
            <SummaryButton
              active={groupKind === "rawOnly"}
              icon={<FileText size={15} />}
              label={t("filter.rawOnly")}
              onClick={() => applyKindFilter("rawOnly")}
              value={hasSource ? (currentSummary?.rawOnlyGroups ?? 0) : 0}
            />
            <SummaryButton
              active={groupKind === "jpgOnly"}
              icon={<Image size={15} />}
              label={t("filter.jpgOnly")}
              onClick={() => applyKindFilter("jpgOnly")}
              value={hasSource ? (currentSummary?.jpgOnlyGroups ?? 0) : 0}
            />
          </section>
        </aside>

        <PhotoGrid
          activeId={activeId}
          emptyActionLabel={t("action.chooseFolder")}
          emptyDescription={emptyState.description}
          emptyTitle={emptyState.title}
          galleryTitle={t("gallery.allItems")}
          groups={visibleGroups}
          hasMore={visibleHasMoreGroups}
          isFetchingMore={groupsQuery.isFetchingNextPage}
          loadingMoreLabel={t("gallery.loadingMore")}
          minCardWidth={cardSize}
          noPreviewLabel={t("empty.noPreview")}
          onActivate={activateOrSelect}
          onContextMenu={openPhotoContextMenu}
          onEmptyAction={chooseFolder}
          onLoadMore={loadMoreGroups}
          onOpen={openPreview}
          onToggle={toggleSelected}
          photoGroupsLabel={t("gallery.photoGroups", { count: visibleGroupCount })}
          scrollToContinueLabel={t("gallery.scrollToContinue")}
          selected={selected}
          totalGroups={visibleGroupCount}
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
          onOpen={() => openGroup(contextMenu.group.id, true)}
          t={t}
          x={contextMenu.x}
          y={contextMenu.y}
        />
      )}

      {previewGroup && (
        <PhotoPreview
          canNavigate={visibleGroups.length > 1}
          group={previewGroup}
          onClose={closePreview}
          onNext={() => movePreview(1)}
          onOpenExternal={() => openGroup(previewGroup.id, true)}
          onPrevious={() => movePreview(-1)}
          t={t}
        />
      )}

      {aboutOpen && (
        <AccessibleModal
          className="about-modal"
          closing={closingModal === "about"}
          onClose={closeAbout}
          title="Panasonic Pair Manager"
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
              <Button onClick={closeAbout}>{t("action.close")}</Button>
            </div>
        </AccessibleModal>
      )}

      {settingsOpen && (
        <AccessibleModal
          className="settings-modal"
          closing={closingModal === "settings"}
          onClose={closeSettings}
          title={t("setting.title")}
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
                  MenuProps={{
                    classes: { paper: "setting-select-menu" },
                    disablePortal: true,
                  }}
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
                  MenuProps={{
                    classes: { paper: "setting-select-menu" },
                    disablePortal: true,
                  }}
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
              <div className="setting-row">
                <span>{t("setting.thumbnailCache")}</span>
                <div className="setting-inline">
                  <strong>
                    {formatBytes(thumbnailCacheQuery.data?.bytes ?? 0)}
                    {" / "}
                    {t("setting.cacheFiles", { count: thumbnailCacheQuery.data?.files ?? 0 })}
                  </strong>
                  <Button
                    disabled={clearThumbnailCacheMutation.isPending}
                    onClick={() => clearThumbnailCacheMutation.mutate()}
                  >
                    {t("setting.clearCache")}
                  </Button>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <Button onClick={closeSettings}>{t("action.close")}</Button>
            </div>
        </AccessibleModal>
      )}

      {deleteOpen && (
        <AccessibleModal
          closeOnBackdrop={false}
          closing={closingModal === "delete"}
          onClose={closeDelete}
          title={t("delete.title")}
        >
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
              <SummaryRow label={t("delete.sidecarFiles")} value={deletePlan.sidecarFiles} />
              <SummaryRow label={t("common.totalSize")} value={formatBytes(deletePlan.totalSize)} />
            </div>
            <div className="delete-file-preview">
              <div className="section-heading">
                <span>{t("delete.filePreview")}</span>
                {deleteDetailLoading ? <span>{t("delete.loadingFiles")}</span> : null}
              </div>
              {deleteFiles.length ? (
                <div className="delete-file-list">
                  {deleteFiles.slice(0, DELETE_FILE_PREVIEW_LIMIT).map((file) => (
                    <div className="delete-file-row" key={file.id} title={file.path}>
                      <strong>{file.fileName}</strong>
                      <span>{file.kind.toUpperCase()}</span>
                      <em>{formatBytes(file.size)}</em>
                    </div>
                  ))}
                  {deleteFiles.length > DELETE_FILE_PREVIEW_LIMIT ? (
                    <div className="delete-file-more">
                      {t("delete.moreFiles", { count: deleteFiles.length - DELETE_FILE_PREVIEW_LIMIT })}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="empty-note compact">
                  {deleteDetailLoading ? t("delete.loadingFiles") : t("delete.noFiles")}
                </div>
              )}
            </div>
            <label className="recycle-check">
              <input type="checkbox" checked readOnly />
              {t("delete.moveToRecycle")}
            </label>
            <div className="modal-actions">
              <Button
                disabled={deleting || !deleteFiles.length}
                onClick={() => {
                  const firstFile = deleteFiles[0];
                  if (firstFile) openFile(dirName(firstFile.path));
                }}
              >
                {t("delete.openContainingFolder")}
              </Button>
              <Button disabled={deleting} onClick={confirmDelete} variant="solidDanger">
                {t("action.delete")}
              </Button>
              <Button disabled={deleting} onClick={closeDelete}>
                {t("action.cancel")}
              </Button>
            </div>
        </AccessibleModal>
      )}
    </div>
  );
}

function AccessibleModal({
  children,
  className = "",
  closing = false,
  closeOnBackdrop = true,
  onClose,
  title,
}: {
  children: ReactNode;
  className?: string;
  closing?: boolean;
  closeOnBackdrop?: boolean;
  onClose: () => void;
  title: string;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusable = getFocusableElements(dialogRef.current);
    (focusable[0] ?? dialogRef.current)?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = getFocusableElements(dialogRef.current);
    if (!focusable.length) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className={`modal-backdrop ${closing ? "closing" : ""}`}
      role="presentation"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${closing ? "closing" : ""} ${className}`}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>
  );
}

function PhotoPreview({
  canNavigate,
  group,
  onClose,
  onNext,
  onOpenExternal,
  onPrevious,
  t,
}: {
  canNavigate: boolean;
  group: PhotoGroup;
  onClose: () => void;
  onNext: () => void;
  onOpenExternal: () => void;
  onPrevious: () => void;
  t: ReturnType<typeof makeTranslator>;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const previewQuery = useQuery({
    queryFn: () => getPhotoThumbnail(group.id, 1800),
    queryKey: ["photo-thumbnail", group.id, 1800],
    staleTime: Infinity,
  });
  const previewPath = previewQuery.data;

  useEffect(() => {
    setLoaded(false);
  }, [previewPath]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, [group.id]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowLeft" && canNavigate) {
      event.preventDefault();
      onPrevious();
      return;
    }
    if (event.key === "ArrowRight" && canNavigate) {
      event.preventDefault();
      onNext();
    }
  };

  return (
    <div
      className="preview-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-label={t("preview.title")}
        aria-modal="true"
        className="preview-dialog"
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="preview-toolbar">
          <div className="preview-title" title={group.stem}>
            <strong>{group.stem}</strong>
            <span>
              {group.folderName} · {formatBytes(group.totalSize)}
            </span>
          </div>
          <div className="preview-actions">
            <Button onClick={onOpenExternal}>
              <ExternalLink size={15} />
              {t("preview.openExternal")}
            </Button>
            <IconButton label={t("action.close")} onClick={onClose}>
              <X size={18} />
            </IconButton>
          </div>
        </header>

        <div className="preview-stage">
          {canNavigate ? (
            <button
              aria-label={t("preview.previous")}
              className="preview-nav previous"
              onClick={onPrevious}
              type="button"
            >
              <ChevronLeft size={28} />
            </button>
          ) : null}

          <div className="preview-image-frame">
            {previewPath ? (
              <img
                className={loaded ? "loaded" : ""}
                src={convertFileSrc(previewPath)}
                alt=""
                onLoad={() => setLoaded(true)}
              />
            ) : previewQuery.isFetching ? (
              <div className="preview-loading">
                <span />
                {t("preview.loading")}
              </div>
            ) : (
              <div className="preview-empty">
                <Image size={42} />
                <strong>{t("preview.unavailable")}</strong>
                <span>{t("preview.unavailableDescription")}</span>
              </div>
            )}
          </div>

          {canNavigate ? (
            <button
              aria-label={t("preview.next")}
              className="preview-nav next"
              onClick={onNext}
              type="button"
            >
              <ChevronRight size={28} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PhotoContextMenu({
  deleteDisabled,
  group,
  onClose,
  onDelete,
  onOpen,
  t,
  x,
  y,
}: {
  deleteDisabled: boolean;
  group: PhotoGroup;
  onClose: () => void;
  onDelete: () => void;
  onOpen: () => void;
  t: ReturnType<typeof makeTranslator>;
  x: number;
  y: number;
}) {
  useEffect(() => {
    const close = () => onClose();
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const left = Math.min(x, Math.max(12, window.innerWidth - 190));
  const top = Math.min(y, Math.max(12, window.innerHeight - 120));

  return (
    <div
      className="photo-context-menu"
      role="menu"
      style={{ left, top }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="context-menu-title" title={group.stem}>
        {group.stem}
      </div>
      <button
        className="context-menu-item"
        onClick={() => {
          onOpen();
          onClose();
        }}
        role="menuitem"
        type="button"
      >
        <ExternalLink size={15} />
        {t("action.open")}
      </button>
      <button
        className="context-menu-item danger"
        disabled={deleteDisabled}
        onClick={() => {
          onDelete();
          onClose();
        }}
        role="menuitem"
        type="button"
      >
        <Trash2 size={15} />
        {t("action.delete")}
      </button>
    </div>
  );
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("hidden") && element.offsetParent !== null);
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
