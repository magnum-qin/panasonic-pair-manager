import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getPhotoThumbnail, getVideoThumbnail } from "../api";
import type { PhotoGroup } from "../types";

const loadedThumbnailPaths = new Set<string>();

export function usePhotoCardThumbnail(group: PhotoGroup, thumbnailSize: number) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const isVideo = group.videoCount > 0 && group.rawCount === 0 && group.jpgCount === 0;
  const videoPreviewPath = isVideo ? group.previewPath : undefined;
  const thumbnailQuery = useQuery({
    enabled: !isVideo && (group.jpgCount > 0 || group.rawCount > 0),
    queryFn: () => getPhotoThumbnail(group.id, thumbnailSize),
    queryKey: ["photo-thumbnail", group.id, thumbnailSize],
    staleTime: Number.POSITIVE_INFINITY,
  });
  const videoThumbnailQuery = useQuery({
    enabled: isVideo,
    queryFn: () => getVideoThumbnail(group.id, thumbnailSize),
    queryKey: ["video-thumbnail", group.id, thumbnailSize],
    staleTime: Number.POSITIVE_INFINITY,
  });
  const thumbnailPath = thumbnailQuery.data ?? videoThumbnailQuery.data;

  useEffect(() => {
    setImageLoaded(Boolean(thumbnailPath && loadedThumbnailPaths.has(thumbnailPath)));
  }, [thumbnailPath]);

  useEffect(() => {
    setVideoLoaded(false);
  }, [videoPreviewPath]);

  const markImageLoaded = () => {
    if (thumbnailPath) loadedThumbnailPaths.add(thumbnailPath);
    setImageLoaded(true);
  };

  return {
    imageLoaded,
    isFetching: thumbnailQuery.isFetching || videoThumbnailQuery.isFetching,
    isVideo,
    markImageLoaded,
    setVideoLoaded,
    thumbnailPath,
    videoLoaded,
    videoPreviewPath,
  };
}
