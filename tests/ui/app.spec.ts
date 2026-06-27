import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __TAURI_EVENT_PLUGIN_INTERNALS__: {
      unregisterListener: () => undefined;
    };
    __TAURI_INTERNALS__: {
      convertFileSrc: () => string;
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
      transformCallback: (callback: unknown) => number;
      unregisterCallback: (id: number) => void;
    };
  }
}

const ROOT_PATH = "C:\\Photos\\2026-2";

const photoGroups = [
  {
    id: "photo-1",
    rootPath: ROOT_PATH,
    stem: "P1034304",
    folderName: "2026-2",
    captureTime: "2026-02-10 16:00:41",
    cameraModel: "DC-S5M2X",
    lens: "LUMIX S 70-300/F4.5-5.6",
    previewPath: `${ROOT_PATH}\\P1034304.JPG`,
    totalSize: 37_000_000,
    rawCount: 1,
    jpgCount: 1,
    videoCount: 0,
    sidecarCount: 0,
  },
  {
    id: "photo-2",
    rootPath: ROOT_PATH,
    stem: "P1034305",
    folderName: "2026-2",
    captureTime: "2026-02-10 16:00:56",
    cameraModel: "DC-S5M2X",
    lens: "LUMIX S 70-300/F4.5-5.6",
    previewPath: `${ROOT_PATH}\\P1034305.JPG`,
    totalSize: 39_200_000,
    rawCount: 1,
    jpgCount: 1,
    videoCount: 0,
    sidecarCount: 0,
  },
];

const videoGroups = [
  {
    id: "video-1",
    rootPath: ROOT_PATH,
    stem: "V1000001",
    folderName: "2026-2",
    captureTime: "2026-02-10 17:00:00",
    cameraModel: "DC-S5M2X",
    lens: "",
    previewPath: `${ROOT_PATH}\\V1000001.MP4`,
    totalSize: 120_000_000,
    rawCount: 0,
    jpgCount: 0,
    videoCount: 1,
    sidecarCount: 0,
  },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ rootPath, photos, videos }) => {
      window.localStorage.setItem("ppm.language", "zh-CN");
      window.localStorage.setItem("ppm.manualRoots", JSON.stringify([rootPath]));

      let callbackId = 0;
      const callbacks = new Map<number, unknown>();
      const transparentImage =
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='200'%3E%3Crect width='320' height='200' fill='%23dbeafe'/%3E%3C/svg%3E";

      window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
        unregisterListener: () => undefined,
      };
      window.__TAURI_INTERNALS__ = {
        convertFileSrc: () => transparentImage,
        invoke: async (cmd: string, args?: Record<string, unknown>) => {
          const filter = args?.filter as { mediaKind?: string } | undefined;

          switch (cmd) {
            case "list_removable_roots":
              return [];
            case "path_exists":
            case "has_scan_for_root":
              return true;
            case "get_thumbnail_cache_stats":
              return { files: 0, bytes: 0, limitBytes: 536_870_912 };
            case "get_external_tool_status":
              return { exiftoolAvailable: true, ffmpegAvailable: true };
            case "get_scan_summary":
              return {
                rootPath,
                groups: 3,
                files: 5,
                rawFiles: 2,
                jpgFiles: 2,
                videoFiles: 1,
                sidecarFiles: 0,
                otherFiles: 0,
                pairedGroups: 2,
                rawOnlyGroups: 0,
                jpgOnlyGroups: 0,
              };
            case "count_photo_groups":
              return filter?.mediaKind === "videos" ? 1 : 2;
            case "list_photo_groups":
              return filter?.mediaKind === "videos" ? videos : photos;
            case "get_photo_group": {
              const id = args?.id;
              const group = [...photos, ...videos].find((item) => item.id === id);
              return {
                ...group,
                files:
                  id === "video-1"
                    ? [
                        {
                          id: 3,
                          groupId: "video-1",
                          path: `${rootPath}\\V1000001.MP4`,
                          fileName: "V1000001.MP4",
                          extension: "mp4",
                          kind: "video",
                          size: 120_000_000,
                        },
                      ]
                    : [
                        {
                          id: 1,
                          groupId: String(id),
                          path: `${rootPath}\\${id === "photo-1" ? "P1034304" : "P1034305"}.RW2`,
                          fileName: `${id === "photo-1" ? "P1034304" : "P1034305"}.RW2`,
                          extension: "rw2",
                          kind: "raw",
                          size: 27_000_000,
                        },
                        {
                          id: 2,
                          groupId: String(id),
                          path: `${rootPath}\\${id === "photo-1" ? "P1034304" : "P1034305"}.JPG`,
                          fileName: `${id === "photo-1" ? "P1034304" : "P1034305"}.JPG`,
                          extension: "jpg",
                          kind: "jpg",
                          size: 10_000_000,
                        },
                      ],
              };
            }
            case "get_photo_group_metadata":
              return {
                available: true,
                captureTime: "2026-02-10 16:00:41",
                cameraModel: "DC-S5M2X",
                lens: "LUMIX S 70-300/F4.5-5.6",
                items: [],
              };
            case "get_photo_thumbnail":
              return "mock-photo-thumbnail.jpg";
            case "get_video_thumbnail":
              return "mock-video-thumbnail.jpg";
            case "plugin:event|listen":
              return 1;
            case "plugin:event|unlisten":
              return undefined;
            default:
              return undefined;
          }
        },
        transformCallback: (callback: unknown) => {
          callbackId += 1;
          callbacks.set(callbackId, callback);
          return callbackId;
        },
        unregisterCallback: (id: number) => {
          callbacks.delete(id);
        },
      };
    },
    { rootPath: ROOT_PATH, photos: photoGroups, videos: videoGroups },
  );
});

test("defaults to the first remembered source and renders photo results", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("固定文件夹")).toBeVisible();
  await expect(page.getByRole("button", { name: /^P1034304,/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^P1034305,/ })).toBeVisible();
  await expect(page.getByText("照片数量")).toBeVisible();
});

test("switching to videos clears photo results and updates the inspector language", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: /视频/ }).click();

  await expect(page.getByRole("button", { name: /^V1000001,/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^P1034304,/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^P1034305,/ })).toHaveCount(0);
  await expect(page.getByText("VIDEO").first()).toBeVisible();
  await expect(page.locator(".photo-card video")).toHaveCount(0);
});
