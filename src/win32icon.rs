use windows::{
    core::{PCWSTR, Error},
    Win32::{
        Foundation::{HWND, LPARAM, WPARAM},
        System::LibraryLoader::*,
        UI::WindowsAndMessaging::*,
    },
};

/*

use tauri_runtime_wry::WryIcon;
use tauri_runtime::{WindowIcon};

fn test_lol_lol_lol(resource_id: u16) -> Result<WindowIcon, ()> {
    let hicon = icon_from_resource(resource_id).map_err(|_| ())?;
    let info = get_icon_info(hicon);
    info.
}

fn get_icon_info(hicon: HICON) -> ICONINFO {
    let mut icon_info: ICONINFO = Default::default();
    unsafe {
        let piconinfo: *mut ICONINFO = &mut icon_info;
        GetIconInfo(hicon, piconinfo);
    }
    icon_info
}
*/
fn icon_from_resource(resource_id: u16) -> Result<HICON, Error> {
    // let (width, height) = size.map(Into::into).unwrap_or((0, 0));
    unsafe {
        LoadImageW(
            GetModuleHandleW(PCWSTR::default()).unwrap_or_default(),
            PCWSTR(resource_id as usize as *const u16),
            IMAGE_ICON,
            0,
            0,
            LR_DEFAULTSIZE,
        )
    }
    .map(|handle| HICON(handle.0))
}

fn set_for_window(hwnd: HWND, hicon: HICON) {
    unsafe {
        SendMessageW(
            hwnd,
            WM_SETICON,
            WPARAM(0 as _),
            LPARAM(hicon.0),
        );
    }
}

pub fn set_icon_from_resource(hwnd: HWND, resource_id: u16) -> Result<(), Error> {
    let hicon = icon_from_resource(resource_id)?;
    Ok(set_for_window(hwnd, hicon))
    //Ok(())
}