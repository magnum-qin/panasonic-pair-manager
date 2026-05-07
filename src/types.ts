export type FileKind = "raw" | "jpg" | "sidecar" | "other";

export interface PhotoFile {
  id: number;
  groupId: string;
  path: string;
  fileName: string;
  extension: string;
  kind: FileKind;
  size: number;
  modifiedSecs?: number;
  width?: number;
  height?: number;
}

export interface PhotoGroup {
  id: string;
  rootPath: string;
  stem: string;
  folderName: string;
  captureTime?: string;
  cameraModel?: string;
  lens?: string;
  previewPath?: string;
  totalSize: number;
  rawCount: number;
  jpgCount: number;
  sidecarCount: number;
}

export interface PhotoGroupDetail extends PhotoGroup {
  files: PhotoFile[];
}

export interface PhotoGroupMetadata {
  available: boolean;
  sourcePath?: string;
  error?: string;
  captureTime?: string;
  cameraModel?: string;
  lens?: string;
  width?: number;
  height?: number;
  items: PhotoMetadataItem[];
}

export interface PhotoMetadataItem {
  tag: string;
  value: string;
}

export interface PhotoGroupFilter {
  rootPath?: string;
  query?: string;
  groupKind?: GroupKindFilter;
  limit?: number;
  offset?: number;
}

export type GroupKindFilter = "all" | "paired" | "rawOnly" | "jpgOnly";

export interface ScanSummary {
  rootPath: string;
  groups: number;
  files: number;
  rawFiles: number;
  jpgFiles: number;
  sidecarFiles: number;
  otherFiles: number;
  pairedGroups: number;
  rawOnlyGroups: number;
  jpgOnlyGroups: number;
}

export interface ScanProgress {
  rootPath: string;
  scannedFiles: number;
  matchedFiles: number;
  currentDir: string;
  done: boolean;
}

export interface ThumbnailCacheStats {
  files: number;
  bytes: number;
}

export interface DeleteSummary {
  groups: number;
  files: number;
  rawFiles: number;
  jpgFiles: number;
  totalSize: number;
  failed: string[];
}

export interface DriveCandidate {
  drivePath: string;
  scanPath: string;
  displayName: string;
  hasDcim: boolean;
  hasPanasonicFolders: boolean;
}
