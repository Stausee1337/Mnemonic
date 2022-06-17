mod ipc;
mod events;
mod settings;
mod commands;
mod mnemonic;

use std::str::FromStr;

use tauri_runtime_wry::{Wry};
use tauri_runtime::{
    Runtime, RunEvent,
    window::{PendingWindow},
    webview::{WebviewAttributes}
};

use tauri_utils::config::{WindowUrl, WindowConfig,};
use url::Url;

use crate::events::EventLoopMessage;

fn create_window_config() -> WindowConfig {
    WindowConfig {
        label: "1".to_string(),
        url: WindowUrl::External(Url::from_str("http://localhost:3000").unwrap()),
        file_drop_enabled: false,
        center: false,
        width: 800f64,
        height: 600f64,
        resizable: false,
        title: "Mnemonic".to_string(),
        fullscreen: false,
        focus: true,
        transparent: false,
        maximized: false,
        visible: true,
        decorations: true,
        always_on_top: false,
        skip_taskbar: false,

        x: None,
        y: None,
        min_width: None,
        min_height: None,
        max_width: None,
        max_height: None,
        theme: None
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
    let _detached = runtime.create_window(pending).unwrap();
    runtime.run(|event| match event {
        RunEvent::Exit => {
            println!("Exit")
        },
        _ => ()
    });
}
