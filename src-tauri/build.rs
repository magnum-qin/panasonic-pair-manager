fn main() {
    println!("cargo:rerun-if-changed=icons/icon.ico");
    println!("cargo:rerun-if-changed=icons/app-icon.png");
    println!("cargo:rerun-if-changed=icons/icon-256.png");
    println!("cargo:rerun-if-changed=icons/icon-source.png");
    tauri_build::build()
}
