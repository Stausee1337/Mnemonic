mod ipc;
mod events;
mod settings;
mod commands;
mod mnemonic;
mod win32;

use std::str::FromStr;

use commands::WindowButton;
use tauri_runtime_wry::{Wry};
use tauri_runtime::{
    Runtime, RunEvent,
    window::{PendingWindow},
    webview::{WebviewAttributes}, Dispatch, RuntimeHandle
};

use tauri_utils::{config::{WindowUrl, WindowConfig,}, Theme};
use url::Url;

use crate::{events::EventLoopMessage, ipc::Channels};

fn create_window_config() -> WindowConfig {
    WindowConfig {
        label: "1".to_string(),
        url: WindowUrl::External(Url::from_str("http://localhost:3000").unwrap()),
        file_drop_enabled: false,
        center: false,
        width: 800f64,
        height: 630f64,
        resizable: false,
        title: "".to_string(),
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

    let hwnd = detached.dispatcher.hwnd().expect("Couldn't get hwnd");
    win32::set_icon_from_resource(hwnd, 1).expect("seticon failed");
    win32::install_event_hook(hwnd, runtime.handle().create_proxy());

    let channels = Channels::new();
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
                        win32::window_enable_visual_styles(hwnd).expect("Couldnt make window borderless");
                        initialized = true;
                    }
                }
                EventLoopMessage::ShowSysMenu { x, y } => {
                    let _ = win32::show_sys_menu(hwnd, x, y);
                }
                EventLoopMessage::EstablishChannel(req) => {
                    let _ = channels.open_channel(&req.0, detached.clone(), req.1);
                }
                EventLoopMessage::CloseChannel(id) => {
                    if let Some(channel) = channels.get_channel_by_id(id) {
                        channel.send_close();                    
                        println!("Channel close sent");
                    }
                }
                EventLoopMessage::WindowSysCommand(msg) => {
                    let _ = match msg {
                        WindowButton::Close => detached.dispatcher.close(),
                        WindowButton::Minimize => detached.dispatcher.minimize()
                    };
                }
                EventLoopMessage::WindowFocus => {
                    if let Some(channel) = channels.get_channel("window-events") {
                        channel.send_message("focus");
                    }
                }
                EventLoopMessage::WindowBlur => {
                    if let Some(channel) = channels.get_channel("window-events") {
                        channel.send_message("blur");
                    }
                }
                EventLoopMessage::WindowMinimize => {
                    if let Some(channel) = channels.get_channel("window-events") {
                        channel.send_message("minimized");
                    }
                }
            }
        }
        _ => ()
    });
}
