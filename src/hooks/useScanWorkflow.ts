import { useMutation, type QueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import { scanRoot } from "../api";
import type { TranslationKey } from "../i18n";
import type { ScanProgress, ScanSummary } from "../types";
import { fileName } from "../utils";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function useScanWorkflow({
  clearSelection,
  queryClient,
  rootPath,
  setActiveId,
  setMessage,
  setQuery,
  setRootPath,
  setScanSummary,
  t,
}: {
  clearSelection: () => void;
  queryClient: QueryClient;
  rootPath: string;
  setActiveId: (id: string) => void;
  setMessage: (message: string) => void;
  setQuery: (query: string) => void;
  setRootPath: (path: string) => void;
  setScanSummary: (summary: ScanSummary | null) => void;
  t: Translator;
}) {
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);

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

  const scan = useCallback(
    (path = rootPath) => {
      if (!path) return;
      scanMutation.mutate(path);
    },
    [rootPath, scanMutation],
  );

  const scanning = scanMutation.isPending;
  const scanProgressText =
    scanning && scanProgress?.rootPath === rootPath
      ? t("status.scanProgress", {
          scanned: scanProgress.scannedFiles,
          matched: scanProgress.matchedFiles,
          dir: fileName(scanProgress.currentDir) || scanProgress.currentDir,
        })
      : "";

  return {
    scan,
    scanMutation,
    scanProgress,
    scanProgressText,
    scanning,
  };
}
