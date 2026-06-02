import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { getPhotoGroup } from "../api";
import type { PhotoGroup } from "../types";

export function useDeleteWorkflow({
  deleteOpen,
  selectedGroups,
  selectedIds,
}: {
  deleteOpen: boolean;
  selectedGroups: PhotoGroup[];
  selectedIds: string[];
}) {
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
        acc.videoFiles += group.videoCount;
        acc.sidecarFiles += group.sidecarCount;
        acc.files += group.rawCount + group.jpgCount + group.videoCount + group.sidecarCount;
        acc.totalSize += group.totalSize;
        return acc;
      },
      {
        groups: 0,
        files: 0,
        rawFiles: 0,
        jpgFiles: 0,
        videoFiles: 0,
        sidecarFiles: 0,
        totalSize: 0,
      },
    );
  }, [selectedGroups]);

  return {
    deleteDetailLoading,
    deleteFiles,
    deletePlan,
  };
}
