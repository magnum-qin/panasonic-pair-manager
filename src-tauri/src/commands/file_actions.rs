use crate::delete::delete_groups;
use crate::models::{DeleteSummary, FileKind};
use crate::state::AppState;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;
use std::path::PathBuf;
use tauri::State;

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
    let status = std::process::Command::new("open")
        .arg(path)
        .status()
        .map_err(|error| error.to_string())?;

    #[cfg(all(unix, not(target_os = "macos")))]
    let status = std::process::Command::new("xdg-open")
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
