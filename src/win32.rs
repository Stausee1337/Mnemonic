use windows::{
    core::{PCWSTR, Error},
    Win32::{
        Foundation::{HWND, LPARAM, WPARAM},
        System::LibraryLoader::*,
        UI::{WindowsAndMessaging::*, Controls::MARGINS}, Graphics::{Gdi::SetWindowRgn, Dwm::DwmExtendFrameIntoClientArea},
    },
};

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