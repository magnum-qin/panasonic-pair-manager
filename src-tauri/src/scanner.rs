use crate::db::Database;
use crate::models::{FileKind, ScanProgress, ScanSummary};
use sha1::{Digest, Sha1};
use std::collections::BTreeMap;
use std::fmt::Write as _;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

#[derive(Debug, Clone)]
pub struct ScannedFile {
    pub path: String,
    pub file_name: String,
    pub extension: String,
    pub kind: FileKind,
    pub size: u64,
    pub modified_secs: Option<i64>,
    pub width: Option<i64>,
    pub height: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct ScannedGroup {
    pub id: String,
    pub stem: String,
    pub folder_name: String,
    pub capture_time: Option<String>,
    pub camera_model: Option<String>,
    pub lens: Option<String>,
    pub preview_path: Option<String>,
    pub total_size: u64,
    pub raw_count: i64,
    pub jpg_count: i64,
    pub video_count: i64,
    pub sidecar_count: i64,
    pub files: Vec<ScannedFile>,
}

#[derive(Debug, thiserror::Error)]
pub enum ScanError {
    #[error("folder does not exist: {0}")]
    MissingRoot(String),
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
}

pub fn scan_root_with_progress<F>(
    db: &Database,
    root_path: PathBuf,
    mut on_progress: F,
) -> Result<ScanSummary, ScanError>
where
    F: FnMut(ScanProgress),
{
    if !root_path.exists() {
        return Err(ScanError::MissingRoot(root_path.display().to_string()));
    }

    on_progress(ScanProgress {
        root_path: root_path.to_string_lossy().to_string(),
        scanned_files: 0,
        matched_files: 0,
        current_dir: root_path.to_string_lossy().to_string(),
        done: false,
    });
    let groups = build_groups_with_progress(&root_path, &mut on_progress);
    let summary = summarize(&root_path, &groups);
    db.replace_root_scan(&root_path, &groups)?;
    Ok(summary)
}

#[cfg(test)]
fn build_groups(root_path: &Path) -> Vec<ScannedGroup> {
    build_groups_with_progress(root_path, &mut |_| {})
}

fn build_groups_with_progress<F>(root_path: &Path, on_progress: &mut F) -> Vec<ScannedGroup>
where
    F: FnMut(ScanProgress),
{
    let mut grouped: BTreeMap<(PathBuf, String), Vec<ScannedFile>> = BTreeMap::new();
    let root = root_path.to_string_lossy().to_string();
    let mut scanned_files = 0usize;
    let mut matched_files = 0usize;
    let mut last_dir = root.clone();

    for entry in WalkDir::new(root_path)
        .follow_links(false)
        .into_iter()
        .flatten()
    {
        if !entry.file_type().is_file() {
            continue;
        }

        let path = entry.path();
        scanned_files += 1;
        if let Some(parent) = path.parent() {
            last_dir = parent.to_string_lossy().to_string();
        }
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        let kind = FileKind::from_extension(&extension);
        if scanned_files == 1 || scanned_files.is_multiple_of(250) {
            on_progress(ScanProgress {
                root_path: root.clone(),
                scanned_files,
                matched_files,
                current_dir: last_dir.clone(),
                done: false,
            });
        }
        if matches!(kind, FileKind::Other) {
            continue;
        }
        matched_files += 1;

        let Some(stem) = path.file_stem().and_then(|value| value.to_str()) else {
            continue;
        };
        let Some(parent) = path.parent() else {
            continue;
        };
        let metadata = entry.metadata().ok();
        let modified_secs = metadata
            .as_ref()
            .and_then(|data| data.modified().ok())
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs() as i64);

        grouped
            .entry((parent.to_path_buf(), stem.to_ascii_uppercase()))
            .or_default()
            .push(ScannedFile {
                path: path.to_string_lossy().to_string(),
                file_name: path
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or_default()
                    .to_string(),
                extension,
                kind,
                size: metadata.map(|data| data.len()).unwrap_or_default(),
                modified_secs,
                width: None,
                height: None,
            });
    }

    on_progress(ScanProgress {
        root_path: root.clone(),
        scanned_files,
        matched_files,
        current_dir: last_dir,
        done: false,
    });

    grouped
        .into_iter()
        .map(|((folder, stem), files)| build_group(root_path, folder, stem, files))
        .filter(|group| group.raw_count > 0 || group.jpg_count > 0 || group.video_count > 0)
        .collect()
}

