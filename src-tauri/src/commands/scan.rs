use crate::models::{PhotoGroupFilter, ScanSummary};
use crate::scanner;
use crate::state::AppState;
use std::path::PathBuf;
use tauri::{Emitter, State};

#[tauri::command]
pub(crate) async fn scan_root(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<ScanSummary, String> {
    let db = state.db.clone();
    tauri::async_runtime::spawn_blocking(move || {
        scanner::scan_root_with_progress(&db, PathBuf::from(path), |progress| {
            let _ = app_handle.emit("scan-progress", progress);
        })
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn get_scan_summary(
    state: State<'_, AppState>,
    root_path: String,
) -> Result<ScanSummary, String> {
    state
        .db
        .scan_summary_for_root(&root_path)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn has_scan_for_root(
    state: State<'_, AppState>,
    root_path: String,
) -> Result<bool, String> {
    state
        .db
        .has_scan_for_root(&root_path)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn count_photo_groups(
    state: State<'_, AppState>,
    filter: PhotoGroupFilter,
) -> Result<usize, String> {
    state
        .db
        .count_photo_groups(&filter)
        .map_err(|error| error.to_string())
}
