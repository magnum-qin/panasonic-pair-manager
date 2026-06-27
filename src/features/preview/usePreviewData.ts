import { useQuery, type QueryClient } from "@tanstack/react-query";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { getPhotoGroup, getPhotoThumbnail } from "../../api";

function groupPreviewPath(group: Awaited<ReturnType<typeof getPhotoGroup>> | undefined) {
  return group?.files.find((file) => file.kind === "jpg")?.path ?? "";
}

export function usePreviewData({
  canNavigate,
  currentId,
  currentIndex,
  ids,
  queryClient,
}: {
  canNavigate: boolean;
  currentId: string;
  currentIndex: number;
  ids: string[];
  queryClient: QueryClient;
}) {
  const detailQuery = useQuery({
    enabled: Boolean(currentId),
    queryFn: () => getPhotoGroup(currentId),
    queryKey: ["photo-group-detail", currentId],
  });
  const group = detailQuery.data;
  const jpgFile = group?.files.find((file) => file.kind === "jpg");
  const rawFile = group?.files.find((file) => file.kind === "raw");
  const previewQuery = useQuery({
    enabled: Boolean(currentId && !jpgFile),
    queryFn: () => getPhotoThumbnail(currentId, 2400),
    queryKey: ["photo-thumbnail", currentId, 2400],
    staleTime: Infinity,
  });
  const previewPath = jpgFile?.path ?? previewQuery.data;
  const externalPath = jpgFile?.path ?? rawFile?.path ?? previewPath ?? "";

  useEffect(() => {
    if (!canNavigate) return;
    const adjacent = [
      ids[(currentIndex - 1 + ids.length) % ids.length],
      ids[(currentIndex + 1) % ids.length],
    ];
    adjacent.forEach((id) => {
      queryClient.prefetchQuery({
        queryFn: async () => {
          const nextGroup = await getPhotoGroup(id);
          const nextPreviewPath = groupPreviewPath(nextGroup);
          if (nextPreviewPath) {
            const image = new window.Image();
            image.decoding = "async";
            image.src = convertFileSrc(nextPreviewPath);
          } else {
            queryClient.prefetchQuery({
              queryFn: () => getPhotoThumbnail(id, 2400),
              queryKey: ["photo-thumbnail", id, 2400],
              staleTime: Infinity,
            });
          }
          return nextGroup;
        },
        queryKey: ["photo-group-detail", id],
      });
    });
  }, [canNavigate, currentIndex, ids, queryClient]);

  return {
    detailQuery,
    externalPath,
    group,
    previewPath,
    previewQuery,
  };
}
