use crate::exiftool;
use crate::models::{FileKind, PhotoGroupMetadata, PhotoMetadataItem};
use crate::state::AppState;
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
pub(crate) async fn get_photo_group_metadata(
    state: State<'_, AppState>,
    id: String,
) -> Result<PhotoGroupMetadata, String> {
    let db = state.db.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let detail = db.get_photo_group(&id).map_err(|error| error.to_string())?;
        let source = detail
            .files
            .iter()
            .find(|file| matches!(file.kind, FileKind::Jpg))
            .or_else(|| {
                detail
                    .files
                    .iter()
                    .find(|file| matches!(file.kind, FileKind::Raw))
            })
            .or_else(|| detail.files.first());

        let Some(source) = source else {
            return Ok(PhotoGroupMetadata {
                error: Some("No files in this photo group.".to_string()),
                ..PhotoGroupMetadata::default()
            });
        };

        match exiftool::read_metadata(PathBuf::from(&source.path).as_path()) {
            Ok(metadata) => Ok(PhotoGroupMetadata {
                available: true,
                source_path: Some(source.path.clone()),
                error: None,
                capture_time: metadata.capture_time,
                camera_model: metadata.camera_model,
                lens: metadata.lens,
                width: metadata.width,
                height: metadata.height,
                items: metadata
                    .items
                    .into_iter()
                    .map(|item| PhotoMetadataItem {
                        tag: item.tag,
                        value: item.value,
                    })
                    .collect(),
            }),
            Err(error) => Ok(PhotoGroupMetadata {
                available: false,
                source_path: Some(source.path.clone()),
                error: Some(error),
                ..PhotoGroupMetadata::default()
            }),
        }
    })
    .await
    .map_err(|error| error.to_string())?
}
