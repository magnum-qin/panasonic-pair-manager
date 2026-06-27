mod cache_key;
mod external_tools;
mod photo;
mod video;

use crate::cache;
use crate::models::ThumbnailCacheStats;
use crate::state::AppState;
use std::fs;
use tauri::State;

#[tauri::command]
pub(crate) async fn get_photo_thumbnail(
    state: State<'_, AppState>,
    id: String,
    max_size: u32,
) -> Result<Option<String>, String> {
    photo::get_photo_thumbnail(state, id, max_size).await
}

#[tauri::command]
pub(crate) async fn get_video_thumbnail(
    state: State<'_, AppState>,
    id: String,
    max_size: u32,
) -> Result<Option<String>, String> {
    video::get_video_thumbnail(state, id, max_size).await
}

#[tauri::command]
pub(crate) async fn get_thumbnail_cache_stats(
    state: State<'_, AppState>,
) -> Result<ThumbnailCacheStats, String> {
    let thumbnail_dir = state.thumbnail_dir.clone();
    tauri::async_runtime::spawn_blocking(move || cache::thumbnail_cache_stats(&thumbnail_dir))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub(crate) async fn clear_thumbnail_cache(
    state: State<'_, AppState>,
) -> Result<ThumbnailCacheStats, String> {
    let thumbnail_dir = state.thumbnail_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        if thumbnail_dir.exists() {
            for entry in fs::read_dir(&thumbnail_dir).map_err(|error| error.to_string())? {
                let entry = entry.map_err(|error| error.to_string())?;
                let path = entry.path();
                if path.is_file() {
                    let _ = fs::remove_file(path);
                }
            }
        }
        cache::thumbnail_cache_stats(&thumbnail_dir)
    })
    .await
    .map_err(|error| error.to_string())?
}
