use super::cache_key::thumbnail_cache_path;
use super::external_tools::{write_embedded_thumbnail, write_exiftool_preview};
use crate::cache;
use crate::models::FileKind;
use crate::state::AppState;
use image::codecs::jpeg::JpegEncoder;
use image::ImageReader;
use std::fs::File;
use std::io::BufWriter;
use std::path::PathBuf;
use tauri::State;

pub(crate) async fn get_photo_thumbnail(
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
        let size = max_size.clamp(160, 2400);
        let cache_path =
            thumbnail_cache_path(&thumbnail_dir, None, &file.path, file.modified_secs, size);
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
            let _ = cache::enforce_thumbnail_cache_limit(
                &thumbnail_dir,
                cache::THUMBNAIL_CACHE_LIMIT_BYTES,
            );
            return Ok(Some(cache_path.to_string_lossy().to_string()));
        }
        if write_exiftool_preview(&source, &cache_path).is_ok() {
            let _ = cache::enforce_thumbnail_cache_limit(
                &thumbnail_dir,
                cache::THUMBNAIL_CACHE_LIMIT_BYTES,
            );
            return Ok(Some(cache_path.to_string_lossy().to_string()));
        }

        if !matches!(file.kind, FileKind::Jpg) {
            return Ok(None);
        }

        write_jpg_thumbnail(&source, &cache_path, size)?;
        let _ = cache::enforce_thumbnail_cache_limit(
            &thumbnail_dir,
            cache::THUMBNAIL_CACHE_LIMIT_BYTES,
        );
        Ok(Some(cache_path.to_string_lossy().to_string()))
    })
    .await
    .map_err(|error| error.to_string())?
}

fn write_jpg_thumbnail(source: &PathBuf, cache_path: &PathBuf, size: u32) -> Result<(), String> {
    let image = ImageReader::open(source)
        .map_err(|error| error.to_string())?
        .with_guessed_format()
        .map_err(|error| error.to_string())?
        .decode()
        .map_err(|error| error.to_string())?;
    let thumbnail = image.thumbnail(size, size);
    let output = File::create(cache_path).map_err(|error| error.to_string())?;
    let mut writer = BufWriter::new(output);
    let mut encoder = JpegEncoder::new_with_quality(&mut writer, 78);
    encoder
        .encode_image(&thumbnail)
        .map_err(|error| error.to_string())
}
