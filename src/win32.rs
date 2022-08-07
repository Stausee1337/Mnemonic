use tauri_runtime::{EventLoopProxy};
use tauri_runtime_wry::EventProxy;
use windows::{
    core::{PCWSTR, Error},
    Win32::{
        Foundation::{HWND, LPARAM, WPARAM, LRESULT, HANDLE, ERROR_FILE_NOT_FOUND},
        System::{LibraryLoader::*, Threading::{OpenMutexW, CreateMutexW, ReleaseMutex}, Pipes::{CreateNamedPipeW, PIPE_TYPE_BYTE, PIPE_WAIT, PIPE_READMODE_BYTE, ConnectNamedPipe}, SystemServices::{WRITE_DAC, GENERIC_READ, GENERIC_WRITE} },
        UI::{
            WindowsAndMessaging::*,
            Controls::MARGINS,
            Shell::{SetWindowSubclass, DefSubclassProc}
        }, 
        Graphics::{Gdi::SetWindowRgn, Dwm::DwmExtendFrameIntoClientArea}, Storage::FileSystem::{PIPE_ACCESS_DUPLEX, FILE_FLAG_FIRST_PIPE_INSTANCE, FILE_FLAG_OVERLAPPED, FILE_FLAGS_AND_ATTRIBUTES, CreateFileA, OPEN_EXISTING, FILE_ACCESS_FLAGS, FILE_SHARE_MODE}, Security::SECURITY_ATTRIBUTES,
    },
};

use crate::events::EventLoopMessage;

use std::{
    fs::File,
    os::windows::prelude::FromRawHandle
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

pub struct Mutex(HANDLE);

impl Drop for Mutex {
    fn drop(&mut self) {
        unsafe {
            ReleaseMutex(self.0);
        }
    }
}

pub fn try_open_allocation_mutex() -> Option<Mutex> {
    let result = unsafe {
        OpenMutexW(0x1F0001u32, false, "{A91B718C-2F12-4B5A-AE8A-FC04C3982E09}")
    };
    match result {
        Ok(_) => return None,
        Err(err) => {
            if err.win32_error() == Some(ERROR_FILE_NOT_FOUND) {
                let hmutex = unsafe {
                    CreateMutexW(std::ptr::null(), false, "{A91B718C-2F12-4B5A-AE8A-FC04C3982E09}")
                }.unwrap();
                return Some(Mutex(hmutex));
            } else {
                panic!("{}", err);
            }
        }
    }
}


pub fn create_pipe_server<F>(
    path: String,
    callback: F
)
where 
    F: Fn(File)
 {
    unsafe fn build_named_pipe(path: String) -> HANDLE {
        CreateNamedPipeW(
            path, 
            PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE | FILE_FLAG_OVERLAPPED | FILE_FLAGS_AND_ATTRIBUTES(WRITE_DAC), 
            PIPE_TYPE_BYTE | PIPE_WAIT | PIPE_READMODE_BYTE, 
            1, 
            65536, 
            65536, 
            0, 
            std::ptr::null_mut())
    }

    let mut handle = unsafe { build_named_pipe(path.clone()) };

    loop {
        let _res = unsafe { ConnectNamedPipe(handle, std::ptr::null_mut()) };
    
        callback(unsafe { File::from_raw_handle(handle.0 as *mut std::ffi::c_void) });
        handle = unsafe { build_named_pipe(path.clone()) };
    }
}

pub fn connect_to_pipe(path: String) -> File {
    let mut attr = SECURITY_ATTRIBUTES {
        nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: std::ptr::null_mut(),
        bInheritHandle: true.into()
    };

    let result = unsafe {
        CreateFileA(
            path, 
            FILE_ACCESS_FLAGS(GENERIC_READ) | FILE_ACCESS_FLAGS(GENERIC_WRITE) | FILE_ACCESS_FLAGS(WRITE_DAC), 
            FILE_SHARE_MODE(0), 
            &mut attr, 
            OPEN_EXISTING, 
            FILE_FLAG_OVERLAPPED, 
            HANDLE(0)
        )
    };

    let handle = result.unwrap();
    unsafe { File::from_raw_handle(handle.0 as *mut std::ffi::c_void) }
}

pub fn send_close_message(hwnd: HWND) {
    unsafe {
        SendMessageA(hwnd, WM_CLOSE, WPARAM(0), LPARAM(0))
    };
}