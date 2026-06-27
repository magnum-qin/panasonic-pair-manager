mod cache;
mod commands;
mod db;
mod delete;
mod drives;
mod exiftool;
mod models;
mod scanner;
mod state;
mod thumbnail;
mod window;

use db::Database;
use state::AppState;
use std::sync::{Arc, Mutex};
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::current_dir().expect("current directory exists"));
            std::fs::create_dir_all(&app_dir)?;
            let thumbnail_dir = app_dir.join("thumbnails");
            std::fs::create_dir_all(&thumbnail_dir)?;
            let _ = cache::enforce_thumbnail_cache_limit(
                &thumbnail_dir,
                cache::THUMBNAIL_CACHE_LIMIT_BYTES,
            );
            let db = Database::new(app_dir.join("library.sqlite3"))?;
            db.migrate()?;
            app.manage(AppState {
                db,
                thumbnail_dir,
                thumbnail_lock: Arc::new(Mutex::new(())),
            });
            window::fit_main_window_to_monitor(app.handle());
            window::start_removable_roots_monitor(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::select_root_folder,
            commands::scan_root,
            commands::list_photo_groups,
            commands::count_photo_groups,
            commands::get_scan_summary,
            commands::has_scan_for_root,
            commands::get_photo_group,
            thumbnail::get_photo_thumbnail,
            thumbnail::get_video_thumbnail,
            thumbnail::get_thumbnail_cache_stats,
            thumbnail::clear_thumbnail_cache,
            commands::get_photo_group_metadata,
            commands::delete_photo_groups,
            commands::open_photo_group,
            commands::open_photo_file,
            commands::get_external_tool_status,
            commands::path_exists,
            commands::list_removable_roots
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
