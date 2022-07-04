mod ipc;
mod events;
mod settings;
mod commands;
mod mnemonic;
mod win32;

use std::str::FromStr;

use tauri_runtime_wry::{Wry};
use tauri_runtime::{
    Runtime, RunEvent,
    window::{PendingWindow},
    webview::{WebviewAttributes}, Dispatch
};

use tauri_utils::{config::{WindowUrl, WindowConfig,}, Theme};
use url::Url;

use crate::events::EventLoopMessage;

fn create_window_config() -> WindowConfig {
    WindowConfig {
        label: "1".to_string(),
        url: WindowUrl::External(Url::from_str("http://localhost:3000").unwrap()),
        file_drop_enabled: false,
        center: false,
        width: 800f64,
        height: 630f64,
        resizable: false,
        title: "Mnemonic".to_string(),
        fullscreen: false,
        focus: true,
        transparent: false,
        maximized: false,
        visible: false,
        decorations: false,
        always_on_top: false,
        skip_taskbar: false,

        x: None,
        y: None,
        min_width: None,
        min_height: None,
        max_width: None,
        max_height: None,
        theme: Some(Theme::Light)
    }
}

fn main() {
    let runtime = Wry::<EventLoopMessage>::new()
        .expect("Couldn't build wry runtime");
    // let window_builder = <<R as Runtime<EventLoopMessage>>::Dispatcher as Dispatch<EventLoopMessage>>::WindowBuilder::new();
    let config = create_window_config();
    let url = config.url.clone();
    let mut pending = PendingWindow::with_config(
        config, 
        WebviewAttributes::new(url), 
        "1"
    ).unwrap();
    pending.url = "http://localhost:3000".to_string();
    pending.ipc_handler = Some(ipc::create_ipc_handler(runtime.handle()));
    pending.webview_attributes.initialization_scripts.push(include_str!("../resources/init.js").to_string());
    let detached = runtime.create_window(pending).unwrap();

    let hwnd = detached.dispatcher.hwnd().map_err(|_| "Couldn't get hwnd").unwrap();
    win32::set_icon_from_resource(hwnd, 1).map_err(|_| "seticon failed").unwrap();
    println!("{:#016x}", hwnd.0);

    let mut initialized = false;
    runtime.run(move |event| match event {
        RunEvent::Exit => {
            println!("Exit")
        },
        RunEvent::UserEvent(tp) => {
            match tp {
                EventLoopMessage::WebAppInit => {
                    if !initialized {
                        let _ = detached.dispatcher.show();
                        win32::window_enable_visual_styles(hwnd).map_err(|_| "Couldnt make window borderless").unwrap();
                        initialized = true;
                    }
                }
                EventLoopMessage::ShowSysMenu { x, y } => {
                    let _ = win32::show_sys_menu(hwnd, x, y);
                }
            }
        }
        _ => ()
    });
}
