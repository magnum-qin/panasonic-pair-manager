use super::ScannedGroup;
use crate::models::ScanSummary;
use std::path::Path;

pub(super) fn summarize(root_path: &Path, groups: &[ScannedGroup]) -> ScanSummary {
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