fn build_group(
    root_path: &Path,
    folder: PathBuf,
    stem: String,
    mut files: Vec<ScannedFile>,
) -> ScannedGroup {
    files.sort_by_key(|file| match file.kind {
        FileKind::Raw => 0,
        FileKind::Jpg => 1,
        FileKind::Video => 2,
        FileKind::Sidecar => 3,
        FileKind::Other => 3,
    });

    let raw_count = files
        .iter()
        .filter(|file| matches!(file.kind, FileKind::Raw))
        .count() as i64;
    let jpg_count = files
        .iter()
        .filter(|file| matches!(file.kind, FileKind::Jpg))
        .count() as i64;
    let sidecar_count = files
        .iter()
        .filter(|file| matches!(file.kind, FileKind::Sidecar))
        .count() as i64;
    let video_count = files
        .iter()
        .filter(|file| matches!(file.kind, FileKind::Video))
        .count() as i64;
    let preview_path = files
        .iter()
        .find(|file| matches!(file.kind, FileKind::Jpg))
        .map(|file| file.path.clone());

    ScannedGroup {
        id: group_id(root_path, &folder, &stem),
        stem,
        folder_name: folder
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string(),
        capture_time: None,
        camera_model: None,
        lens: None,
        preview_path,
        total_size: files.iter().map(|file| file.size).sum(),
        raw_count,
        jpg_count,
        video_count,
        sidecar_count,
        files,
    }
}

fn summarize(root_path: &Path, groups: &[ScannedGroup]) -> ScanSummary {
    let mut summary = ScanSummary {
        root_path: root_path.to_string_lossy().to_string(),
        groups: groups.len(),
        ..ScanSummary::default()
    };

    for group in groups {
        summary.files += group.files.len();
        summary.raw_files += group.raw_count as usize;
        summary.jpg_files += group.jpg_count as usize;
        summary.video_files += group.video_count as usize;
        summary.sidecar_files += group.sidecar_count as usize;
        if group.raw_count > 0 && group.jpg_count > 0 {
            summary.paired_groups += 1;
        } else if group.raw_count > 0 {
            summary.raw_only_groups += 1;
        } else if group.jpg_count > 0 {
            summary.jpg_only_groups += 1;
        }
    }
    summary
}

fn group_id(root_path: &Path, folder: &Path, stem: &str) -> String {
    let mut hasher = Sha1::new();
    hasher.update(root_path.to_string_lossy().as_bytes());
    hasher.update(b"|");
    hasher.update(folder.to_string_lossy().as_bytes());
    hasher.update(b"|");
    hasher.update(stem.as_bytes());
    sha1_hex(hasher)
}

fn sha1_hex(hasher: Sha1) -> String {
    let mut output = String::with_capacity(40);
    for byte in hasher.finalize() {
        write!(&mut output, "{byte:02x}").expect("writing to string cannot fail");
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn groups_rw2_and_jpg_with_same_stem_case_insensitively() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("P1000001.RW2"), b"raw").unwrap();
        fs::write(dir.path().join("P1000001.jpg"), b"jpg").unwrap();

        let groups = build_groups(dir.path());

        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].raw_count, 1);
        assert_eq!(groups[0].jpg_count, 1);
    }

    #[test]
    fn unrelated_jpg_does_not_group_with_different_raw() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("P1000001.RW2"), b"raw").unwrap();
        fs::write(dir.path().join("P1000002.JPG"), b"jpg").unwrap();

        let groups = build_groups(dir.path());

        assert_eq!(groups.len(), 2);
        assert!(groups
            .iter()
            .any(|group| group.raw_count == 1 && group.jpg_count == 0));
        assert!(groups
            .iter()
            .any(|group| group.raw_count == 0 && group.jpg_count == 1));
    }

    #[test]
    fn scans_nested_panasonic_folders() {
        let dir = tempdir().unwrap();
        fs::create_dir_all(dir.path().join("DCIM").join("103_PANA")).unwrap();
        fs::create_dir_all(dir.path().join("DCIM").join("104_PANA")).unwrap();
        fs::write(
            dir.path()
                .join("DCIM")
                .join("103_PANA")
                .join("P1000001.RW2"),
            b"raw",
        )
        .unwrap();
        fs::write(
            dir.path()
                .join("DCIM")
                .join("104_PANA")
                .join("P1000002.JPG"),
            b"jpg",
        )
        .unwrap();

        let groups = build_groups(dir.path());

        assert_eq!(groups.len(), 2);
        assert!(groups.iter().any(|group| group.folder_name == "103_PANA"));
        assert!(groups.iter().any(|group| group.folder_name == "104_PANA"));
    }

    #[test]
    fn ignores_sidecar_without_photo() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("P1000001.XMP"), b"xmp").unwrap();
        fs::write(dir.path().join("P1000002.RW2"), b"raw").unwrap();
        fs::write(dir.path().join("P1000002.XMP"), b"xmp").unwrap();

        let groups = build_groups(dir.path());

        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].stem, "P1000002");
        assert_eq!(groups[0].raw_count, 1);
        assert_eq!(groups[0].sidecar_count, 1);
    }
}
