use crate::models::ExternalToolStatus;
use std::process::Command;

#[tauri::command]
pub(crate) fn get_external_tool_status() -> ExternalToolStatus {
    ExternalToolStatus {
        exiftool_available: command_available("exiftool", &["-ver"]),
        ffmpeg_available: command_available("ffmpeg", &["-version"]),
    }
}

fn command_available(command: &str, args: &[&str]) -> bool {
    Command::new(command)
        .args(args)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}
