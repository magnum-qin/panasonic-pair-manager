import type { MediaKindFilter, PhotoGroup } from "../types";

export function filterGroupsForMediaKind(groups: PhotoGroup[], mediaKind: MediaKindFilter) {
  return groups.filter((group) =>
    mediaKind === "videos" ? group.videoCount > 0 : group.rawCount > 0 || group.jpgCount > 0,
  );
}
