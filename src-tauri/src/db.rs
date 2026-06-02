mod files;
mod groups;
mod operations;
mod schema;
mod summary;

use crate::models::{FileKind, PhotoFile, PhotoGroup};
use rusqlite::{Connection, OptionalExtension};
use std::path::PathBuf;

#[derive(Clone)]
pub struct Database {
    path: PathBuf,
}

impl Database {
    pub fn new(path: PathBuf) -> rusqlite::Result<Self> {
        Ok(Self { path })
    }

    pub(super) fn connect(&self) -> rusqlite::Result<Connection> {
        let conn = Connection::open(&self.path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        Ok(conn)
    }
}

pub(super) fn query_group_by_id(
    conn: &Connection,
    id: &str,
) -> rusqlite::Result<Option<PhotoGroup>> {
    conn.query_row(
        "SELECT id, root_path, stem, folder_name, capture_time, camera_model, lens,
                preview_path, total_size, raw_count, jpg_count, video_count, sidecar_count
         FROM photo_groups WHERE id = ?1",
        rusqlite::params![id],
        map_group,
    )
    .optional()
}

pub(super) fn map_group(row: &rusqlite::Row<'_>) -> rusqlite::Result<PhotoGroup> {
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
        video_count: row.get(11)?,
        sidecar_count: row.get(12)?,
    })
}

pub(super) fn map_file(row: &rusqlite::Row<'_>) -> rusqlite::Result<PhotoFile> {
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
            "video" => FileKind::Video,
            "sidecar" => FileKind::Sidecar,
            _ => FileKind::Other,
        },
        size: row.get::<_, i64>(6)? as u64,
        modified_secs: row.get(7)?,
        width: row.get(8)?,
        height: row.get(9)?,
    })
}
