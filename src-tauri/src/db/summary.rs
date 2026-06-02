use super::Database;
use crate::models::ScanSummary;
use rusqlite::params;

impl Database {
    pub fn scan_summary_for_root(&self, root_path: &str) -> rusqlite::Result<ScanSummary> {
        let conn = self.connect()?;
        conn.query_row(
            "
            SELECT
              COALESCE(SUM(CASE WHEN raw_count > 0 OR jpg_count > 0 THEN 1 ELSE 0 END), 0),
              COALESCE(SUM(raw_count + jpg_count + video_count + sidecar_count), 0),
              COALESCE(SUM(raw_count), 0),
              COALESCE(SUM(jpg_count), 0),
              COALESCE(SUM(video_count), 0),
              COALESCE(SUM(sidecar_count), 0),
              COALESCE(SUM(CASE WHEN raw_count > 0 AND jpg_count > 0 THEN 1 ELSE 0 END), 0),
              COALESCE(SUM(CASE WHEN raw_count > 0 AND jpg_count = 0 THEN 1 ELSE 0 END), 0),
              COALESCE(SUM(CASE WHEN raw_count = 0 AND jpg_count > 0 THEN 1 ELSE 0 END), 0)
            FROM photo_groups
            WHERE root_path = ?1 AND (raw_count > 0 OR jpg_count > 0 OR video_count > 0)
            ",
            params![root_path],
            |row| {
                Ok(ScanSummary {
                    root_path: root_path.to_string(),
                    groups: row.get::<_, i64>(0)? as usize,
                    files: row.get::<_, i64>(1)? as usize,
                    raw_files: row.get::<_, i64>(2)? as usize,
                    jpg_files: row.get::<_, i64>(3)? as usize,
                    video_files: row.get::<_, i64>(4)? as usize,
                    sidecar_files: row.get::<_, i64>(5)? as usize,
                    other_files: 0,
                    paired_groups: row.get::<_, i64>(6)? as usize,
                    raw_only_groups: row.get::<_, i64>(7)? as usize,
                    jpg_only_groups: row.get::<_, i64>(8)? as usize,
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
}
