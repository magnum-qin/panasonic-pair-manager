use crate::models::DriveCandidate;
use std::path::{Path, PathBuf};

#[cfg(target_os = "windows")]
pub fn list_removable_roots() -> Vec<DriveCandidate> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::GetDriveTypeW;

    const DRIVE_REMOVABLE: u32 = 2;

    ('A'..='Z')
        .filter_map(|letter| {
            let drive_path = format!("{}:\\", letter);
            let wide: Vec<u16> = std::ffi::OsStr::new(&drive_path)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            let drive_type = unsafe { GetDriveTypeW(wide.as_ptr()) };
            if drive_type != DRIVE_REMOVABLE {
                return None;
            }

            let drive = PathBuf::from(&drive_path);
            if !drive.exists() || !is_drive_ready(&drive) {
                return None;
            }

            Some(candidate_for_drive(letter, &drive))
        })
        .collect()
}

#[cfg(not(target_os = "windows"))]
pub fn list_removable_roots() -> Vec<DriveCandidate> {
    Vec::new()
}

fn is_drive_ready(drive: &Path) -> bool {
    std::fs::read_dir(drive).is_ok()
}

fn candidate_for_drive(letter: char, drive: &Path) -> DriveCandidate {
    let dcim = drive.join("DCIM");
    let has_dcim = dcim.is_dir();
    let has_panasonic_folders =
        contains_panasonic_folder(drive) || (has_dcim && contains_panasonic_folder(&dcim));

    DriveCandidate {
        drive_path: drive.to_string_lossy().to_string(),
        scan_path: drive.to_string_lossy().to_string(),
        display_name: format!("SD Card ({letter}:)"),
        has_dcim,
        has_panasonic_folders,
    }
}

fn contains_panasonic_folder(path: &Path) -> bool {
    let Ok(entries) = std::fs::read_dir(path) else {
        return false;
    };

    entries.flatten().any(|entry| {
        entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false)
            && entry
                .file_name()
                .to_string_lossy()
                .to_ascii_uppercase()
                .ends_with("_PANA")
    })
}

#[cfg(test)]
mod tests {
    use super::contains_panasonic_folder;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn detects_panasonic_folder_names() {
        let dir = tempdir().unwrap();
        fs::create_dir(dir.path().join("103_PANA")).unwrap();

        assert!(contains_panasonic_folder(dir.path()));
    }
}
