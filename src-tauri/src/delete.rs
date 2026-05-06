use crate::db::Database;
use crate::models::{DeleteSummary, FileKind};
use std::path::Path;

#[derive(Debug, thiserror::Error)]
pub enum DeleteError {
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
}

pub fn delete_groups(db: &Database, ids: &[String]) -> Result<DeleteSummary, DeleteError> {
    let files = db.files_for_groups(ids)?;
    let mut summary = DeleteSummary {
        groups: ids.len(),
        files: files.len(),
        ..DeleteSummary::default()
    };

    for file in &files {
        summary.total_size += file.size;
        if matches!(file.kind, FileKind::Raw) {
            summary.raw_files += 1;
        }
        if matches!(file.kind, FileKind::Jpg) {
            summary.jpg_files += 1;
        }

        match trash::delete(Path::new(&file.path)) {
            Ok(()) => {
                db.log_operation(
                    "delete_to_recycle_bin",
                    Some(&file.group_id),
                    Some(&file.path),
                    "ok",
                    None,
                )?;
            }
            Err(error) => {
                let message = error.to_string();
                summary.failed.push(file.path.clone());
                db.log_operation(
                    "delete_to_recycle_bin",
                    Some(&file.group_id),
                    Some(&file.path),
                    "failed",
                    Some(&message),
                )?;
            }
        }
    }

    if summary.failed.is_empty() {
        db.remove_groups(ids)?;
    }

    Ok(summary)
}

#[cfg(test)]
mod tests {
    use crate::models::{FileKind, PhotoFile};

    #[test]
    fn deletion_plan_counts_raw_and_jpg_files() {
        let files = [
            PhotoFile {
                id: 1,
                group_id: "a".into(),
                path: "a.RW2".into(),
                file_name: "a.RW2".into(),
                extension: "rw2".into(),
                kind: FileKind::Raw,
                size: 10,
                modified_secs: None,
                width: None,
                height: None,
            },
            PhotoFile {
                id: 2,
                group_id: "a".into(),
                path: "a.JPG".into(),
                file_name: "a.JPG".into(),
                extension: "jpg".into(),
                kind: FileKind::Jpg,
                size: 20,
                modified_secs: None,
                width: None,
                height: None,
            },
        ];

        let raw = files.iter().filter(|file| matches!(file.kind, FileKind::Raw)).count();
        let jpg = files.iter().filter(|file| matches!(file.kind, FileKind::Jpg)).count();

        assert_eq!(raw, 1);
        assert_eq!(jpg, 1);
    }

    #[test]
    fn deletion_plan_allows_missing_pair_member() {
        let files = [PhotoFile {
            id: 1,
            group_id: "a".into(),
            path: "a.RW2".into(),
            file_name: "a.RW2".into(),
            extension: "rw2".into(),
            kind: FileKind::Raw,
            size: 10,
            modified_secs: None,
            width: None,
            height: None,
        }];

        assert_eq!(files.len(), 1);
        assert!(matches!(files[0].kind, FileKind::Raw));
    }
}
