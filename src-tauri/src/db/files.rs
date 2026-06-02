use super::{map_file, Database};
use crate::models::PhotoFile;
use rusqlite::{params, Connection};
use std::path::Path;

impl Database {
    pub fn replace_root_scan(
        &self,
        root_path: &Path,
        groups: &[crate::scanner::ScannedGroup],
    ) -> rusqlite::Result<()> {
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        let root = root_path.to_string_lossy().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        tx.execute(
            "INSERT INTO roots(path, last_scanned_at) VALUES (?1, ?2)
             ON CONFLICT(path) DO UPDATE SET last_scanned_at = excluded.last_scanned_at",
            params![root, now],
        )?;
        tx.execute(
            "DELETE FROM photo_files
             WHERE group_id IN (SELECT id FROM photo_groups WHERE root_path = ?1)",
            params![root],
        )?;
        tx.execute(
            "DELETE FROM photo_groups WHERE root_path = ?1",
            params![root],
        )?;

        for group in groups {
            tx.execute(
                "INSERT INTO photo_groups(
                    id, root_path, stem, folder_name, capture_time, camera_model, lens,
                    preview_path, total_size, raw_count, jpg_count, video_count, sidecar_count, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                params![
                    group.id,
                    root,
                    group.stem,
                    group.folder_name,
                    group.capture_time,
                    group.camera_model,
                    group.lens,
                    group.preview_path,
                    group.total_size as i64,
                    group.raw_count,
                    group.jpg_count,
                    group.video_count,
                    group.sidecar_count,
                    now
                ],
            )?;

            for file in &group.files {
                tx.execute(
                    "INSERT INTO photo_files(
                       group_id, path, file_name, extension, kind, size, modified_secs, width, height
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        group.id,
                        file.path,
                        file.file_name,
                        file.extension,
                        file.kind.as_str(),
                        file.size as i64,
                        file.modified_secs,
                        file.width,
                        file.height
                    ],
                )?;
            }
        }

        tx.commit()
    }

    pub fn files_for_groups(&self, ids: &[String]) -> rusqlite::Result<Vec<PhotoFile>> {
        let conn = self.connect()?;
        let mut files = Vec::new();
        for id in ids {
            let mut group_files = files_for_group(&conn, id)?;
            files.append(&mut group_files);
        }
        Ok(files)
    }
}

pub(super) fn files_for_group(conn: &Connection, id: &str) -> rusqlite::Result<Vec<PhotoFile>> {
    let mut stmt = conn.prepare(
        "SELECT id, group_id, path, file_name, extension, kind, size, modified_secs, width, height
         FROM photo_files WHERE group_id = ?1
         ORDER BY CASE kind WHEN 'raw' THEN 0 WHEN 'jpg' THEN 1 WHEN 'video' THEN 2 WHEN 'sidecar' THEN 3 ELSE 4 END, file_name",
    )?;
    let files = stmt
        .query_map(params![id], map_file)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(files)
}
