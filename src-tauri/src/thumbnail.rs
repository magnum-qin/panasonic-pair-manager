use crate::cache;
use crate::models::{FileKind, ThumbnailCacheStats};
use crate::state::AppState;
use image::codecs::jpeg::JpegEncoder;
use image::ImageReader;
use sha1::{Digest, Sha1};
use std::fmt::Write as _;
use std::fs;
use std::fs::File;
use std::io::{BufReader, BufWriter, Write};
use std::path::PathBuf;
use std::process::Command;
use tauri::State;

#[tauri::command]
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
pub(crate) async fn get_video_thumbnail(
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
            .find(|file| matches!(file.kind, FileKind::Video))
        else {
            return Ok(None);
        };

        let source = PathBuf::from(&file.path);
        if !source.exists() {
            return Ok(None);
        }

        std::fs::create_dir_all(&thumbnail_dir).map_err(|error| error.to_string())?;
        let size = max_size.clamp(160, 2400);
        let cache_path = thumbnail_dir.join(format!(
            "video-{}-{}-{}.jpg",
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
        if write_ffmpeg_video_thumbnail(&source, &cache_path, size).is_ok() {
            return Ok(Some(cache_path.to_string_lossy().to_string()));
        }

        Ok(None)
    })
    .await
    .map_err(|error| error.to_string())?
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

fn write_ffmpeg_video_thumbnail(
    source: &PathBuf,
    cache_path: &PathBuf,
    size: u32,
) -> Result<(), String> {
    let output = Command::new("ffmpeg")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg("-y")
        .arg("-ss")
        .arg("00:00:01")
        .arg("-i")
        .arg(source)
        .arg("-frames:v")
        .arg("1")
        .arg("-vf")
        .arg(format!("scale=min({size}\\,iw):-2"))
        .arg("-q:v")
        .arg("4")
        .arg(cache_path)
        .output()
        .map_err(|error| error.to_string())?;

    if output.status.success() && cache_path.exists() {
        return Ok(());
    }

    let _ = std::fs::remove_file(cache_path);
    Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
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
    sha1_hex(hasher)
}

fn sha1_hex(hasher: Sha1) -> String {
    let mut output = String::with_capacity(40);
    for byte in hasher.finalize() {
        write!(&mut output, "{byte:02x}").expect("writing to string cannot fail");
    }
    output
}
