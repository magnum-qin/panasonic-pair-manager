use crate::models::{PhotoGroup, PhotoGroupDetail, PhotoGroupFilter};
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub(crate) fn list_photo_groups(
    state: State<'_, AppState>,
    filter: PhotoGroupFilter,
) -> Result<Vec<PhotoGroup>, String> {
    state
        .db
        .list_photo_groups(&filter)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn get_photo_group(
    state: State<'_, AppState>,
    id: String,
) -> Result<PhotoGroupDetail, String> {
    state
        .db
        .get_photo_group(&id)
        .map_err(|error| error.to_string())
}
