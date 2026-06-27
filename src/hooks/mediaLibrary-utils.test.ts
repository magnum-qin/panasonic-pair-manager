import { describe, expect, it } from "vitest";
import type { PhotoGroup } from "../types";
import { filterGroupsForMediaKind } from "./mediaLibrary-utils";

const baseGroup: PhotoGroup = {
  cameraModel: undefined,
  captureTime: undefined,
  folderName: "folder",
  id: "base",
  jpgCount: 0,
  lens: undefined,
  previewPath: undefined,
  rawCount: 0,
  rootPath: "C:\\Photos",
  sidecarCount: 0,
  stem: "base",
  totalSize: 0,
  videoCount: 0,
};

function group(overrides: Partial<PhotoGroup>): PhotoGroup {
  return { ...baseGroup, ...overrides };
}

describe("filterGroupsForMediaKind", () => {
  it("keeps only photo-backed groups in photo mode", () => {
    const groups = [
      group({ id: "raw", rawCount: 1 }),
      group({ id: "jpg", jpgCount: 1 }),
      group({ id: "video", videoCount: 1 }),
      group({ id: "sidecar", sidecarCount: 1 }),
    ];

    expect(filterGroupsForMediaKind(groups, "photos").map((item) => item.id)).toEqual([
      "raw",
      "jpg",
    ]);
  });

  it("keeps only video-backed groups in video mode", () => {
    const groups = [
      group({ id: "paired-photo", rawCount: 1, jpgCount: 1 }),
      group({ id: "video", videoCount: 1 }),
      group({ id: "empty" }),
    ];

    expect(filterGroupsForMediaKind(groups, "videos").map((item) => item.id)).toEqual(["video"]);
  });
});
