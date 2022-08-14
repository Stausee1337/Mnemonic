use serde::Deserialize;
use serde_json::Value;
use tauri_runtime::Dispatch;
use tauri_runtime::{
    window::DetachedWindow, EventLoopProxy
};
use tauri_runtime_wry::{Wry, EventProxy};

use winsafe::{prelude::*, co, HINSTANCE};
use winsafe::{
    TaskDialogIndirect, TASKDIALOG_BUTTON, TASKDIALOGCONFIG, 
    HWND, WString, IconIdTdicon
};

use crate::ipc::{Invoke, deserialize_arguments, get_argument};
use crate::events::EventLoopMessage;
use crate::win32;

#[derive(Debug, Clone)]
pub enum WindowButton {
    Close,
    Minimize,
}

fn get_wordlist_impl() -> String {
    include_str!("../resources/wordlist.txt").to_string()
}

pub fn get_wordlist(invoke: Invoke) {
    invoke.resolver.resolve(get_wordlist_impl());
}

pub fn window_drag_move(
    window: DetachedWindow<EventLoopMessage, Wry<EventLoopMessage>>,
    invoke: Invoke
) {
    let result = window.dispatcher.start_dragging();

    match result {
        Ok(..) => {
            invoke.resolver.resolve(Value::Null);
        }
        Err(err) => {
            invoke.resolver.reject(err.to_string());
        } 
    }
}

pub fn handle_window_buttons(
    proxy: EventProxy<EventLoopMessage>,
    invoke: Invoke,
    message: WindowButton,
) {
    let result = proxy.send_event(EventLoopMessage::WindowSysCommand(message));

    match result {
        Ok(..) => {
            invoke.resolver.resolve(Value::Null);
        }
        Err(err) => {
            invoke.resolver.reject(err.to_string());
        } 
    }
}

fn window_show_sys_menu_impl(proxy: EventProxy<EventLoopMessage>, x: i32, y: i32) -> Result<(), tauri_runtime::Error> {
    proxy.send_event(EventLoopMessage::WindowShowSysMenu { x, y })
}

pub fn window_show_sys_menu(
    proxy: EventProxy<EventLoopMessage>,
    invoke: Invoke
) -> Option<()> {
    let arguments = deserialize_arguments(invoke.clone())?;
    let mut iter = arguments.iter();
    let resolver = invoke.resolver.clone();

    let result = window_show_sys_menu_impl(
        proxy,
        get_argument(iter.next()?, resolver.clone())?,
        get_argument(iter.next()?, resolver.clone())?,
    );

    match result {
        Ok(..) => {
            resolver.resolve(Value::Null);
        }
        Err(err) => {
            resolver.reject(err.to_string());
        } 
    }

    Some(())
}

fn window_set_title_impl(
    window: DetachedWindow<EventLoopMessage, Wry<EventLoopMessage>>,
    title: String
) -> Result<(), tauri_runtime::Error>{
    window.dispatcher.set_title(title)
}

pub fn window_set_title(
    window: DetachedWindow<EventLoopMessage, Wry<EventLoopMessage>>,
    invoke: Invoke
) -> Option<()> {
    let arguments = deserialize_arguments(invoke.clone())?;
    let mut iter = arguments.iter();
    let resolver = invoke.resolver.clone();

    let result = window_set_title_impl(
        window,
        get_argument(iter.next()?, resolver.clone())?
    );

    match result {
        Ok(..) => {
            resolver.resolve(Value::Null);
        }
        Err(err) => {
            resolver.reject(err.to_string());
        } 
    }

    Some(())
}

#[derive(Deserialize, Debug)]
pub struct MessageBoxOptions {
    pub message: String,

    #[serde(default)]
    pub dialog_type: String,

    #[serde(default)]
    pub buttons: Vec<String>,

    #[serde(default)]
    pub default_id: u32,

    #[serde(default)]
    pub title: String,

    #[serde(default)]
    pub detail: String,

    #[serde(default)]
    pub checkbox_label: String,

    #[serde(default)]
    pub checkbox_checked: bool,

    #[serde(default)]
    pub no_link: bool
}

