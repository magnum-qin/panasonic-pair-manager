export const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "zh-CN", label: "简体中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
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
  | "action.rescan"
  | "common.camera"
  | "common.captureTime"
  | "common.dimensions"
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
  | "delete.title"
  | "empty.addFolder"
  | "empty.inspector"
  | "empty.inspectorTitle"
  | "empty.noExif"
  | "empty.noGroups"
  | "empty.noGroupsInSource"
  | "empty.noPreview"
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
  | "setting.language"
  | "setting.open"
  | "setting.theme"
  | "setting.title"
  | "size.card"
  | "size.presets"
  | "search.placeholder"
  | "source.addFolder"
  | "source.autoDetect"
  | "source.empty"
  | "source.folderRemoved"
  | "source.folderSelected"
  | "source.offline"
  | "source.refresh"
  | "source.removeFolder"
  | "source.selectedManual"
  | "summary.scan"
  | "status.detectedCached"
  | "status.detectedIndexing"
  | "status.opened"
  | "status.opening"
  | "status.ready"
  | "status.scanCompleted"
  | "status.scanning"
  | "status.deleted"
  | "status.deletedFailed";

export type TranslationValues = Record<string, string | number>;

type TranslationMap = Record<TranslationKey, string>;

const en: TranslationMap = {
  "about.description":
    "A Windows-first photo manager for Panasonic RAW/JPG pairs. It scans SD card folders, groups matching files, previews JPGs, and helps safely manage paired RAW/JPG sets.",
  "about.delete": "Windows Recycle Bin",
  "about.metadata": "ExifTool or built-in JPG EXIF",
  "about.preview": "Paired JPG",
  "about.stack": "Tauri 2, Rust, React, SQLite",
  "action.cancel": "Cancel",
  "action.chooseFolder": "Choose Folder",
  "action.close": "Close",
  "action.delete": "Delete",
  "action.deleteSelected": "Delete Selected",
  "action.multiSelect": "Multi Select",
  "action.rescan": "Rescan",
  "common.camera": "Camera",
  "common.captureTime": "Capture Time",
  "common.dimensions": "Dimensions",
  "common.files": "Files",
  "common.folder": "Folder",
  "common.groups": "Groups",
  "common.info": "Info",
  "common.lens": "Lens",
  "common.metadata": "Metadata",
  "common.path": "Path",
  "common.selected": "{count} selected",
  "common.totalSize": "Total Size",
  "delete.confirmDescription": "Move the selected RAW/JPG groups to the Windows Recycle Bin.",
  "delete.moveToRecycle": "Move to Recycle Bin",
  "delete.rawFiles": "RAW files",
  "delete.jpgFiles": "JPG files",
  "delete.title": "Delete Selected Items",
  "empty.addFolder": "Add Folder",
  "empty.inspector": "Select a photo group to inspect files.",
  "empty.inspectorTitle": "No photo selected",
  "empty.noExif": "No embedded EXIF fields found.",
  "empty.noGroups": "No photo groups yet",
  "empty.noGroupsInSource": "No RAW/JPG groups found in this source.",
  "empty.noPreview": "No JPG preview",
  "empty.waiting": "Waiting for photos",
  "empty.waitingDescription": "Insert an SD card, or choose a folder to start browsing photos.",
  "gallery.allItems": "All Items",
  "gallery.loadingMore": "Loading more photos...",
  "gallery.photoGroups": "{count} photo groups",
  "gallery.scrollToContinue": "Scroll to continue",
  "filter.jpgOnly": "JPG only",
  "filter.paired": "Paired RAW + JPG",
  "filter.rawOnly": "RAW only",
  "metadata.all": "All Metadata",
  "metadata.errorDetail":
    "Scanning still works; install ExifTool or add it to PATH to read camera metadata.",
  "metadata.errorTitle": "ExifTool unavailable or failed",
  "metadata.fields": "{count} fields",
  "metadata.reading": "Reading...",
  "metadata.source": "Metadata Source",
  "metadata.sourceEmpty": "No metadata source file.",
  "metadata.unknown": "Unknown",
  "setting.language": "Language",
  "setting.open": "Settings",
  "setting.theme": "Theme",
  "setting.title": "Settings",
  "size.card": "Card Size",
  "size.presets": "Photo card size presets",
  "search.placeholder": "Search filename",
  "source.addFolder": "Add folder",
  "source.autoDetect": "Album Folders",
  "source.empty": "Insert an SD card, or add a folder manually.",
  "source.folderRemoved": "Folder removed.",
  "source.folderSelected": "Folder selected; indexing photos...",
  "source.offline": "Source is offline. Insert the SD card or add a folder manually.",
  "source.refresh": "Refresh removable drives",
  "source.removeFolder": "Remove folder",
  "source.selectedManual": "{name} selected. Press Rescan to re-index files.",
  "summary.scan": "Scan Summary",
  "status.deleted": "Moved {count} files to Recycle Bin. {failed}",
  "status.deletedFailed": "{count} failed.",
  "status.detectedCached": "Detected {name}; cached photos loaded.",
  "status.detectedIndexing": "Detected {name}; indexing photos...",
  "status.opened": "Opened {name}.",
  "status.opening": "Opening photo...",
  "status.ready": "Ready.",
  "status.scanCompleted": "Scan completed: {groups} groups, {files} files.",
  "status.scanning": "Scanning folders...",
};

