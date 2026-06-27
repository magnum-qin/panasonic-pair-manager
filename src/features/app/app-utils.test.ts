import { beforeEach, describe, expect, it } from "vitest";
import { MANUAL_ROOTS_STORAGE_KEY } from "./app-config";
import { getGroupsFilter, loadStoredManualRoots, nearestCardSizePreset } from "./app-utils";

describe("loadStoredManualRoots", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("deduplicates stored manual roots and ignores invalid entries", () => {
    window.localStorage.setItem(
      MANUAL_ROOTS_STORAGE_KEY,
      JSON.stringify(["C:\\Photos", "", "C:\\Photos", 42]),
    );

    expect(loadStoredManualRoots()).toEqual(["C:\\Photos"]);
  });
});

describe("nearestCardSizePreset", () => {
  it("returns the nearest configured card size", () => {
    expect(nearestCardSizePreset(250)).toBe(230);
    expect(nearestCardSizePreset(340)).toBe(330);
  });
});

describe("getGroupsFilter", () => {
  it("keeps media kind, sort and paging while omitting empty optional values", () => {
    expect(getGroupsFilter("C:\\Photos", "", "all", "nameAsc", "videos", 25)).toMatchObject({
      groupKind: undefined,
      limit: 97,
      mediaKind: "videos",
      offset: 25,
      query: undefined,
      rootPath: "C:\\Photos",
      sort: "nameAsc",
    });
  });
});
