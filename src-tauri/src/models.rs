use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FileKind {
    Raw,
    Jpg,
    Sidecar,
    Other,
}

impl FileKind {
    pub fn from_extension(extension: &str) -> Self {
        match extension.to_ascii_lowercase().as_str() {
            "rw2" | "raw" | "dng" | "raf" | "arw" | "cr2" | "cr3" | "nef" | "orf" => Self::Raw,
            "jpg" | "jpeg" => Self::Jpg,
            "xmp" => Self::Sidecar,
            _ => Self::Other,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Raw => "raw",
            Self::Jpg => "jpg",
            Self::Sidecar => "sidecar",
            Self::Other => "other",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhotoFile {
    pub id: i64,
    pub group_id: String,
    pub path: String,
    pub file_name: String,
    pub extension: String,
    pub kind: FileKind,
    pub size: u64,
    pub modified_secs: Option<i64>,
    pub width: Option<i64>,
    pub height: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhotoGroup {
    pub id: String,
    pub root_path: String,
    pub stem: String,
    pub folder_name: String,
    pub capture_time: Option<String>,
    pub camera_model: Option<String>,
    pub lens: Option<String>,
    pub preview_path: Option<String>,
    pub total_size: u64,
    pub raw_count: i64,
    pub jpg_count: i64,
    pub sidecar_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhotoGroupDetail {
    #[serde(flatten)]
    pub group: PhotoGroup,
    pub files: Vec<PhotoFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PhotoGroupMetadata {
    pub available: bool,
    pub source_path: Option<String>,
    pub error: Option<String>,
    pub capture_time: Option<String>,
    pub camera_model: Option<String>,
    pub lens: Option<String>,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub items: Vec<PhotoMetadataItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PhotoMetadataItem {
    pub tag: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PhotoGroupFilter {
    pub root_path: Option<String>,
    pub query: Option<String>,
    pub group_kind: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScanSummary {
    pub root_path: String,
    pub groups: usize,
    pub files: usize,
    pub raw_files: usize,
    pub jpg_files: usize,
    pub sidecar_files: usize,
    pub other_files: usize,
    pub paired_groups: usize,
    pub raw_only_groups: usize,
    pub jpg_only_groups: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub root_path: String,
    pub scanned_files: usize,
    pub matched_files: usize,
    pub current_dir: String,
    pub done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailCacheStats {
    pub files: usize,
    pub bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSummary {
    pub groups: usize,
    pub files: usize,
    pub raw_files: usize,
    pub jpg_files: usize,
    pub total_size: u64,
    pub failed: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DriveCandidate {
    pub drive_path: String,
    pub scan_path: String,
    pub display_name: String,
    pub has_dcim: bool,
    pub has_panasonic_folders: bool,
}
