use crate::drives;
use crate::models::DriveCandidate;
use std::path::PathBuf;

#[tauri::command]
pub(crate) fn select_root_folder() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("Choose Panasonic camera folder")
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub(crate) fn list_removable_roots() -> Vec<DriveCandidate> {
    drives::list_removable_roots()
}

#[tauri::command]
pub(crate) async fn path_exists(path: String) -> bool {
    tauri::async_runtime::spawn_blocking(move || PathBuf::from(path).exists())
        .await
        .unwrap_or(false)
}