const translations: Record<LanguageCode, TranslationMap> = {
  en,
  "zh-CN": {
    ...en,
    "action.cancel": "取消",
    "action.chooseFolder": "选择文件夹",
    "action.close": "关闭",
    "action.delete": "删除",
    "action.deleteSelected": "删除所选",
    "action.multiSelect": "多选",
    "action.rescan": "重新扫描",
    "common.camera": "相机",
    "common.captureTime": "拍摄时间",
    "common.dimensions": "尺寸",
    "common.files": "文件",
    "common.folder": "文件夹",
    "common.groups": "组",
    "common.info": "信息",
    "common.lens": "镜头",
    "common.metadata": "元数据",
    "common.path": "路径",
    "common.selected": "已选 {count}",
    "common.totalSize": "总大小",
    "delete.confirmDescription": "将选中的 RAW/JPG 组移动到 Windows 回收站。",
    "delete.moveToRecycle": "移动到回收站",
    "delete.rawFiles": "RAW 文件",
    "delete.jpgFiles": "JPG 文件",
    "delete.title": "删除所选项目",
    "empty.addFolder": "添加文件夹",
    "empty.inspector": "选择一个照片组以查看文件。",
    "empty.inspectorTitle": "未选择照片",
    "empty.noExif": "未找到嵌入的 EXIF 字段。",
    "empty.noGroups": "还没有照片组",
    "empty.noGroupsInSource": "此来源中未找到 RAW/JPG 组。",
    "empty.noPreview": "没有 JPG 预览",
    "empty.waiting": "等待照片",
    "empty.waitingDescription": "插入 SD 卡，或选择文件夹开始浏览照片。",
    "gallery.allItems": "全部项目",
    "gallery.loadingMore": "正在加载更多照片...",
    "gallery.photoGroups": "{count} 个照片组",
    "gallery.scrollToContinue": "滚动继续",
    "filter.jpgOnly": "仅 JPG",
    "filter.paired": "RAW + JPG 配对",
    "filter.rawOnly": "仅 RAW",
    "metadata.all": "全部元数据",
    "metadata.errorDetail": "扫描仍可使用；安装 ExifTool 或加入 PATH 后可读取相机元数据。",
    "metadata.errorTitle": "ExifTool 不可用或读取失败",
    "metadata.fields": "{count} 个字段",
    "metadata.reading": "读取中...",
    "metadata.source": "元数据来源",
    "metadata.sourceEmpty": "没有元数据来源文件。",
    "metadata.unknown": "未知",
    "setting.language": "语言",
    "setting.open": "设置",
    "setting.theme": "主题配色",
    "setting.title": "设置",
    "size.card": "卡片大小",
    "size.presets": "照片卡片大小挡位",
    "search.placeholder": "搜索文件名",
    "source.addFolder": "添加文件夹",
    "source.autoDetect": "相册文件夹",
    "source.empty": "插入 SD 卡，或手动添加文件夹。",
    "source.folderRemoved": "文件夹已移除。",
    "source.folderSelected": "已选择文件夹；正在索引照片...",
    "source.offline": "来源离线。请插入 SD 卡或手动添加文件夹。",
    "source.refresh": "刷新可移动磁盘",
    "source.removeFolder": "移除文件夹",
    "source.selectedManual": "已选择 {name}。点击重新扫描以重新索引文件。",
    "summary.scan": "扫描摘要",
    "status.deleted": "已将 {count} 个文件移到回收站。{failed}",
    "status.deletedFailed": "{count} 个失败。",
    "status.detectedCached": "检测到 {name}；已加载缓存照片。",
    "status.detectedIndexing": "检测到 {name}；正在索引照片...",
    "status.opened": "已打开 {name}。",
    "status.opening": "正在打开照片...",
    "status.ready": "就绪。",
    "status.scanCompleted": "扫描完成：{groups} 组，{files} 个文件。",
    "status.scanning": "正在扫描文件夹...",
  },
  ja: {
    ...en,
    "action.cancel": "キャンセル",
    "action.chooseFolder": "フォルダーを選択",
    "action.close": "閉じる",
    "action.delete": "削除",
    "action.deleteSelected": "選択項目を削除",
    "action.multiSelect": "複数選択",
    "action.rescan": "再スキャン",
    "common.camera": "カメラ",
    "common.captureTime": "撮影時刻",
    "common.dimensions": "サイズ",
    "common.files": "ファイル",
    "common.folder": "フォルダー",
    "common.groups": "グループ",
    "common.info": "情報",
    "common.lens": "レンズ",
    "common.metadata": "メタデータ",
    "common.path": "パス",
    "common.selected": "{count} 件選択",
    "common.totalSize": "合計サイズ",
    "delete.title": "選択項目を削除",
    "empty.noPreview": "JPG プレビューなし",
    "gallery.allItems": "すべて",
    "gallery.photoGroups": "{count} 件の写真グループ",
    "setting.language": "言語",
    "setting.open": "設定",
    "setting.theme": "テーマ",
    "setting.title": "設定",
    "source.autoDetect": "アルバムフォルダー",
    "status.ready": "準備完了。",
  },
  ko: {
    ...en,
    "action.cancel": "취소",
    "action.chooseFolder": "폴더 선택",
    "action.close": "닫기",
    "action.delete": "삭제",
    "action.deleteSelected": "선택 삭제",
    "action.multiSelect": "다중 선택",
    "action.rescan": "다시 스캔",
    "common.camera": "카메라",
    "common.captureTime": "촬영 시간",
    "common.files": "파일",
    "common.folder": "폴더",
    "common.groups": "그룹",
    "common.info": "정보",
    "common.metadata": "메타데이터",
    "common.selected": "{count}개 선택됨",
    "common.totalSize": "전체 크기",
    "empty.noPreview": "JPG 미리보기 없음",
    "gallery.allItems": "전체 항목",
    "gallery.photoGroups": "사진 그룹 {count}개",
    "setting.language": "언어",
    "setting.open": "설정",
    "setting.theme": "테마",
    "setting.title": "설정",
    "source.autoDetect": "앨범 폴더",
    "status.ready": "준비됨.",
  },
  fr: {
    ...en,
    "action.cancel": "Annuler",
    "action.chooseFolder": "Choisir un dossier",
    "action.close": "Fermer",
    "action.delete": "Supprimer",
    "action.deleteSelected": "Supprimer la selection",
    "action.multiSelect": "Selection multiple",
    "action.rescan": "Rescanner",
    "common.camera": "Appareil",
    "common.captureTime": "Date de prise",
    "common.files": "Fichiers",
    "common.folder": "Dossier",
    "common.groups": "Groupes",
    "common.info": "Infos",
    "common.metadata": "Metadonnees",
    "common.selected": "{count} selectionnes",
    "empty.noPreview": "Apercu JPG indisponible",
    "gallery.allItems": "Tous les elements",
    "gallery.photoGroups": "{count} groupes photo",
    "setting.language": "Langue",
    "setting.open": "Parametres",
    "setting.theme": "Theme",
    "setting.title": "Parametres",
    "source.autoDetect": "Dossiers d'albums",
    "status.ready": "Pret.",
  },
  de: {
    ...en,
    "action.cancel": "Abbrechen",
    "action.chooseFolder": "Ordner wahlen",
    "action.close": "Schliessen",
    "action.delete": "Loschen",
    "action.deleteSelected": "Auswahl loschen",
    "action.multiSelect": "Mehrfachauswahl",
    "action.rescan": "Neu scannen",
    "common.camera": "Kamera",
    "common.captureTime": "Aufnahmezeit",
    "common.files": "Dateien",
    "common.folder": "Ordner",
    "common.groups": "Gruppen",
    "common.info": "Info",
    "common.metadata": "Metadaten",
    "common.selected": "{count} ausgewahlt",
    "empty.noPreview": "Keine JPG-Vorschau",
    "gallery.allItems": "Alle Elemente",
    "gallery.photoGroups": "{count} Fotogruppen",
    "setting.language": "Sprache",
    "setting.open": "Einstellungen",
    "setting.theme": "Design",
    "setting.title": "Einstellungen",
    "source.autoDetect": "Albumordner",
    "status.ready": "Bereit.",
  },
  es: {
    ...en,
    "action.cancel": "Cancelar",
    "action.chooseFolder": "Elegir carpeta",
    "action.close": "Cerrar",
    "action.delete": "Eliminar",
    "action.deleteSelected": "Eliminar seleccion",
    "action.multiSelect": "Seleccion multiple",
    "action.rescan": "Reescanear",
    "common.camera": "Camara",
    "common.captureTime": "Hora de captura",
    "common.files": "Archivos",
    "common.folder": "Carpeta",
    "common.groups": "Grupos",
    "common.info": "Info",
    "common.metadata": "Metadatos",
    "common.selected": "{count} seleccionados",
    "empty.noPreview": "Sin vista JPG",
    "gallery.allItems": "Todos",
    "gallery.photoGroups": "{count} grupos de fotos",
    "setting.language": "Idioma",
    "setting.open": "Ajustes",
    "setting.theme": "Tema",
    "setting.title": "Ajustes",
    "source.autoDetect": "Carpetas de album",
    "status.ready": "Listo.",
  },
};

export function normalizeLanguage(value: string | null | undefined): LanguageCode {
  if (value && LANGUAGE_OPTIONS.some((language) => language.code === value)) {
    return value as LanguageCode;
  }
  const browserLanguage = navigator.language;
  if (browserLanguage.startsWith("zh")) return "zh-CN";
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
