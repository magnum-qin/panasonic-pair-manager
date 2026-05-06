import { invoke } from "@tauri-apps/api/core";
import type {
  DeleteSummary,
  DriveCandidate,
  PhotoGroup,
  PhotoGroupDetail,
  PhotoGroupFilter,
  PhotoGroupMetadata,
  ScanSummary,
} from "./types";

export function selectRootFolder() {
  return invoke<string | null>("select_root_folder");
}

export function scanRoot(path: string) {
  return invoke<ScanSummary>("scan_root", { path });
}

export function listPhotoGroups(filter: PhotoGroupFilter) {
  return invoke<PhotoGroup[]>("list_photo_groups", { filter });
}

export function getPhotoGroup(id: string) {
  return invoke<PhotoGroupDetail>("get_photo_group", { id });
}

export function getPhotoThumbnail(id: string, maxSize: number) {
  return invoke<string | null>("get_photo_thumbnail", { id, maxSize });
}

export function getPhotoGroupMetadata(id: string) {
  return invoke<PhotoGroupMetadata>("get_photo_group_metadata", { id });
}

export function deletePhotoGroups(ids: string[]) {
  return invoke<DeleteSummary>("delete_photo_groups", { ids });
}

export function openPhotoGroup(id: string) {
  return invoke<string>("open_photo_group", { id });
}

export function openPhotoFile(path: string) {
  return invoke<string>("open_photo_file", { path });
}

export function listRemovableRoots() {
  return invoke<DriveCandidate[]>("list_removable_roots");
}

export function pathExists(path: string) {
  return invoke<boolean>("path_exists", { path });
}
