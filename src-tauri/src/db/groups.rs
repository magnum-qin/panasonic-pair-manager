use super::{map_group, query_group_by_id, Database};
use crate::models::{PhotoGroup, PhotoGroupDetail, PhotoGroupFilter};
use rusqlite::{params, Connection};

impl Database {
    pub fn list_photo_groups(
        &self,
        filter: &PhotoGroupFilter,
    ) -> rusqlite::Result<Vec<PhotoGroup>> {
        let conn = self.connect()?;
        let limit = filter.limit.unwrap_or(500).min(2000);
        let offset = filter.offset.unwrap_or(0);
        let query = filter.query.as_ref().map(|value| format!("%{}%", value));
        let kind_clause = group_kind_clause(filter);
        let order_clause = photo_group_order_clause(filter.sort.as_deref());

        match (&filter.root_path, &query) {
            (Some(root), Some(query)) => query_groups(
                &conn,
                &format!("WHERE root_path = ?1 AND stem LIKE ?2{kind_clause} {order_clause} LIMIT ?3 OFFSET ?4"),
                params![root, query, limit, offset],
            ),
            (Some(root), None) => query_groups(
                &conn,
                &format!("WHERE root_path = ?1{kind_clause} {order_clause} LIMIT ?2 OFFSET ?3"),
                params![root, limit, offset],
            ),
            (None, Some(query)) => query_groups(
                &conn,
                &format!("WHERE stem LIKE ?1{kind_clause} {order_clause} LIMIT ?2 OFFSET ?3"),
                params![query, limit, offset],
            ),
            (None, None) => query_groups(
                &conn,
                &format!("{} {order_clause} LIMIT ?1 OFFSET ?2", group_kind_where(filter)),
                params![limit, offset],
            ),
        }
    }

    pub fn count_photo_groups(&self, filter: &PhotoGroupFilter) -> rusqlite::Result<usize> {
        let conn = self.connect()?;
        let query = filter.query.as_ref().map(|value| format!("%{}%", value));
        let kind_clause = group_kind_clause(filter);

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
            (None, None) => query_group_count(&conn, group_kind_where(filter), params![])?,
        };
        Ok(count as usize)
    }

    pub fn get_photo_group(&self, id: &str) -> rusqlite::Result<PhotoGroupDetail> {
        let conn = self.connect()?;
        let group = query_group_by_id(&conn, id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)?;
        let files = super::files::files_for_group(&conn, id)?;
        Ok(PhotoGroupDetail { group, files })
    }
}

fn query_groups<P: rusqlite::Params>(
    conn: &Connection,
    suffix: &str,
    params: P,
) -> rusqlite::Result<Vec<PhotoGroup>> {
    let sql = format!(
        "SELECT id, root_path, stem, folder_name, capture_time, camera_model, lens,
                preview_path, total_size, raw_count, jpg_count, video_count, sidecar_count
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

fn photo_group_order_clause(sort: Option<&str>) -> &'static str {
    match sort {
        Some("captureDesc") => "ORDER BY capture_time IS NULL, capture_time DESC, stem DESC",
        Some("nameAsc") => "ORDER BY stem COLLATE NOCASE ASC, capture_time IS NULL, capture_time",
        Some("nameDesc") => {
            "ORDER BY stem COLLATE NOCASE DESC, capture_time IS NULL, capture_time DESC"
        }
        Some("sizeDesc") => "ORDER BY total_size DESC, capture_time IS NULL, capture_time, stem",
        Some("sizeAsc") => "ORDER BY total_size ASC, capture_time IS NULL, capture_time, stem",
        _ => "ORDER BY capture_time IS NULL, capture_time, stem",
    }
}

fn group_kind_clause(filter: &PhotoGroupFilter) -> &'static str {
    match filter.group_kind.as_deref() {
        Some("paired") => " AND raw_count > 0 AND jpg_count > 0",
        Some("rawOnly") => " AND raw_count > 0 AND jpg_count = 0",
        Some("jpgOnly") => " AND raw_count = 0 AND jpg_count > 0",
        _ if matches!(filter.media_kind.as_deref(), Some("videos")) => " AND video_count > 0",
        _ => " AND (raw_count > 0 OR jpg_count > 0)",
    }
}

fn group_kind_where(filter: &PhotoGroupFilter) -> &'static str {
    match filter.group_kind.as_deref() {
        Some("paired") => "WHERE raw_count > 0 AND jpg_count > 0",
        Some("rawOnly") => "WHERE raw_count > 0 AND jpg_count = 0",
        Some("jpgOnly") => "WHERE raw_count = 0 AND jpg_count > 0",
        _ if matches!(filter.media_kind.as_deref(), Some("videos")) => "WHERE video_count > 0",
        _ => "WHERE raw_count > 0 OR jpg_count > 0",
    }
}
