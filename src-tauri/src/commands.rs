use crate::delete::delete_groups;
use crate::drives;
use crate::exiftool;
use crate::models::{
    DeleteSummary, DriveCandidate, FileKind, PhotoGroup, PhotoGroupDetail, PhotoGroupFilter,
    PhotoGroupMetadata, PhotoMetadataItem, ScanSummary,
};
use crate::scanner;
use crate::state::AppState;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;
use std::path::PathBuf;
use tauri::{Emitter, State};

#[tauri::command]
pub(crate) fn select_root_folder() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("Choose Panasonic camera folder")
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string())
}

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
pub(crate) fn count_photo_groups(
    state: State<'_, AppState>,
    filter: PhotoGroupFilter,
) -> Result<usize, String> {
    state
        .db
        .count_photo_groups(&filter)
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
pub(crate) fn get_photo_group(
    state: State<'_, AppState>,
    id: String,
) -> Result<PhotoGroupDetail, String> {
    state
        .db
        .get_photo_group(&id)
        .map_err(|error| error.to_string())
}

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

#[tauri::command]
pub(crate) async fn delete_photo_groups(
    state: State<'_, AppState>,
    ids: Vec<String>,
) -> Result<DeleteSummary, String> {
    let db = state.db.clone();
    tauri::async_runtime::spawn_blocking(move || delete_groups(&db, &ids))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())
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

#[tauri::command]
pub(crate) async fn open_photo_group(
    state: State<'_, AppState>,
    id: String,
) -> Result<String, String> {
    let db = state.db.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let detail = db.get_photo_group(&id).map_err(|error| error.to_string())?;
        let file = detail
            .files
            .iter()
            .find(|file| matches!(file.kind, FileKind::Jpg))
            .or_else(|| {
                detail
                    .files
                    .iter()
                    .find(|file| matches!(file.kind, FileKind::Raw))
            })
            .or_else(|| {
                detail
                    .files
                    .iter()
                    .find(|file| matches!(file.kind, FileKind::Video))
            })
            .ok_or_else(|| "No media file found for this group.".to_string())?;
        open_path(&file.path)?;
        Ok(file.path.clone())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub(crate) async fn open_photo_file(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let source = PathBuf::from(&path);
        if !source.exists() {
            return Err(format!("file does not exist: {path}"));
        }
        open_path(&path)?;
        Ok(path)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn open_path(path: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsStr;
        use std::ptr::null;
        use windows_sys::Win32::UI::Shell::ShellExecuteW;
        use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

        let operation: Vec<u16> = OsStr::new("open").encode_wide().chain(Some(0)).collect();
        let file: Vec<u16> = OsStr::new(path).encode_wide().chain(Some(0)).collect();
        let result = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                operation.as_ptr(),
                file.as_ptr(),
                null(),
                null(),
                SW_SHOWNORMAL,
            )
        };

        if result as isize > 32 {
            return Ok(());
        }

        Err(format!(
            "Failed to open photo: {path} (ShellExecuteW code {result:?})"
        ))
    }

    #[cfg(target_os = "macos")]
    let status = Command::new("open")
        .arg(path)
        .status()
        .map_err(|error| error.to_string())?;

    #[cfg(all(unix, not(target_os = "macos")))]
    let status = Command::new("xdg-open")
        .arg(path)
        .status()
        .map_err(|error| error.to_string())?;

    #[cfg(not(target_os = "windows"))]
    {
        if status.success() {
            Ok(())
        } else {
            Err(format!("Failed to open photo: {path}"))
        }
    }
}