fn show_message_box_impl(
    hwnd: isize,
    options: MessageBoxOptions
) -> Result<(co::DLGID, bool), String> {
    let hwnd = unsafe {
        HWND::from_ptr(hwnd as *mut isize)
    };

    let mut tdc = TASKDIALOGCONFIG::default();
    tdc.hwndParent = hwnd;
    tdc.hInstance = HINSTANCE::GetModuleHandle(None).unwrap();
    tdc.dwFlags = co::TDF::ALLOW_DIALOG_CANCELLATION | co::TDF::SIZE_TO_CONTENT;

    if !options.no_link {
        tdc.dwFlags = tdc.dwFlags | co::TDF::USE_COMMAND_LINKS;
    }

    if options.buttons.is_empty() {
        tdc.dwCommonButtons = co::TDCBF::OK;
    }

    let mut buttons = options.buttons;
    if !options.no_link && !buttons.is_empty() {
        let common_buttons: Vec<String> = buttons.iter().cloned().filter(|p| match p as &str {
            "Ok" | "OK" | "Yes" | "No" | "Cancel" | "Retry" | "Close" => true,
            _ => false
        }).collect();
        
        let mut cbutton_flags = co::TDCBF::default();
        for common in common_buttons {
            let index = buttons.iter().position(|value| **value == common).unwrap();
            buttons.remove(index);
            match &common as &str {
                "Ok" | "OK" => cbutton_flags |= co::TDCBF::OK,
                "Yes" => cbutton_flags |= co::TDCBF::YES,
                "No" => cbutton_flags |= co::TDCBF::NO,
                "Cancel" => cbutton_flags |= co::TDCBF::CANCEL,
                "Retry" => cbutton_flags |= co::TDCBF::RETRY,
                "Close" => cbutton_flags |= co::TDCBF::CLOSE,
                _ => ()
            }
        }

        tdc.dwCommonButtons = cbutton_flags;
    }
    
    let dialog_type: &str = &options.dialog_type;
    tdc.set_pszMainIcon(
        match dialog_type {
            "info" => IconIdTdicon::Tdicon(co::TD_ICON::INFORMATION),
            "error" => IconIdTdicon::Tdicon(co::TD_ICON::ERROR),
            "warning" => IconIdTdicon::Tdicon(co::TD_ICON::WARNING),
            "shield" => IconIdTdicon::Tdicon(co::TD_ICON::SHIELD),
            "" | "none" | _ => IconIdTdicon::None
        }
    );

    let mut title = WString::from_str(&options.title);
    tdc.set_pszWindowTitle(Some(&mut title));

    #[allow(unused_assignments)]
    let mut message = WString::new_alloc_buffer(0);
    #[allow(unused_assignments)]
    let mut detail = WString::new_alloc_buffer(0);
    if !options.detail.is_empty() {
        message = WString::from_str(&options.message);
        tdc.set_pszMainInstruction(Some(&mut message));
    
        detail = WString::from_str(&options.detail);
        tdc.set_pszContent(Some(&mut detail));
    } else {
        detail = WString::from_str(&options.message);
        tdc.set_pszContent(Some(&mut detail));
    }
    
    let mut buttons_tags: Vec<WString> = buttons
        .iter()
        .map(|t| WString::from_str(t))
        .collect();
    
    let mut buttons: Vec<TASKDIALOG_BUTTON> = vec![];

    for (i, btn_text) in buttons_tags.iter_mut().enumerate() {
        let mut btn = TASKDIALOG_BUTTON::default();
        btn.set_pszButtonText(Some(btn_text));
        btn.set_nButtonID((100 + i) as u16);
        buttons.push(btn);
    }

    tdc.set_pButtons(Some(&mut buttons));
    tdc.nDefaultButton = (options.default_id + 100) as i32;


    let mut flag_checked = false;
    #[allow(unused_assignments)]
    let mut checkbox_label = WString::new_alloc_buffer(0);

    let verification_flag_checked = if !options.checkbox_label.is_empty() {
        checkbox_label = WString::from_str(&options.checkbox_label);
        tdc.set_pszVerificationText(Some(&mut checkbox_label));
        flag_checked = options.checkbox_checked;
        Some(&mut flag_checked)
    } else { None };
    
    let (dlgid, _) = TaskDialogIndirect(&tdc, verification_flag_checked)
        .map_err(|err| err.to_string())?;

    Ok((dlgid, flag_checked))
}

pub fn show_message_box(
    window: DetachedWindow<EventLoopMessage, Wry<EventLoopMessage>>,
    invoke: Invoke
) -> () {
    fn thread_main(hwnd: isize, invoke: Invoke) -> Option<()> {
        let arguments = deserialize_arguments(invoke.clone())?;
        let mut iter = arguments.iter();
        let resolver = invoke.resolver.clone();
        
        let result = show_message_box_impl(
            hwnd,
            get_argument(iter.next()?, resolver.clone())?
        );
        match result {
            Ok((response, checkbox_checked)) => {
                resolver.resolve(serde_json::json!({ 
                    "response": u16::from(response),
                    "checkboxChecked": checkbox_checked
                }));
            },
            Err(err) => {
                resolver.reject(err.to_string());
            }
        };
        Some(())
    }
    
    std::thread::spawn(move || {
        let hwnd = window.dispatcher.hwnd().unwrap();
        thread_main(hwnd.0, invoke);
    });
}


pub fn autostart_registry_execute_command(invoke: Invoke) -> Option<()> {
    let arguments = deserialize_arguments(invoke.clone())?;
    let mut iter = arguments.iter();
    let resolver = invoke.resolver.clone();

    let result = win32::autostart_registry_execute_command(
        get_argument(iter.next()?, resolver.clone())?
    );

    resolver.resolve(result);
    
    Some(())
} 