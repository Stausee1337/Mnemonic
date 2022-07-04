use serde_json::Value;
use tauri_runtime::Dispatch;
use tauri_runtime::{
    window::DetachedWindow, EventLoopProxy
};
use tauri_runtime_wry::{Wry, EventProxy};

use crate::ipc::{Invoke, deserialize_arguments, get_argument};
use crate::events::EventLoopMessage;


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

fn window_show_sys_menu_impl(proxy: EventProxy<EventLoopMessage>, x: i32, y: i32) -> Result<(), tauri_runtime::Error> {
    proxy.send_event(EventLoopMessage::ShowSysMenu { x, y })
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
