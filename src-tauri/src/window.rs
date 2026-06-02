use crate::drives;
use crate::models::DriveCandidate;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Emitter, LogicalSize, Manager, Size};

fn drive_signature(candidates: &[DriveCandidate]) -> Vec<String> {
    let mut paths = candidates
        .iter()
        .map(|candidate| {
            let modified = std::fs::metadata(&candidate.scan_path)
                .and_then(|metadata| metadata.modified())
                .ok()
                .and_then(|modified| modified.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|duration| duration.as_secs())
                .unwrap_or_default();
            format!("{}:{modified}", candidate.scan_path)
        })
        .collect::<Vec<_>>();
    paths.sort();
    paths
}

fn emit_removable_roots_if_changed(
    app: &tauri::AppHandle,
    last_signature: &Arc<Mutex<Vec<String>>>,
) {
    let candidates = drives::list_removable_roots();
    let signature = drive_signature(&candidates);
    let Ok(mut last_signature) = last_signature.lock() else {
        return;
    };
    if signature == *last_signature {
        return;
    }
    *last_signature = signature;
    let _ = app.emit("removable-roots-changed", candidates);
}

pub(crate) fn start_removable_roots_monitor(app: tauri::AppHandle) {
    let last_signature = Arc::new(Mutex::new(drive_signature(&drives::list_removable_roots())));

    #[cfg(target_os = "windows")]
    start_windows_device_change_listener(app.clone(), last_signature.clone());

    tauri::async_runtime::spawn_blocking(move || loop {
        std::thread::sleep(Duration::from_secs(60));
        emit_removable_roots_if_changed(&app, &last_signature);
    });
}

pub(crate) fn fit_main_window_to_monitor(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten());
    let Some(monitor) = monitor else {
        return;
    };

    let scale = monitor.scale_factor().max(1.0);
    let size = monitor.size();
    let logical_width = size.width as f64 / scale;
    let logical_height = size.height as f64 / scale;
    let max_width = (logical_width - 64.0).max(760.0);
    let max_height = (logical_height - 104.0).max(460.0);
    let width = 1180.0_f64.min(max_width).max(860.0_f64.min(max_width));
    let height = 680.0_f64.min(max_height).max(520.0_f64.min(max_height));

    let _ = window.set_size(Size::Logical(LogicalSize { width, height }));
    let _ = window.center();
}

#[cfg(target_os = "windows")]
fn start_windows_device_change_listener(
    app: tauri::AppHandle,
    last_signature: Arc<Mutex<Vec<String>>>,
) {
    use std::sync::mpsc::{channel, Sender};
    use std::sync::OnceLock;
    use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW, RegisterClassW,
        TranslateMessage, MSG, WNDCLASSW,
    };

    const DBT_DEVICEARRIVAL: usize = 0x8000;
    const DBT_DEVICEREMOVECOMPLETE: usize = 0x8004;
    const DBT_DEVNODES_CHANGED: usize = 0x0007;
    const WM_DEVICECHANGE: u32 = 0x0219;

    static DEVICE_CHANGE_SENDER: OnceLock<Sender<()>> = OnceLock::new();

    unsafe extern "system" fn wnd_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if msg == WM_DEVICECHANGE
            && matches!(
                wparam,
                DBT_DEVICEARRIVAL | DBT_DEVICEREMOVECOMPLETE | DBT_DEVNODES_CHANGED
            )
        {
            if let Some(sender) = DEVICE_CHANGE_SENDER.get() {
                let _ = sender.send(());
            }
        }
        unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) }
    }

    fn wide_null(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    let (sender, receiver) = channel::<()>();
    let _ = DEVICE_CHANGE_SENDER.set(sender);

    std::thread::spawn(move || {
        let class_name = wide_null("PanasonicPairManagerDeviceChangeWindow");
        let window_created = unsafe {
            let hinstance = GetModuleHandleW(std::ptr::null());
            let mut class: WNDCLASSW = std::mem::zeroed();
            class.lpfnWndProc = Some(wnd_proc);
            class.hInstance = hinstance;
            class.lpszClassName = class_name.as_ptr();
            RegisterClassW(&class);
            let hwnd = CreateWindowExW(
                0,
                class_name.as_ptr(),
                class_name.as_ptr(),
                0,
                0,
                0,
                0,
                0,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                hinstance,
                std::ptr::null_mut(),
            );
            !hwnd.is_null()
        };

        if !window_created {
            return;
        }

        let mut message: MSG = unsafe { std::mem::zeroed() };
        loop {
            let result = unsafe { GetMessageW(&mut message, std::ptr::null_mut(), 0, 0) };
            if result <= 0 {
                break;
            }
            unsafe {
                TranslateMessage(&message);
                DispatchMessageW(&message);
            }
            while receiver.try_recv().is_ok() {
                for delay_ms in [0, 350, 1_200] {
                    if delay_ms > 0 {
                        std::thread::sleep(Duration::from_millis(delay_ms));
                    }
                    emit_removable_roots_if_changed(&app, &last_signature);
                }
            }
        }
    });
}
