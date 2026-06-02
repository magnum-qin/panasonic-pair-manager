use super::*;
use std::fs;
use tempfile::tempdir;

#[test]
fn groups_rw2_and_jpg_with_same_stem_case_insensitively() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("P1000001.RW2"), b"raw").unwrap();
    fs::write(dir.path().join("P1000001.jpg"), b"jpg").unwrap();

    let groups = build_groups(dir.path());

    assert_eq!(groups.len(), 1);
    assert_eq!(groups[0].raw_count, 1);
    assert_eq!(groups[0].jpg_count, 1);
}

#[test]
fn unrelated_jpg_does_not_group_with_different_raw() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("P1000001.RW2"), b"raw").unwrap();
    fs::write(dir.path().join("P1000002.JPG"), b"jpg").unwrap();

    let groups = build_groups(dir.path());

    assert_eq!(groups.len(), 2);
    assert!(groups
        .iter()
        .any(|group| group.raw_count == 1 && group.jpg_count == 0));
    assert!(groups
        .iter()
        .any(|group| group.raw_count == 0 && group.jpg_count == 1));
}

#[test]
fn scans_nested_panasonic_folders() {
    let dir = tempdir().unwrap();
    fs::create_dir_all(dir.path().join("DCIM").join("103_PANA")).unwrap();
    fs::create_dir_all(dir.path().join("DCIM").join("104_PANA")).unwrap();
    fs::write(
        dir.path()
            .join("DCIM")
            .join("103_PANA")
            .join("P1000001.RW2"),
        b"raw",
    )
    .unwrap();
    fs::write(
        dir.path()
            .join("DCIM")
            .join("104_PANA")
            .join("P1000002.JPG"),
        b"jpg",
    )
    .unwrap();

    let groups = build_groups(dir.path());

    assert_eq!(groups.len(), 2);
    assert!(groups.iter().any(|group| group.folder_name == "103_PANA"));
    assert!(groups.iter().any(|group| group.folder_name == "104_PANA"));
}

#[test]
fn ignores_sidecar_without_photo() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("P1000001.XMP"), b"xmp").unwrap();
    fs::write(dir.path().join("P1000002.RW2"), b"raw").unwrap();
    fs::write(dir.path().join("P1000002.XMP"), b"xmp").unwrap();

    let groups = build_groups(dir.path());

    assert_eq!(groups.len(), 1);
    assert_eq!(groups[0].stem, "P1000002");
    assert_eq!(groups[0].raw_count, 1);
    assert_eq!(groups[0].sidecar_count, 1);
}

#[test]
fn uses_video_file_as_preview_for_video_only_group() {
    let dir = tempdir().unwrap();
    let video_path = dir.path().join("P1000001.MP4");
    fs::write(&video_path, b"video").unwrap();

    let groups = build_groups(dir.path());

    assert_eq!(groups.len(), 1);
    assert_eq!(groups[0].video_count, 1);
    assert_eq!(
        groups[0].preview_path.as_deref(),
        Some(video_path.to_string_lossy().as_ref())
    );
}
