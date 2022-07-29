use tauri_runtime::EventLoopProxy;
use tauri_runtime_wry::EventProxy;
use windows::{
    core::{PCWSTR, Error},
    Win32::{
        Foundation::{HWND, LPARAM, WPARAM, LRESULT},
        System::LibraryLoader::*,
        UI::{
            WindowsAndMessaging::*,
            Controls::MARGINS,
            Shell::{SetWindowSubclass, DefSubclassProc}
        }, 
        Graphics::{Gdi::SetWindowRgn, Dwm::DwmExtendFrameIntoClientArea},
    },
};

use crate::events::EventLoopMessage;

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

pub fn window_enable_visual_styles(hwnd: HWND) -> Result<(), Error> {
    unsafe {
        SetWindowLongW(hwnd, GWL_STYLE, 0x16ca0000);
        SetWindowRgn(hwnd, None, true);

        let m = MARGINS {
            cxLeftWidth: 1,
            cxRightWidth: 1,
            cyTopHeight: 1,
            cyBottomHeight: 1
        };

        DwmExtendFrameIntoClientArea(hwnd, &m)?;
    }

    Ok(())
}

pub fn show_sys_menu(hwnd: HWND, x: i32, y: i32) -> Result<(), Error> {
    unsafe {
        let system_menu = GetSystemMenu(hwnd, false);

        EnableMenuItem(system_menu, SC_RESTORE, MF_DISABLED | MF_GRAYED);
        EnableMenuItem(system_menu, SC_MOVE, MF_ENABLED);
        EnableMenuItem(system_menu, SC_SIZE, MF_DISABLED | MF_GRAYED);
        EnableMenuItem(system_menu, SC_MINIMIZE, MF_ENABLED);
        EnableMenuItem(system_menu, SC_MAXIMIZE, MF_DISABLED | MF_GRAYED);

        let cmd = TrackPopupMenuEx(system_menu, 256, x, y, hwnd, std::ptr::null());
        if !cmd.as_bool() {
            return Err(Error::from_win32());
        }
        PostMessageA(hwnd, WM_SYSCOMMAND, WPARAM(cmd.0 as usize), LPARAM(0));
    }

    Ok(())
}


unsafe extern "system" fn pfn_subclass(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _: usize,
    subclass_input_ptr: usize
) -> LRESULT {
    let event_loop = subclass_input_ptr as *mut EventProxy<EventLoopMessage>;

    match msg {
        WM_ACTIVATE => {
            match wparam.0 {
                1usize => { //
                    let _ = (*event_loop).send_event(EventLoopMessage::WindowFocus);
                }
                2usize => { // WA_CLICKACTIVE
                    let _ = (*event_loop).send_event(EventLoopMessage::WindowFocus);
                }
                0usize => {
                    let _ = (*event_loop).send_event(EventLoopMessage::WindowBlur);
                }
                0usize.. => {
                    let _ = (*event_loop).send_event(EventLoopMessage::WindowMinimize);
                }
                _ => ()
            }
        }
        _ => {
            return DefSubclassProc(hwnd, msg, wparam, lparam)
        }
    }

    LRESULT(0)
}

pub fn install_event_hook(hwnd: HWND, event_proxy: EventProxy<EventLoopMessage>) -> bool {
    let input_ptr = Box::into_raw(Box::new(event_proxy));
    let subclass_result = unsafe {
        SetWindowSubclass(
            hwnd,
            Some(pfn_subclass),
            0x1337,
            input_ptr as usize
        )
    };
    return subclass_result.as_bool();
}