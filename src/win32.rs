use serde::{Serialize, Deserialize};
use tauri_runtime::{EventLoopProxy};
use tauri_runtime_wry::EventProxy;
use windows::{
    core::{PCWSTR, Error},
    Win32::{
        Foundation::{HWND, LPARAM, WPARAM, LRESULT, HANDLE, ERROR_FILE_NOT_FOUND, ERROR_SUCCESS},
        System::{
            Registry::{HKEY, HKEY_CURRENT_USER, RegCloseKey, RegOpenKeyExW, KEY_WRITE, RegSetValueExA, REG_SZ, RegGetValueA, RRF_RT_REG_SZ, KEY_READ, RegDeleteValueA},
            LibraryLoader::*, 
            Threading::{OpenMutexW, CreateMutexW, ReleaseMutex}, 
            Pipes::{CreateNamedPipeW, PIPE_TYPE_BYTE, PIPE_WAIT, PIPE_READMODE_BYTE, ConnectNamedPipe}, 
            SystemServices::{WRITE_DAC, GENERIC_READ, GENERIC_WRITE} 
        },
        UI::{
            WindowsAndMessaging::*,
            Controls::MARGINS,
            Shell::{SetWindowSubclass, DefSubclassProc}, 
            Input::KeyboardAndMouse::{SendInput, INPUT, INPUT_0, KEYBDINPUT, INPUT_KEYBOARD, VK_CONTROL, VIRTUAL_KEY, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP}
        }, 
        Graphics::{Gdi::SetWindowRgn, Dwm::DwmExtendFrameIntoClientArea}, Storage::FileSystem::{PIPE_ACCESS_DUPLEX, FILE_FLAG_FIRST_PIPE_INSTANCE, FILE_FLAG_OVERLAPPED, FILE_FLAGS_AND_ATTRIBUTES, CreateFileA, OPEN_EXISTING, FILE_ACCESS_FLAGS, FILE_SHARE_MODE}, Security::SECURITY_ATTRIBUTES,
    }, ApplicationModel::DataTransfer::{Clipboard, DataPackage, ClipboardContentOptions},
};

use crate::events::EventLoopMessage;

use std::{
    fs::File,
    os::windows::prelude::FromRawHandle
};

fn icon_from_resource(resource_id: u16) -> Result<HICON, Error> {
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
                1usize => {
                    let _ = (*event_loop).send_event(EventLoopMessage::WindowFocus);
                }
                2usize => {
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

#[derive(Serialize, Deserialize)]
pub enum AutostartCommand {
    Get, Activate, Deactivate
}

struct Finally(HKEY);

impl Drop for Finally {
    fn drop(&mut self) {
        unsafe { RegCloseKey(self.0) };
    }
}

static UNSAFE_CHAR: [char; 17] = ['!', '"', '#', '$', '&', '\'', '(', ')', '*', ']', '^', '`', '{', '|', '}', '~', ' '];

fn try_get_executable_path() -> Option<String> {
    std::env::current_exe().ok()?.into_os_string().into_string().ok()
}

fn check_unsafe(arg: &String) -> bool {
    return arg.chars().any(|c| UNSAFE_CHAR.contains(&c));
}

fn argquote(args: Vec<String>) -> String {
    fn quote(s: String) -> String {
        if !check_unsafe(&s) {
            return s;
        }
        return format!("\"{}\"", s.replace(r#"""#, r#"\""#));
    }

    return args.iter().map(|s| quote(s.to_string())).collect::<Vec<String>>().join(" ");
}

pub fn autostart_registry_execute_command(command: AutostartCommand) -> Option<bool> {
    let mut hkey = HKEY(0);
    let res = unsafe {
        RegOpenKeyExW(
            HKEY_CURRENT_USER,
            r#"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"#,
            0,
            KEY_WRITE | KEY_READ,
            &mut hkey
        )
    };
    let _finally = Finally(hkey);

    if res == ERROR_SUCCESS {
        unsafe {
            match command {
                AutostartCommand::Activate => {
                    let exec_str = argquote(
                        vec![
                            try_get_executable_path()?,
                            "--launcher".to_string()]
                    );
                    
                    let (len, exec_str) = (exec_str.len(), std::ffi::CString::new(exec_str).ok()?);
                    let res = RegSetValueExA(
                        hkey, 
                        "Stausee.Mnemonic", 
                        0, 
                        REG_SZ, 
                        exec_str.as_ptr() as *const u8,
                        len as u32
                    );
                    return Some(res == ERROR_SUCCESS);
                }
                AutostartCommand::Deactivate => {
                    let res = RegDeleteValueA(
                        hkey, 
                        "Stausee.Mnemonic"
                    );
                    return Some(res == ERROR_SUCCESS);
                }
                AutostartCommand::Get => {
                    let res = RegGetValueA(
                        hkey, 
                        "", 
                        "Stausee.Mnemonic",
                        RRF_RT_REG_SZ, 
                        std::ptr::null_mut(), 
                        std::ptr::null_mut(), 
                        std::ptr::null_mut()
                    );
                    return match res {
                        ERROR_SUCCESS => Some(true),
                        ERROR_FILE_NOT_FOUND => Some(false),
                        _ => None
                    };
                }
            }
        }
    }
    None
}

pub fn clipboard_write_text_secure(clip_text: String) -> Result<bool, windows::core::Error> {
    let content = DataPackage::new()?;
    content.SetText(clip_text)?;

    let options = ClipboardContentOptions::new()?;
    options.SetIsRoamable(false)?;
    options.SetIsAllowedInHistory(false)?;
    
    Clipboard::SetContentWithOptions(content, options)?;

    let mut ki = KEYBDINPUT::default();
    ki.wScan = 0;
    ki.time = 0;
    ki.dwExtraInfo = 0;

    let mut input = INPUT::default();
    input.r#type = INPUT_KEYBOARD;
    input.Anonymous = INPUT_0 { ki };

    // simulate Ctrl+V to burn the contents to the clipboard
    unsafe {
        let mut result: [u32; 4] = [0, 0, 0, 0];

        ki.wVk = VK_CONTROL;
        ki.dwFlags = KEYBD_EVENT_FLAGS(0);
        result[0] = SendInput(&[input], std::mem::size_of::<INPUT>() as i32);

        ki.wVk = VIRTUAL_KEY(0x56);
        ki.dwFlags = KEYBD_EVENT_FLAGS(0);
        result[1] = SendInput(&[input], std::mem::size_of::<INPUT>() as i32);

        ki.wVk = VIRTUAL_KEY(0x56);
        ki.dwFlags = KEYEVENTF_KEYUP;
        result[2] = SendInput(&[input], std::mem::size_of::<INPUT>() as i32);

        ki.wVk = VK_CONTROL;
        ki.dwFlags = KEYEVENTF_KEYUP;
        result[3] = SendInput(&[input], std::mem::size_of::<INPUT>() as i32);

        return Ok(!result.iter().any(|&f| f == 0));
    }
}
