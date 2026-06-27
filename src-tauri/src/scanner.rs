use crate::db::Database;
use crate::models::{ScanProgress, ScanSummary};
#[cfg(test)]
use std::path::Path;
use std::path::PathBuf;

mod grouping;
mod summary;
#[cfg(test)]
mod tests;
mod types;

use grouping::build_groups_with_progress;
use summary::summarize;
pub use types::{ScannedFile, ScannedGroup};

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
    on_progress(ScanProgress {
        root_path: root_path.to_string_lossy().to_string(),
        scanned_files: summary.files,
        matched_files: summary.raw_files + summary.jpg_files + summary.video_files,
        current_dir: root_path.to_string_lossy().to_string(),
        done: true,
    });
    Ok(summary)
}

#[cfg(test)]
fn build_groups(root_path: &Path) -> Vec<ScannedGroup> {
    build_groups_with_progress(root_path, &mut |_| {})
}
