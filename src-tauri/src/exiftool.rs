use serde_json::Value;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Default)]
pub struct Metadata {
    pub capture_time: Option<String>,
    pub camera_model: Option<String>,
    pub lens: Option<String>,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub items: Vec<MetadataItem>,
}

#[derive(Debug, Clone, Default)]
pub struct MetadataItem {
    pub tag: String,
    pub value: String,
}

pub fn read_metadata(path: &Path) -> Result<Metadata, String> {
    match read_metadata_with_exiftool(path) {
        Ok(metadata) => Ok(metadata),
        Err(exiftool_error) => match read_jpg_metadata(path) {
            Ok(metadata) if metadata.has_any_value() => Ok(metadata),
            Ok(_) => Err(exiftool_error),
            Err(_) => Err(exiftool_error),
        },
    }
}

fn read_metadata_with_exiftool(path: &Path) -> Result<Metadata, String> {
    let output = Command::new("exiftool")
        .arg("-j")
        .arg(path)
        .output()
        .map_err(|error| error.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let records: Vec<Value> =
        serde_json::from_slice(&output.stdout).map_err(|error| error.to_string())?;
    let Some(record) = records.into_iter().next() else {
        return Ok(Metadata::default());
    };
    let object = record
        .as_object()
        .ok_or_else(|| "ExifTool returned an unexpected response.".to_string())?;

    Ok(Metadata {
        capture_time: object_value(object, "DateTimeOriginal"),
        camera_model: object_value(object, "Model"),
        lens: object_value(object, "LensModel").or_else(|| object_value(object, "Lens")),
        width: object_i64(object, "ImageWidth"),
        height: object_i64(object, "ImageHeight"),
        items: object
            .iter()
            .filter_map(|(tag, value)| {
                if tag == "SourceFile" {
                    return None;
                }
                value_to_string(value).and_then(|value| metadata_item(tag.clone(), value))
            })
            .collect(),
    })
}

fn metadata_item(tag: String, value: String) -> Option<MetadataItem> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() || looks_like_binary_dump(&trimmed) {
        return None;
    }
    Some(MetadataItem {
        tag,
        value: if trimmed.chars().count() > 220 {
            format!("{}...", trimmed.chars().take(220).collect::<String>())
        } else {
            trimmed
        },
    })
}

fn looks_like_binary_dump(value: &str) -> bool {
    let compact: String = value.chars().filter(|char| !char.is_whitespace()).collect();
    compact.len() > 96
        && compact
            .chars()
            .filter(|char| char.is_ascii_hexdigit())
            .count()
            * 100
            / compact.len()
            > 92
}

fn read_jpg_metadata(path: &Path) -> Result<Metadata, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if extension != "jpg" && extension != "jpeg" {
        return Err("built-in fallback only supports JPG metadata".to_string());
    }

    let file = File::open(path).map_err(|error| error.to_string())?;
    let mut reader = BufReader::new(file);
    let exif = exif::Reader::new()
        .read_from_container(&mut reader)
        .map_err(|error| error.to_string())?;

    let mut metadata = Metadata {
        capture_time: field_text(&exif, exif::Tag::DateTimeOriginal),
        camera_model: field_text(&exif, exif::Tag::Model),
        lens: field_text(&exif, exif::Tag::LensModel)
            .or_else(|| field_text(&exif, exif::Tag::LensSpecification)),
        width: field_u32(&exif, exif::Tag::PixelXDimension)
            .or_else(|| field_u32(&exif, exif::Tag::ImageWidth)),
        height: field_u32(&exif, exif::Tag::PixelYDimension)
            .or_else(|| field_u32(&exif, exif::Tag::ImageLength)),
        items: exif
            .fields()
            .filter_map(|field| {
                let value = field
                    .display_value()
                    .with_unit(&exif)
                    .to_string()
                    .trim()
                    .trim_matches('"')
                    .to_string();
                metadata_item(format!("{:?}", field.tag), value)
            })
            .collect(),
    };

    if metadata.width.is_none() || metadata.height.is_none() {
        if let Ok((width, height)) = image::image_dimensions(path) {
            metadata.width.get_or_insert(width as i64);
            metadata.height.get_or_insert(height as i64);
        }
    }

    Ok(metadata)
}

impl Metadata {
    fn has_any_value(&self) -> bool {
        self.capture_time.is_some()
            || self.camera_model.is_some()
            || self.lens.is_some()
            || self.width.is_some()
            || self.height.is_some()
            || !self.items.is_empty()
    }
}

fn object_value(object: &serde_json::Map<String, Value>, key: &str) -> Option<String> {
    object.get(key).and_then(value_to_string)
}

fn object_i64(object: &serde_json::Map<String, Value>, key: &str) -> Option<i64> {
    object.get(key).and_then(|value| match value {
        Value::Number(number) => number.as_i64(),
        Value::String(value) => value.parse().ok(),
        _ => None,
    })
}

fn value_to_string(value: &Value) -> Option<String> {
    let text = match value {
        Value::Null => return None,
        Value::String(value) => value.clone(),
        Value::Number(value) => value.to_string(),
        Value::Bool(value) => value.to_string(),
        Value::Array(values) => values
            .iter()
            .filter_map(value_to_string)
            .collect::<Vec<_>>()
            .join(", "),
        Value::Object(_) => return None,
    };
    let text = text.trim().to_string();
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

fn field_text(exif: &exif::Exif, tag: exif::Tag) -> Option<String> {
    exif.get_field(tag, exif::In::PRIMARY)
        .map(|field| {
            field
                .display_value()
                .with_unit(exif)
                .to_string()
                .trim()
                .trim_matches('"')
                .to_string()
        })
        .filter(|value| !value.is_empty())
}

fn field_u32(exif: &exif::Exif, tag: exif::Tag) -> Option<i64> {
    let field = exif.get_field(tag, exif::In::PRIMARY)?;
    match &field.value {
        exif::Value::Short(values) => values.first().map(|value| *value as i64),
        exif::Value::Long(values) => values.first().map(|value| *value as i64),
        _ => None,
    }
}
