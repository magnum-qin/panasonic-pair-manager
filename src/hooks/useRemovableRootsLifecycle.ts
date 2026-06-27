import { useQuery, type QueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef } from "react";
import { listRemovableRoots } from "../api";
import type { TranslationKey } from "../i18n";
import type { DriveCandidate } from "../types";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function useRemovableRootsLifecycle({
  busy,
  clearActiveSource,
  manualRoots,
  queryClient,
  rootPath,
  scanRootPath,
  setMessage,
  setRootPath,
  t,
}: {
  busy: boolean;
  clearActiveSource: (nextMessage?: string) => void;
  manualRoots: string[];
  queryClient: QueryClient;
  rootPath: string;
  scanRootPath: (path: string) => void;
  setMessage: (message: string) => void;
  setRootPath: (path: string) => void;
  t: Translator;
}) {
  const knownDrivePathsRef = useRef<Set<string>>(new Set());
  const seenRemovablePathsRef = useRef<Set<string>>(new Set());
  const refreshTimerRef = useRef<number | undefined>(undefined);
  const refreshDelayTimerRef = useRef<number | undefined>(undefined);
  const refreshLockedRef = useRef(false);

  const drivesQuery = useQuery({
    queryFn: listRemovableRoots,
    queryKey: ["removable-roots"],
    refetchInterval: 30_000,
  });

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
    return () => {
      window.clearTimeout(refreshTimerRef.current);
      window.clearTimeout(refreshDelayTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const candidates = drivesQuery.data;
    if (!candidates) return;

    const currentPaths = new Set(candidates.map((candidate) => candidate.scanPath));
    const removedActiveRemovableRoot =
      rootPath &&
      !manualRoots.includes(rootPath) &&
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
    scanRootPath(scanPath);
  }, [
    busy,
    clearActiveSource,
    drivesQuery.data,
    manualRoots,
    rootPath,
    scanRootPath,
    setMessage,
    setRootPath,
    t,
  ]);

  return {
    detectedRoots: drivesQuery.data ?? [],
    refreshRemovableRoots,
  };
}
