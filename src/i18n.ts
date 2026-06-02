import { translations } from "./locales/translations";

export const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
] as const;

export type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]["code"];

export type TranslationKey =
  | "about.description"
  | "about.delete"
  | "about.metadata"
  | "about.preview"
  | "about.stack"
  | "action.cancel"
  | "action.chooseFolder"
  | "action.close"
  | "action.delete"
  | "action.deleteSelected"
  | "action.multiSelect"
  | "action.open"
  | "action.rescan"
  | "action.selectAll"
  | "common.camera"
  | "common.captureTime"
  | "common.dimensions"
  | "common.duration"
  | "common.files"
  | "common.folder"
  | "common.groups"
  | "common.info"
  | "common.lens"
  | "common.metadata"
  | "common.path"
  | "common.selected"
  | "common.totalSize"
  | "delete.confirmDescription"
  | "delete.moveToRecycle"
  | "delete.rawFiles"
  | "delete.jpgFiles"
  | "delete.videoFiles"
  | "delete.sidecarFiles"
  | "delete.filePreview"
  | "delete.loadingFiles"
  | "delete.moreFiles"
  | "delete.noFiles"
  | "delete.openContainingFolder"
  | "delete.title"
  | "empty.addFolder"
  | "empty.inspector"
  | "empty.inspectorTitle"
  | "empty.inspectorVideo"
  | "empty.inspectorVideoTitle"
  | "empty.noExif"
  | "empty.noGroups"
  | "empty.noGroupsInRemovable"
  | "empty.noGroupsInSource"
  | "empty.noPreview"
  | "empty.noVideoPreview"
  | "empty.noVideos"
  | "empty.noVideosInSource"
  | "empty.scanningDescription"
  | "empty.scanningTitle"
  | "empty.fixedOfflineDescription"
  | "empty.removableOfflineDescription"
  | "empty.sourceOfflineTitle"
  | "empty.unscannedDescription"
  | "empty.unscannedRemovableDescription"
  | "empty.unscannedTitle"
  | "empty.waiting"
  | "empty.waitingDescription"
  | "gallery.allItems"
  | "gallery.loadingMore"
  | "gallery.photoGroups"
  | "gallery.scrollToContinue"
  | "filter.jpgOnly"
  | "filter.paired"
  | "filter.rawOnly"
  | "metadata.all"
  | "metadata.errorDetail"
  | "metadata.errorTitle"
  | "metadata.fields"
  | "metadata.reading"
  | "metadata.source"
  | "metadata.sourceEmpty"
  | "metadata.unknown"
  | "media.kind"
  | "media.photos"
  | "media.videos"
  | "preview.loading"
  | "preview.next"
  | "preview.openExternal"
  | "preview.previous"
  | "preview.title"
  | "preview.unavailable"
  | "preview.unavailableDescription"
  | "setting.language"
  | "setting.cacheFiles"
  | "setting.clearCache"
  | "setting.open"
  | "setting.theme"
  | "setting.thumbnailCache"
  | "setting.title"
  | "size.card"
  | "size.presets"
  | "search.placeholder"
  | "source.addFolder"
  | "source.autoDetect"
  | "source.currentSource"
  | "source.empty"
  | "source.fixedEmpty"
  | "source.fixedFolders"
  | "source.folderRemoved"
  | "source.folderSelected"
  | "source.offline"
  | "source.refresh"
  | "source.removeFolder"
  | "source.removableDevices"
  | "source.removableRemoved"
  | "source.selectedManual"
  | "source.unavailable"
  | "sort.captureAsc"
  | "sort.captureDesc"
  | "sort.label"
  | "sort.nameAsc"
  | "sort.nameDesc"
  | "sort.sizeAsc"
  | "sort.sizeDesc"
  | "summary.scan"
  | "status.detectedCached"
  | "status.detectedIndexing"
  | "status.opened"
  | "status.opening"
  | "status.ready"
  | "status.scanCompleted"
  | "status.scanProgress"
  | "status.scanning"
  | "status.thumbnailCacheCleared"
  | "status.deleted"
  | "status.deletedFailed";

export type TranslationValues = Record<string, string | number>;

export type TranslationMap = Record<TranslationKey, string>;

export function normalizeLanguage(value: string | null | undefined): LanguageCode {
  if (value && LANGUAGE_OPTIONS.some((language) => language.code === value)) {
    return value as LanguageCode;
  }
  const browserLanguage = navigator.language;
  if (browserLanguage === "zh-TW" || browserLanguage === "zh-HK" || browserLanguage === "zh-MO") {
    return "zh-TW";
  }
  if (browserLanguage.startsWith("zh")) return "zh-CN";
  if (browserLanguage.startsWith("pt")) return "pt";
  const shortCode = LANGUAGE_OPTIONS.find((language) => browserLanguage.startsWith(language.code));
  return shortCode?.code ?? "en";
}

export function translate(
  language: LanguageCode,
  key: TranslationKey,
  values: TranslationValues = {},
): string {
  const template = translations[language][key] ?? translations.en[key];
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ""));
}
