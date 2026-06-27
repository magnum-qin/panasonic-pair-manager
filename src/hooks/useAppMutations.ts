import { useCallback } from "react";
import { useMutation, type QueryClient } from "@tanstack/react-query";
import { clearThumbnailCache, deletePhotoGroups } from "../api";
import type { DeleteSummary, ThumbnailCacheStats } from "../types";
import type { TranslationKey } from "../i18n";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function useAppMutations({
  clearSelection,
  closeDelete,
  queryClient,
  rootPath,
  selected,
  setActiveId,
  setMessage,
  t,
}: {
  clearSelection: () => void;
  closeDelete: () => void;
  queryClient: QueryClient;
  rootPath: string;
  selected: Set<string>;
  setActiveId: (id: string) => void;
  setMessage: (message: string) => void;
  t: Translator;
}) {
  const clearThumbnailCacheMutation = useMutation<ThumbnailCacheStats, Error>({
    mutationFn: clearThumbnailCache,
    onSuccess: (stats) => {
      queryClient.setQueryData(["thumbnail-cache-stats"], stats);
      queryClient.removeQueries({ queryKey: ["photo-thumbnail"] });
      setMessage(t("status.thumbnailCacheCleared"));
    },
    onError: (error) => setMessage(String(error)),
  });

  const deleteMutation = useMutation<DeleteSummary, Error, string[]>({
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

  const confirmDelete = useCallback(() => {
    if (!selected.size) return;
    deleteMutation.mutate([...selected]);
  }, [deleteMutation, selected]);

  return {
    clearThumbnailCacheMutation,
    confirmDelete,
    deleting: deleteMutation.isPending,
  };
}
