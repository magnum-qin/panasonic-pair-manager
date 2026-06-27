use crate::models::ThumbnailCacheStats;
use std::fs;
use std::path::PathBuf;

pub(crate) const THUMBNAIL_CACHE_LIMIT_BYTES: u64 = 512 * 1024 * 1024;

pub(crate) fn thumbnail_cache_stats(
    thumbnail_dir: &PathBuf,
) -> Result<ThumbnailCacheStats, String> {
    let mut stats = ThumbnailCacheStats {
        limit_bytes: THUMBNAIL_CACHE_LIMIT_BYTES,
        ..ThumbnailCacheStats::default()
    };
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

pub(crate) fn enforce_thumbnail_cache_limit(
    thumbnail_dir: &PathBuf,
    limit_bytes: u64,
) -> Result<(), String> {
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
        if std::fs::remove_file(&path).is_ok() {
            total = total.saturating_sub(size);
        }
    }

    Ok(())
}
