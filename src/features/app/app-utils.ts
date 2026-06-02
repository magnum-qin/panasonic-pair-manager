import { translate, type LanguageCode, type TranslationKey } from "../../i18n";
import type {
  GroupKindFilter,
  MediaKindFilter,
  PhotoGroupFilter,
  PhotoSortMode,
} from "../../types";
import { PAGE_SIZE } from "../../utils";
import { CARD_SIZE_PRESETS, MANUAL_ROOTS_STORAGE_KEY, type CardSizePreset } from "./app-config";

export function loadStoredManualRoots() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MANUAL_ROOTS_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed.filter((path): path is string => typeof path === "string" && Boolean(path.trim())),
      ),
    );
  } catch {
    return [];
  }
}

export function nearestCardSizePreset(value: number): CardSizePreset {
  return CARD_SIZE_PRESETS.reduce((nearest, preset) =>
    Math.abs(preset.value - value) < Math.abs(nearest.value - value) ? preset : nearest,
  ).value;
}

export function makeTranslator(language: LanguageCode) {
  return (key: TranslationKey, values?: Record<string, string | number>) =>
    translate(language, key, values);
}

export function getGroupsFilter(
  rootPath: string,
  query: string,
  groupKind: GroupKindFilter,
  sort: PhotoSortMode,
  mediaKind: MediaKindFilter,
  offset: number,
): PhotoGroupFilter {
  return {
    rootPath: rootPath || undefined,
    query: query || undefined,
    groupKind: groupKind === "all" ? undefined : groupKind,
    mediaKind,
    sort,
    limit: PAGE_SIZE + 1,
    offset,
  };
}

export function dirName(path: string) {
  const index = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return index > 0 ? path.slice(0, index) : path;
}

export function isPreviewWindowRoute() {
  return new URLSearchParams(window.location.search).get("previewWindow") === "1";
}

export function activeMemoryKey(rootPath: string, mediaKind: MediaKindFilter) {
  return `${mediaKind}:${rootPath}`;
}
