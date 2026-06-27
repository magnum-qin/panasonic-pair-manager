import { useQueries, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { pathExists, selectRootFolder } from "../api";
import { MANUAL_ROOTS_STORAGE_KEY } from "../features/app/app-config";
import { loadStoredManualRoots } from "../features/app/app-utils";
import type { TranslationKey } from "../i18n";
import type { DriveCandidate } from "../types";
import { fileName } from "../utils";
import { useRemovableRootsLifecycle } from "./useRemovableRootsLifecycle";
import { useSourceSelection } from "./useSourceSelection";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function useSourceLifecycle({
  busy,
  clearActiveSource,
  queryClient,
  rootPath,
  scanPending,
  scanRootPath,
  setMessage,
  setRootPath,
  t,
}: {
  busy: boolean;
  clearActiveSource: (nextMessage?: string) => void;
  queryClient: QueryClient;
  rootPath: string;
  scanPending: boolean;
  scanRootPath: (path: string) => void;
  setMessage: (message: string) => void;
  setRootPath: (path: string) => void;
  t: Translator;
}) {
  const [manualRoots, setManualRoots] = useState<string[]>(loadStoredManualRoots);
  const initialManualRootSelectedRef = useRef(false);

  useEffect(() => {
    window.localStorage.setItem(MANUAL_ROOTS_STORAGE_KEY, JSON.stringify(manualRoots));
  }, [manualRoots]);

  const manualAvailabilityQueries = useQueries({
    queries: manualRoots.map((path) => ({
      queryFn: () => pathExists(path),
      queryKey: ["path-exists", path],
      refetchInterval: 10_000,
    })),
  });

  const { detectedRoots, refreshRemovableRoots } = useRemovableRootsLifecycle({
    busy,
    clearActiveSource,
    manualRoots,
    queryClient,
    rootPath,
    scanRootPath,
    setMessage,
    setRootPath,
    t,
  });
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
  }, [manualAvailabilityQueries, manualRoots, rootPath, setMessage, setRootPath, t]);

  const chooseFolder = useCallback(async () => {
    const path = await selectRootFolder();
    if (!path) return;
    setManualRoots((current) => (current.includes(path) ? current : [...current, path]));
    setRootPath(path);
    if (scanPending) {
      setMessage(t("source.selectedManual", { name: fileName(path) || path }));
      return;
    }
    setMessage(t("source.folderSelected"));
    scanRootPath(path);
  }, [scanPending, scanRootPath, setMessage, setRootPath, t]);

  const selectManualRoot = useCallback(
    (path: string) => {
      setRootPath(path);
      setMessage(t("source.selectedManual", { name: fileName(path) || path }));
      queryClient.invalidateQueries({ queryKey: ["photo-groups", path] });
    },
    [queryClient, setMessage, setRootPath, t],
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
    [clearActiveSource, rootPath, setMessage, t],
  );

  const selectRemovableRoot = useCallback(
    (drive: DriveCandidate) => {
      setRootPath(drive.scanPath);
      if (scanPending) {
        setMessage(t("source.selectedManual", { name: drive.displayName }));
        return;
      }
      setMessage(t("status.detectedIndexing", { name: drive.displayName }));
      scanRootPath(drive.scanPath);
    },
    [scanPending, scanRootPath, setMessage, setRootPath, t],
  );

  return {
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
  };
}
