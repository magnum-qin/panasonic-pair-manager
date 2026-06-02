use crate::db::Database;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

pub(crate) struct AppState {
    pub(crate) db: Database,
    pub(crate) thumbnail_dir: PathBuf,
    pub(crate) thumbnail_lock: Arc<Mutex<()>>,
}
