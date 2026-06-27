use crate::models::FileKind;

#[derive(Debug, Clone)]
pub struct ScannedFile {
    pub path: String,
    pub file_name: String,
    pub extension: String,
    pub kind: FileKind,
    pub size: u64,
    pub modified_secs: Option<i64>,
    pub width: Option<i64>,
    pub height: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct ScannedGroup {
    pub id: String,
    pub stem: String,
    pub folder_name: String,
    pub capture_time: Option<String>,
    pub camera_model: Option<String>,
    pub lens: Option<String>,
    pub preview_path: Option<String>,
    pub total_size: u64,
    pub raw_count: i64,
    pub jpg_count: i64,
    pub video_count: i64,
    pub sidecar_count: i64,
    pub files: Vec<ScannedFile>,
}
