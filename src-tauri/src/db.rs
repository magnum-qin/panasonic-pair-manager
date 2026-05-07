use crate::models::{
    FileKind, PhotoFile, PhotoGroup, PhotoGroupDetail, PhotoGroupFilter, ScanSummary,
};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::{Path, PathBuf};

#[derive(Clone)]
pub struct Database {
    path: PathBuf,
}

impl Database {
    pub fn new(path: PathBuf) -> rusqlite::Result<Self> {
        Ok(Self { path })
    }

    fn connect(&self) -> rusqlite::Result<Connection> {
        let conn = Connection::open(&self.path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        Ok(conn)
    }

    pub fn migrate(&self) -> rusqlite::Result<()> {
        let conn = self.connect()?;
        conn.execute_batch(
            "
            PRAGMA foreign_keys = ON;
            CREATE TABLE IF NOT EXISTS roots (
              path TEXT PRIMARY KEY,
              last_scanned_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS photo_groups (
              id TEXT PRIMARY KEY,
              root_path TEXT NOT NULL,
              stem TEXT NOT NULL,
              folder_name TEXT NOT NULL,
              capture_time TEXT,
              camera_model TEXT,
              lens TEXT,
              preview_path TEXT,
              total_size INTEGER NOT NULL,
              raw_count INTEGER NOT NULL,
              jpg_count INTEGER NOT NULL,
              sidecar_count INTEGER NOT NULL,
              updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_photo_groups_root ON photo_groups(root_path);
            CREATE TABLE IF NOT EXISTS photo_files (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              group_id TEXT NOT NULL,
              path TEXT NOT NULL UNIQUE,
              file_name TEXT NOT NULL,
              extension TEXT NOT NULL,
              kind TEXT NOT NULL,
              size INTEGER NOT NULL,
              modified_secs INTEGER,
              width INTEGER,
              height INTEGER,
              FOREIGN KEY(group_id) REFERENCES photo_groups(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_photo_files_group ON photo_files(group_id);
            CREATE TABLE IF NOT EXISTS operation_log (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              operation TEXT NOT NULL,
              group_id TEXT,
              path TEXT,
              status TEXT NOT NULL,
              message TEXT,
              created_at TEXT NOT NULL
            );
            ",
        )?;
        Ok(())
    }

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
                    preview_path, total_size, raw_count, jpg_count, sidecar_count, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
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

    pub fn list_photo_groups(
        &self,
        filter: &PhotoGroupFilter,
    ) -> rusqlite::Result<Vec<PhotoGroup>> {
        let conn = self.connect()?;
        let limit = filter.limit.unwrap_or(500).min(2000);
        let offset = filter.offset.unwrap_or(0);
        let query = filter.query.as_ref().map(|value| format!("%{}%", value));
        let kind_clause = match filter.group_kind.as_deref() {
            Some("paired") => " AND raw_count > 0 AND jpg_count > 0",
            Some("rawOnly") => " AND raw_count > 0 AND jpg_count = 0",
            Some("jpgOnly") => " AND raw_count = 0 AND jpg_count > 0",
            _ => "",
        };

        match (&filter.root_path, &query) {
            (Some(root), Some(query)) => query_groups(
                &conn,
                &format!("WHERE root_path = ?1 AND stem LIKE ?2{kind_clause} ORDER BY capture_time IS NULL, capture_time, stem LIMIT ?3 OFFSET ?4"),
                params![root, query, limit, offset],
            ),
            (Some(root), None) => query_groups(
                &conn,
                &format!("WHERE root_path = ?1{kind_clause} ORDER BY capture_time IS NULL, capture_time, stem LIMIT ?2 OFFSET ?3"),
                params![root, limit, offset],
            ),
            (None, Some(query)) => query_groups(
                &conn,
                &format!("WHERE stem LIKE ?1{kind_clause} ORDER BY capture_time IS NULL, capture_time, stem LIMIT ?2 OFFSET ?3"),
                params![query, limit, offset],
            ),
            (None, None) => query_groups(
                &conn,
                &format!(
                    "{} ORDER BY capture_time IS NULL, capture_time, stem LIMIT ?1 OFFSET ?2",
                    match filter.group_kind.as_deref() {
                        Some("paired") => "WHERE raw_count > 0 AND jpg_count > 0",
                        Some("rawOnly") => "WHERE raw_count > 0 AND jpg_count = 0",
                        Some("jpgOnly") => "WHERE raw_count = 0 AND jpg_count > 0",
                        _ => "",
                    }
                ),
                params![limit, offset],
            ),
        }
    }

    pub fn count_photo_groups(&self, filter: &PhotoGroupFilter) -> rusqlite::Result<usize> {
        let conn = self.connect()?;
        let query = filter.query.as_ref().map(|value| format!("%{}%", value));
        let kind_clause = match filter.group_kind.as_deref() {
            Some("paired") => " AND raw_count > 0 AND jpg_count > 0",
            Some("rawOnly") => " AND raw_count > 0 AND jpg_count = 0",
            Some("jpgOnly") => " AND raw_count = 0 AND jpg_count > 0",
            _ => "",
        };

        let count = match (&filter.root_path, &query) {
            (Some(root), Some(query)) => query_group_count(
                &conn,
                &format!("WHERE root_path = ?1 AND stem LIKE ?2{kind_clause}"),
                params![root, query],
            )?,
            (Some(root), None) => query_group_count(
                &conn,
                &format!("WHERE root_path = ?1{kind_clause}"),
                params![root],
            )?,
            (None, Some(query)) => query_group_count(
                &conn,
                &format!("WHERE stem LIKE ?1{kind_clause}"),
                params![query],
            )?,
            (None, None) => query_group_count(
                &conn,
                match filter.group_kind.as_deref() {
                    Some("paired") => "WHERE raw_count > 0 AND jpg_count > 0",
                    Some("rawOnly") => "WHERE raw_count > 0 AND jpg_count = 0",
                    Some("jpgOnly") => "WHERE raw_count = 0 AND jpg_count > 0",
                    _ => "",
                },
                params![],
            )?,
        };
        Ok(count as usize)
    }

    pub fn scan_summary_for_root(&self, root_path: &str) -> rusqlite::Result<ScanSummary> {
        let conn = self.connect()?;
        conn.query_row(
            "
            SELECT
              COUNT(*),
              COALESCE(SUM(raw_count + jpg_count + sidecar_count), 0),
              COALESCE(SUM(raw_count), 0),
              COALESCE(SUM(jpg_count), 0),
              COALESCE(SUM(sidecar_count), 0),
              COALESCE(SUM(CASE WHEN raw_count > 0 AND jpg_count > 0 THEN 1 ELSE 0 END), 0),
              COALESCE(SUM(CASE WHEN raw_count > 0 AND jpg_count = 0 THEN 1 ELSE 0 END), 0),
              COALESCE(SUM(CASE WHEN raw_count = 0 AND jpg_count > 0 THEN 1 ELSE 0 END), 0)
            FROM photo_groups
            WHERE root_path = ?1
            ",
            params![root_path],
            |row| {
                Ok(ScanSummary {
                    root_path: root_path.to_string(),
                    groups: row.get::<_, i64>(0)? as usize,
                    files: row.get::<_, i64>(1)? as usize,
                    raw_files: row.get::<_, i64>(2)? as usize,
                    jpg_files: row.get::<_, i64>(3)? as usize,
                    sidecar_files: row.get::<_, i64>(4)? as usize,
                    other_files: 0,
                    paired_groups: row.get::<_, i64>(5)? as usize,
                    raw_only_groups: row.get::<_, i64>(6)? as usize,
                    jpg_only_groups: row.get::<_, i64>(7)? as usize,
                })
            },
        )
    }

    pub fn has_scan_for_root(&self, root_path: &str) -> rusqlite::Result<bool> {
        let conn = self.connect()?;
        conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM roots WHERE path = ?1)",
            params![root_path],
            |row| row.get::<_, i64>(0).map(|value| value != 0),
        )
    }

    pub fn get_photo_group(&self, id: &str) -> rusqlite::Result<PhotoGroupDetail> {
        let conn = self.connect()?;
        let group = query_group_by_id(&conn, id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)?;
        let mut stmt = conn.prepare(
            "SELECT id, group_id, path, file_name, extension, kind, size, modified_secs, width, height
             FROM photo_files WHERE group_id = ?1
             ORDER BY CASE kind WHEN 'raw' THEN 0 WHEN 'jpg' THEN 1 WHEN 'sidecar' THEN 2 ELSE 3 END, file_name",
        )?;
        let files = stmt
            .query_map(params![id], map_file)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(PhotoGroupDetail { group, files })
    }

    pub fn files_for_groups(&self, ids: &[String]) -> rusqlite::Result<Vec<PhotoFile>> {
        let conn = self.connect()?;
        let mut files = Vec::new();
        for id in ids {
            let mut stmt = conn.prepare(
                "SELECT id, group_id, path, file_name, extension, kind, size, modified_secs, width, height
                 FROM photo_files WHERE group_id = ?1",
            )?;
            let mut group_files = stmt
                .query_map(params![id], map_file)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            files.append(&mut group_files);
        }
        Ok(files)
    }

    pub fn remove_groups(&self, ids: &[String]) -> rusqlite::Result<()> {
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        for id in ids {
            tx.execute("DELETE FROM photo_groups WHERE id = ?1", params![id])?;
        }
        tx.commit()
    }

    pub fn log_operation(
        &self,
        operation: &str,
        group_id: Option<&str>,
        path: Option<&str>,
        status: &str,
        message: Option<&str>,
    ) -> rusqlite::Result<()> {
        let conn = self.connect()?;
        conn.execute(
            "INSERT INTO operation_log(operation, group_id, path, status, message, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                operation,
                group_id,
                path,
                status,
                message,
                chrono::Utc::now().to_rfc3339()
            ],
        )?;
        Ok(())
    }
}

fn query_groups<P: rusqlite::Params>(
    conn: &Connection,
    suffix: &str,
    params: P,
) -> rusqlite::Result<Vec<PhotoGroup>> {
    let sql = format!(
        "SELECT id, root_path, stem, folder_name, capture_time, camera_model, lens,
                preview_path, total_size, raw_count, jpg_count, sidecar_count
         FROM photo_groups {}",
        suffix
    );
    let mut stmt = conn.prepare(&sql)?;
    let groups = stmt
        .query_map(params, map_group)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(groups)
}

fn query_group_count<P: rusqlite::Params>(
    conn: &Connection,
    suffix: &str,
    params: P,
) -> rusqlite::Result<i64> {
    let sql = format!("SELECT COUNT(*) FROM photo_groups {suffix}");
    conn.query_row(&sql, params, |row| row.get(0))
}

fn query_group_by_id(conn: &Connection, id: &str) -> rusqlite::Result<Option<PhotoGroup>> {
    conn.query_row(
        "SELECT id, root_path, stem, folder_name, capture_time, camera_model, lens,
                preview_path, total_size, raw_count, jpg_count, sidecar_count
         FROM photo_groups WHERE id = ?1",
        params![id],
        map_group,
    )
    .optional()
}

fn map_group(row: &rusqlite::Row<'_>) -> rusqlite::Result<PhotoGroup> {
    Ok(PhotoGroup {
        id: row.get(0)?,
        root_path: row.get(1)?,
        stem: row.get(2)?,
        folder_name: row.get(3)?,
        capture_time: row.get(4)?,
        camera_model: row.get(5)?,
        lens: row.get(6)?,
        preview_path: row.get(7)?,
        total_size: row.get::<_, i64>(8)? as u64,
        raw_count: row.get(9)?,
        jpg_count: row.get(10)?,
        sidecar_count: row.get(11)?,
    })
}

fn map_file(row: &rusqlite::Row<'_>) -> rusqlite::Result<PhotoFile> {
    let kind: String = row.get(5)?;
    Ok(PhotoFile {
        id: row.get(0)?,
        group_id: row.get(1)?,
        path: row.get(2)?,
        file_name: row.get(3)?,
        extension: row.get(4)?,
        kind: match kind.as_str() {
            "raw" => FileKind::Raw,
            "jpg" => FileKind::Jpg,
            "sidecar" => FileKind::Sidecar,
            _ => FileKind::Other,
        },
        size: row.get::<_, i64>(6)? as u64,
        modified_secs: row.get(7)?,
        width: row.get(8)?,
        height: row.get(9)?,
    })
}
