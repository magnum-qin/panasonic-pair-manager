use std::fs::File;
use std::io::{BufReader, Write};
use std::path::PathBuf;
use std::process::Command;

pub(super) fn write_exiftool_preview(source: &PathBuf, cache_path: &PathBuf) -> Result<(), String> {
    for tag in ["PreviewImage", "JpgFromRaw", "ThumbnailImage"] {
        let output = Command::new("exiftool")
            .arg("-b")
            .arg(format!("-{tag}"))
            .arg(source)
            .output()
            .map_err(|error| error.to_string())?;

        if !output.status.success() || output.stdout.len() < 256 {
            continue;
        }
        if !output.stdout.starts_with(&[0xff, 0xd8, 0xff]) {
            continue;
        }
        std::fs::write(cache_path, output.stdout).map_err(|error| error.to_string())?;
        return Ok(());
    }
    Err("ExifTool did not return a JPEG preview.".to_string())
}

pub(super) fn write_ffmpeg_video_thumbnail(
    source: &PathBuf,
    cache_path: &PathBuf,
    size: u32,
) -> Result<(), String> {
    let output = Command::new("ffmpeg")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg("-y")
        .arg("-ss")
        .arg("00:00:01")
        .arg("-i")
        .arg(source)
        .arg("-frames:v")
        .arg("1")
        .arg("-vf")
        .arg(format!("scale=min({size}\\,iw):-2"))
        .arg("-q:v")
        .arg("4")
        .arg(cache_path)
        .output()
        .map_err(|error| error.to_string())?;

    if output.status.success() && cache_path.exists() {
        return Ok(());
    }

    let _ = std::fs::remove_file(cache_path);
    Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
}

pub(super) fn write_embedded_thumbnail(
    source: &PathBuf,
    cache_path: &PathBuf,
) -> Result<(), String> {
    let file = File::open(source).map_err(|error| error.to_string())?;
    let mut reader = BufReader::new(file);
    let exif = exif::Reader::new()
        .read_from_container(&mut reader)
        .map_err(|error| error.to_string())?;
    let offset = exif_long(&exif, exif::Tag::JPEGInterchangeFormat, exif::In::THUMBNAIL)
        .ok_or_else(|| "embedded thumbnail offset not found".to_string())?
        as usize;
    let length = exif_long(
        &exif,
        exif::Tag::JPEGInterchangeFormatLength,
        exif::In::THUMBNAIL,
    )
    .ok_or_else(|| "embedded thumbnail length not found".to_string())? as usize;
    let end = offset
        .checked_add(length)
        .ok_or_else(|| "embedded thumbnail offset overflow".to_string())?;
    let data = exif.buf();
    if length < 32 || end > data.len() {
        return Err("embedded thumbnail data is invalid".to_string());
    }
    let mut output = File::create(cache_path).map_err(|error| error.to_string())?;
    output
        .write_all(&data[offset..end])
        .map_err(|error| error.to_string())
}

fn exif_long(exif: &exif::Exif, tag: exif::Tag, ifd: exif::In) -> Option<u32> {
    let field = exif.get_field(tag, ifd)?;
    match &field.value {
        exif::Value::Long(values) => values.first().copied(),
        exif::Value::Short(values) => values.first().map(|value| *value as u32),
        _ => None,
    }
}
