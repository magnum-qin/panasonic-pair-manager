use super::Database;

impl Database {
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
              video_count INTEGER NOT NULL DEFAULT 0,
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
        let has_video_count = {
            let mut stmt = conn.prepare("PRAGMA table_info(photo_groups)")?;
            let columns = stmt
                .query_map([], |row| row.get::<_, String>(1))?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            columns.iter().any(|column| column == "video_count")
        };
        if !has_video_count {
            conn.execute(
                "ALTER TABLE photo_groups ADD COLUMN video_count INTEGER NOT NULL DEFAULT 0",
                [],
            )?;
        }
        Ok(())
    }
}
