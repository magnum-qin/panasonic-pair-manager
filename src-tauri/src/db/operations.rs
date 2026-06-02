use super::Database;
use rusqlite::params;

impl Database {
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
