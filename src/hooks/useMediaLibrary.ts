import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  countPhotoGroups,
  getPhotoGroup,
  getPhotoGroupMetadata,
  getScanSummary,
  getThumbnailCacheStats,
  hasScanForRoot,
  listPhotoGroups,
  pathExists,
} from "../api";
import { getGroupsFilter } from "../features/app/app-utils";
import type { GroupKindFilter, MediaKindFilter, PhotoSortMode, ScanSummary } from "../types";
import { PAGE_SIZE } from "../utils";
import { filterGroupsForMediaKind } from "./mediaLibrary-utils";

export function useMediaLibrary({
  activeId,
  deferredQuery,
  groupKind,
  mediaKind,
  photoSort,
  rootPath,
  scanSummary,
}: {
  activeId: string;
  deferredQuery: string;
  groupKind: GroupKindFilter;
  mediaKind: MediaKindFilter;
  photoSort: PhotoSortMode;
  rootPath: string;
  scanSummary: ScanSummary | null;
}) {
  const rootAvailableQuery = useQuery({
    enabled: Boolean(rootPath),
    queryFn: () => pathExists(rootPath),
    queryKey: ["path-exists", rootPath],
    refetchInterval: 5_000,
  });
  const rootIsAvailable = !rootPath || rootAvailableQuery.data !== false;

  const groupsQuery = useInfiniteQuery({
    queryKey: ["photo-groups", rootPath, deferredQuery, groupKind, photoSort, mediaKind],
    queryFn: ({ pageParam }) =>
      listPhotoGroups(
        getGroupsFilter(rootPath, deferredQuery, groupKind, photoSort, mediaKind, pageParam),
      ),
    enabled: Boolean(rootPath) && rootIsAvailable,
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.length <= PAGE_SIZE) return undefined;
      return pages.reduce((sum, page) => sum + Math.min(page.length, PAGE_SIZE), 0);
    },
  });

  const summaryQuery = useQuery({
    enabled: Boolean(rootPath) && rootIsAvailable,
    queryFn: () => getScanSummary(rootPath),
    queryKey: ["scan-summary", rootPath],
  });

  const groupCountQuery = useQuery({
    enabled: Boolean(rootPath) && rootIsAvailable,
    queryFn: () =>
      countPhotoGroups(
        getGroupsFilter(rootPath, deferredQuery, groupKind, photoSort, mediaKind, 0),
      ),
    queryKey: ["photo-group-count", rootPath, deferredQuery, groupKind, photoSort, mediaKind],
  });

  const rootScanQuery = useQuery({
    enabled: Boolean(rootPath) && rootIsAvailable,
    queryFn: () => hasScanForRoot(rootPath),
    queryKey: ["root-scan-state", rootPath],
  });

  const thumbnailCacheQuery = useQuery({
    queryFn: getThumbnailCacheStats,
    queryKey: ["thumbnail-cache-stats"],
  });

  const groups = filterGroupsForMediaKind(
    groupsQuery.data?.pages.flatMap((page) => page.slice(0, PAGE_SIZE)) ?? [],
    mediaKind,
  );

  const detailQuery = useQuery({
    enabled: Boolean(activeId),
    queryFn: () => getPhotoGroup(activeId),
    queryKey: ["photo-group-detail", mediaKind, activeId],
  });

  const metadataQuery = useQuery({
    enabled: Boolean(activeId),
    queryFn: () => getPhotoGroupMetadata(activeId),
    queryKey: ["photo-group-metadata", mediaKind, activeId],
  });

  const hasMoreGroups = groupsQuery.hasNextPage;
  const hasSource = Boolean(rootPath);
  const visibleGroups = hasSource && rootIsAvailable ? groups : [];
  const visibleHasMoreGroups = hasSource && rootIsAvailable ? hasMoreGroups : false;
  const currentSummary = hasSource
    ? (summaryQuery.data ?? (scanSummary?.rootPath === rootPath ? scanSummary : null))
    : null;
  const visibleGroupCount = hasSource ? (groupCountQuery.data ?? visibleGroups.length) : 0;

  return {
    currentSummary,
    detailQuery,
    groupCountQuery,
    groups,
    groupsQuery,
    hasMoreGroups,
    hasSource,
    metadataQuery,
    rootAvailableQuery,
    rootIsAvailable,
    rootScanQuery,
    summaryQuery,
    thumbnailCacheQuery,
    visibleGroupCount,
    visibleGroups,
    visibleHasMoreGroups,
  };
}
