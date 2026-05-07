mod db;
mod delete;
mod drives;
mod exiftool;
mod models;
mod scanner;

use db::Database;
use delete::delete_groups;
use image::codecs::jpeg::JpegEncoder;
use image::ImageReader;
use models::{
    DeleteSummary, DriveCandidate, FileKind, PhotoGroup, PhotoGroupDetail, PhotoGroupFilter,
    PhotoGroupMetadata, PhotoMetadataItem, ScanSummary, ThumbnailCacheStats,
};
use sha1::{Digest, Sha1};
use std::fs;
use std::fs::File;
use std::io::{BufReader, BufWriter, Write};
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Emitter, LogicalSize, Manager, Size, State};

struct AppState {
    db: Database,
    thumbnail_dir: PathBuf,
    thumbnail_lock: Arc<Mutex<()>>,
}

const THUMBNAIL_CACHE_LIMIT_BYTES: u64 = 512 * 1024 * 1024;

#[tauri::command]
fn select_root_folder() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("Choose Panasonic camera folder")
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
async fn scan_root(
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
fn list_photo_groups(
    state: State<'_, AppState>,
    filter: PhotoGroupFilter,
) -> Result<Vec<PhotoGroup>, String> {
    state
        .db
        .list_photo_groups(&filter)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn count_photo_groups(
    state: State<'_, AppState>,
    filter: PhotoGroupFilter,
) -> Result<usize, String> {
    state
        .db
        .count_photo_groups(&filter)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_scan_summary(state: State<'_, AppState>, root_path: String) -> Result<ScanSummary, String> {
    state
        .db
        .scan_summary_for_root(&root_path)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn has_scan_for_root(state: State<'_, AppState>, root_path: String) -> Result<bool, String> {
    state
        .db
        .has_scan_for_root(&root_path)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_photo_group(state: State<'_, AppState>, id: String) -> Result<PhotoGroupDetail, String> {
    state
        .db
        .get_photo_group(&id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_photo_thumbnail(
    state: State<'_, AppState>,
    id: String,
    max_size: u32,
) -> Result<Option<String>, String> {
    let db = state.db.clone();
    let thumbnail_dir = state.thumbnail_dir.clone();
    let thumbnail_lock = state.thumbnail_lock.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let detail = db.get_photo_group(&id).map_err(|error| error.to_string())?;
        let Some(file) = detail
            .files
            .iter()
            .find(|file| matches!(file.kind, FileKind::Jpg))
            .or_else(|| {
                detail
                    .files
                    .iter()
                    .find(|file| matches!(file.kind, FileKind::Raw))
            })
        else {
            return Ok(None);
        };

        let source = PathBuf::from(&file.path);
        if !source.exists() {
            return Ok(None);
        }

        std::fs::create_dir_all(&thumbnail_dir).map_err(|error| error.to_string())?;
        let size = max_size.clamp(160, 900);
        let cache_path = thumbnail_dir.join(format!(
            "{}-{}-{}.jpg",
            stable_hash(&file.path),
            file.modified_secs.unwrap_or_default(),
            size
        ));
        if cache_path.exists() {
            return Ok(Some(cache_path.to_string_lossy().to_string()));
        }

        let _guard = thumbnail_lock
            .lock()
            .map_err(|_| "thumbnail worker lock is poisoned".to_string())?;
        if cache_path.exists() {
            return Ok(Some(cache_path.to_string_lossy().to_string()));
        }
        if write_embedded_thumbnail(&source, &cache_path).is_ok() {
            return Ok(Some(cache_path.to_string_lossy().to_string()));
        }
        if write_exiftool_preview(&source, &cache_path).is_ok() {
            return Ok(Some(cache_path.to_string_lossy().to_string()));
        }

        if !matches!(file.kind, FileKind::Jpg) {
            return Ok(None);
        }

        let image = ImageReader::open(&source)
            .map_err(|error| error.to_string())?
            .with_guessed_format()
            .map_err(|error| error.to_string())?
            .decode()
            .map_err(|error| error.to_string())?;
        let thumbnail = image.thumbnail(size, size);
        let output = File::create(&cache_path).map_err(|error| error.to_string())?;
        let mut writer = BufWriter::new(output);
        let mut encoder = JpegEncoder::new_with_quality(&mut writer, 78);
        encoder
            .encode_image(&thumbnail)
            .map_err(|error| error.to_string())?;

        Ok(Some(cache_path.to_string_lossy().to_string()))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn get_thumbnail_cache_stats(
    state: State<'_, AppState>,
) -> Result<ThumbnailCacheStats, String> {
    let thumbnail_dir = state.thumbnail_dir.clone();
    tauri::async_runtime::spawn_blocking(move || thumbnail_cache_stats(&thumbnail_dir))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn clear_thumbnail_cache(state: State<'_, AppState>) -> Result<ThumbnailCacheStats, String> {
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
        thumbnail_cache_stats(&thumbnail_dir)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn thumbnail_cache_stats(thumbnail_dir: &PathBuf) -> Result<ThumbnailCacheStats, String> {
    let mut stats = ThumbnailCacheStats::default();
    if !thumbnail_dir.exists() {
        return Ok(stats);
    }

    for entry in fs::read_dir(thumbnail_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        if !metadata.is_file() {
            continue;
        }
        stats.files += 1;
        stats.bytes += metadata.len();
    }
    Ok(stats)
}

fn enforce_thumbnail_cache_limit(thumbnail_dir: &PathBuf, limit_bytes: u64) -> Result<(), String> {
    if !thumbnail_dir.exists() {
        return Ok(());
    }

    let mut entries = Vec::new();
    let mut total = 0u64;
    for entry in fs::read_dir(thumbnail_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        if !metadata.is_file() {
            continue;
        }
        let modified = metadata.modified().ok();
        let size = metadata.len();
        total += size;
        entries.push((entry.path(), modified, size));
    }

    if total <= limit_bytes {
        return Ok(());
    }

    entries.sort_by_key(|(_, modified, _)| *modified);
    for (path, _, size) in entries {
        if total <= limit_bytes {
            break;
        }
        if fs::remove_file(path).is_ok() {
            total = total.saturating_sub(size);
        }
    }
    Ok(())
}

fn write_exiftool_preview(source: &PathBuf, cache_path: &PathBuf) -> Result<(), String> {
    for tag in ["PreviewImage", "JpgFromRaw", "ThumbnailImage"] {
        let output = Command::new("exiftool")
            .arg("-b")
            .arg(format!("-{tag}"))
            .arg(source)
            .output()
            .map_err(|error| error.to_string())?;

        if !output.status.success() || output.stdout.len() < 256 {
            continue;
        }
        if !output.stdout.starts_with(&[0xff, 0xd8, 0xff]) {
            continue;
        }
        std::fs::write(cache_path, output.stdout).map_err(|error| error.to_string())?;
        return Ok(());
    }
    Err("ExifTool did not return a JPEG preview.".to_string())
}

fn write_embedded_thumbnail(source: &PathBuf, cache_path: &PathBuf) -> Result<(), String> {
    let file = File::open(source).map_err(|error| error.to_string())?;
    let mut reader = BufReader::new(file);
    let exif = exif::Reader::new()
        .read_from_container(&mut reader)
        .map_err(|error| error.to_string())?;
    let offset = exif_long(&exif, exif::Tag::JPEGInterchangeFormat, exif::In::THUMBNAIL)
        .ok_or_else(|| "embedded thumbnail offset not found".to_string())?
        as usize;
    let length = exif_long(
        &exif,
        exif::Tag::JPEGInterchangeFormatLength,
        exif::In::THUMBNAIL,
    )
    .ok_or_else(|| "embedded thumbnail length not found".to_string())? as usize;
    let end = offset
        .checked_add(length)
        .ok_or_else(|| "embedded thumbnail offset overflow".to_string())?;
    let data = exif.buf();
    if length < 32 || end > data.len() {
        return Err("embedded thumbnail data is invalid".to_string());
    }
    let mut output = File::create(cache_path).map_err(|error| error.to_string())?;
    output
        .write_all(&data[offset..end])
        .map_err(|error| error.to_string())
}

fn exif_long(exif: &exif::Exif, tag: exif::Tag, ifd: exif::In) -> Option<u32> {
    let field = exif.get_field(tag, ifd)?;
    match &field.value {
        exif::Value::Long(values) => values.first().copied(),
        exif::Value::Short(values) => values.first().map(|value| *value as u32),
        _ => None,
    }
}

fn stable_hash(value: &str) -> String {
    let mut hasher = Sha1::new();
    hasher.update(value.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[tauri::command]
async fn get_photo_group_metadata(
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
async fn delete_photo_groups(
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
fn list_removable_roots() -> Vec<DriveCandidate> {
    drives::list_removable_roots()
}

#[tauri::command]
async fn path_exists(path: String) -> bool {
    tauri::async_runtime::spawn_blocking(move || PathBuf::from(path).exists())
        .await
        .unwrap_or(false)
}

#[tauri::command]
async fn open_photo_group(state: State<'_, AppState>, id: String) -> Result<String, String> {
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
            .ok_or_else(|| "No photo file found for this group.".to_string())?;
        open_path(&file.path)?;
        Ok(file.path.clone())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn open_photo_file(path: String) -> Result<String, String> {
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
    let status = Command::new("rundll32")
        .arg("url.dll,FileProtocolHandler")
        .arg(path)
        .status()
        .map_err(|error| error.to_string())?;

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

    if status.success() {
        Ok(())
    } else {
        Err(format!("Failed to open photo: {path}"))
    }
}

fn drive_signature(candidates: &[DriveCandidate]) -> Vec<String> {
    let mut paths = candidates
        .iter()
        .map(|candidate| {
            let modified = std::fs::metadata(&candidate.scan_path)
                .and_then(|metadata| metadata.modified())
                .ok()
                .and_then(|modified| modified.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|duration| duration.as_secs())
                .unwrap_or_default();
            format!("{}:{modified}", candidate.scan_path)
        })
        .collect::<Vec<_>>();
    paths.sort();
    paths
}

fn emit_removable_roots_if_changed(
    app: &tauri::AppHandle,
    last_signature: &Arc<Mutex<Vec<String>>>,
) {
    let candidates = drives::list_removable_roots();
    let signature = drive_signature(&candidates);
    let Ok(mut last_signature) = last_signature.lock() else {
        return;
    };
    if signature == *last_signature {
        return;
    }
    *last_signature = signature;
    let _ = app.emit("removable-roots-changed", candidates);
}

fn start_removable_roots_monitor(app: tauri::AppHandle) {
    let last_signature = Arc::new(Mutex::new(drive_signature(&drives::list_removable_roots())));

    #[cfg(target_os = "windows")]
    start_windows_device_change_listener(app.clone(), last_signature.clone());

    tauri::async_runtime::spawn_blocking(move || loop {
        std::thread::sleep(Duration::from_secs(60));
        emit_removable_roots_if_changed(&app, &last_signature);
    });
}

fn fit_main_window_to_monitor(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten());
    let Some(monitor) = monitor else {
        return;
    };

    let scale = monitor.scale_factor().max(1.0);
    let size = monitor.size();
    let logical_width = size.width as f64 / scale;
    let logical_height = size.height as f64 / scale;
    let max_width = (logical_width - 64.0).max(760.0);
    let max_height = (logical_height - 104.0).max(460.0);
    let width = 1180.0_f64.min(max_width).max(860.0_f64.min(max_width));
    let height = 680.0_f64.min(max_height).max(520.0_f64.min(max_height));

    let _ = window.set_size(Size::Logical(LogicalSize { width, height }));
    let _ = window.center();
}

#[cfg(target_os = "windows")]
fn start_windows_device_change_listener(
    app: tauri::AppHandle,
    last_signature: Arc<Mutex<Vec<String>>>,
) {
    use std::sync::mpsc::{channel, Sender};
    use std::sync::OnceLock;
    use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW, RegisterClassW,
        TranslateMessage, MSG, WNDCLASSW,
    };

    const DBT_DEVICEARRIVAL: usize = 0x8000;
    const DBT_DEVICEREMOVECOMPLETE: usize = 0x8004;
    const DBT_DEVNODES_CHANGED: usize = 0x0007;
    const WM_DEVICECHANGE: u32 = 0x0219;

    static DEVICE_CHANGE_SENDER: OnceLock<Sender<()>> = OnceLock::new();

    unsafe extern "system" fn wnd_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if msg == WM_DEVICECHANGE
            && matches!(
                wparam,
                DBT_DEVICEARRIVAL | DBT_DEVICEREMOVECOMPLETE | DBT_DEVNODES_CHANGED
            )
        {
            if let Some(sender) = DEVICE_CHANGE_SENDER.get() {
                let _ = sender.send(());
            }
        }
        unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) }
    }

    fn wide_null(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    let (sender, receiver) = channel::<()>();
    let _ = DEVICE_CHANGE_SENDER.set(sender);

    std::thread::spawn(move || {
        let class_name = wide_null("PanasonicPairManagerDeviceChangeWindow");
        let window_created = unsafe {
            let hinstance = GetModuleHandleW(std::ptr::null());
            let mut class: WNDCLASSW = std::mem::zeroed();
            class.lpfnWndProc = Some(wnd_proc);
            class.hInstance = hinstance;
            class.lpszClassName = class_name.as_ptr();
            RegisterClassW(&class);
            let hwnd = CreateWindowExW(
                0,
                class_name.as_ptr(),
                class_name.as_ptr(),
                0,
                0,
                0,
                0,
                0,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                hinstance,
                std::ptr::null_mut(),
            );
            !hwnd.is_null()
        };

        if !window_created {
            return;
        }

        let mut message: MSG = unsafe { std::mem::zeroed() };
        loop {
            let result = unsafe { GetMessageW(&mut message, std::ptr::null_mut(), 0, 0) };
            if result <= 0 {
                break;
            }
            unsafe {
                TranslateMessage(&message);
                DispatchMessageW(&message);
            }
            while receiver.try_recv().is_ok() {
                for delay_ms in [0, 350, 1_200] {
                    if delay_ms > 0 {
                        std::thread::sleep(Duration::from_millis(delay_ms));
                    }
                    emit_removable_roots_if_changed(&app, &last_signature);
                }
            }
        }
    });
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::current_dir().expect("current directory exists"));
            std::fs::create_dir_all(&app_dir)?;
            let thumbnail_dir = app_dir.join("thumbnails");
            std::fs::create_dir_all(&thumbnail_dir)?;
            let _ = enforce_thumbnail_cache_limit(&thumbnail_dir, THUMBNAIL_CACHE_LIMIT_BYTES);
            let db = Database::new(app_dir.join("library.sqlite3"))?;
            db.migrate()?;
            app.manage(AppState {
                db,
                thumbnail_dir,
                thumbnail_lock: Arc::new(Mutex::new(())),
            });
            fit_main_window_to_monitor(app.handle());
            start_removable_roots_monitor(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            select_root_folder,
            scan_root,
            list_photo_groups,
            count_photo_groups,
            get_scan_summary,
            has_scan_for_root,
            get_photo_group,
            get_photo_thumbnail,
            get_thumbnail_cache_stats,
            clear_thumbnail_cache,
            get_photo_group_metadata,
            delete_photo_groups,
            open_photo_group,
            open_photo_file,
            path_exists,
            list_removable_roots
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
