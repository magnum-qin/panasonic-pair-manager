use sha1::{Digest, Sha1};
use std::fmt::Write as _;
use std::path::PathBuf;

pub(super) fn thumbnail_cache_path(
    thumbnail_dir: &std::path::Path,
    prefix: Option<&str>,
    source_path: &str,
    modified_secs: Option<i64>,
    size: u32,
) -> PathBuf {
    let name = match prefix {
        Some(prefix) => format!(
            "{prefix}-{}-{}-{}.jpg",
            stable_hash(source_path),
            modified_secs.unwrap_or_default(),
            size
        ),
        None => format!(
            "{}-{}-{}.jpg",
            stable_hash(source_path),
            modified_secs.unwrap_or_default(),
            size
        ),
    };
    thumbnail_dir.join(name)
}

fn stable_hash(value: &str) -> String {
    let mut hasher = Sha1::new();
    hasher.update(value.as_bytes());
    sha1_hex(hasher)
}

fn sha1_hex(hasher: Sha1) -> String {
    let mut output = String::with_capacity(40);
    for byte in hasher.finalize() {
        write!(&mut output, "{byte:02x}").expect("writing to string cannot fail");
    }
    output
}
