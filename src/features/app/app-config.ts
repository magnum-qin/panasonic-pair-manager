import type { TranslationKey } from "../../i18n";
import type { PhotoSortMode } from "../../types";
import type { ThemeCode } from "../../theme-options";

export const CARD_SIZE_PRESETS = [
  { label: "S", value: 190 },
  { label: "M", value: 230 },
  { label: "L", value: 280 },
  { label: "XL", value: 330 },
] as const;

export type CardSizePreset = (typeof CARD_SIZE_PRESETS)[number]["value"];

export const PHOTO_SORT_OPTIONS: { labelKey: TranslationKey; value: PhotoSortMode }[] = [
  { labelKey: "sort.captureAsc", value: "captureAsc" },
  { labelKey: "sort.captureDesc", value: "captureDesc" },
  { labelKey: "sort.nameAsc", value: "nameAsc" },
  { labelKey: "sort.nameDesc", value: "nameDesc" },
  { labelKey: "sort.sizeDesc", value: "sizeDesc" },
  { labelKey: "sort.sizeAsc", value: "sizeAsc" },
];

export const MANUAL_ROOTS_STORAGE_KEY = "ppm.manualRoots";
export const DELETE_FILE_PREVIEW_LIMIT = 18;
export const PREVIEW_WINDOW_LABEL = "photo-preview";
export const PREVIEW_WINDOW_STORAGE_KEY = "ppm.previewWindowState";
export const GALLERY_LAYOUT_FADE_MS = 120;
export const GALLERY_LAYOUT_SETTLE_MS = 40;
export const MEDIA_SWITCH_FADE_MS = 120;
export const MEDIA_SWITCH_SETTLE_MS = 40;

export const PREVIEW_WINDOW_BACKGROUNDS: Record<ThemeCode, string> = {
  classic: "#f6f3ee",
  forest: "#f0f4ef",
  graphite: "#20211f",
  pureWhite: "#ffffff",
  sakura: "#f7f1f4",
  trueBlack: "#000000",
};
