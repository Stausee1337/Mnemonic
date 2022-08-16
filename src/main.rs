#![windows_subsystem = "windows"]

mod ipc;
mod config;
mod events;
mod settings;
mod commands;
mod mnemonic;
mod win32;

use std::{collections::HashMap, ffi::OsStr};
use std::path::PathBuf;
use std::io::prelude::*;
use std::str::FromStr;
use std::fs::File;

use events::ApplicationOpenLocation;
use tar::Archive;
use wry::application::{
    event::Event,
    event_loop::{
        EventLoopWindowTarget, ControlFlow, EventLoopProxy as WryEventLoopProxy
    }
};
use tauri_runtime_wry::{Wry, Plugin, EventLoopIterationContext, WebContextStore, Message, EventProxy, WindowMessage};
use tauri_runtime::{
    Runtime, RunEvent, UserAttentionType,
    window::{PendingWindow, DetachedWindow, WindowEvent},
    webview::{WebviewAttributes}, 
    Dispatch, RuntimeHandle, SystemTray, TrayIcon, SystemTrayEvent, EventLoopProxy,
    menu::{SystemTrayMenu, CustomMenuItem}, 
    http::{ResponseBuilder, Response, Request}
};
use tauri_utils::{config::{WindowUrl, WindowConfig,}, Theme};

use windows::Win32::Foundation::HWND;
use url::Url;

use crate::{
    ipc::Channels,
    commands::WindowButton,
    events::EventLoopMessage
};

struct ApplicationMessagePlugin(HWND);

impl Plugin<EventLoopMessage> for ApplicationMessagePlugin {
    fn on_event(
        &mut self,
        event: &Event<Message<EventLoopMessage>>,
        _event_loop: &EventLoopWindowTarget<Message<EventLoopMessage>>,
        _proxy: &WryEventLoopProxy<Message<EventLoopMessage>>,
        control_flow: &mut ControlFlow,
        _context: EventLoopIterationContext<'_, EventLoopMessage>,
        _web_context: &WebContextStore,
  ) -> bool {
        match event {
            Event::UserEvent(Message::UserEvent(EventLoopMessage::ApplicationQuit)) => {
                *control_flow = ControlFlow::Exit;
            }
            Event::UserEvent(
                Message::Window(_, WindowMessage::Close)
            ) => {
                win32::send_close_message(self.0);
                return true;
            }
            _ => ()
        }
        return false;
    }
}

fn check_start_with_launcher(
    args: &Vec<String>
) -> bool {
    if args.len() <= 1 {
        return false;
    }
    &args[1].to_lowercase() == "--launcher"
}

fn check_aol_argument(
    args: &Vec<String>
) -> Option<usize> {
    if args.len() <= 1 {
        return None;
    }
    ["--generate", "--retrieve"].iter().position(|&s| s == args[1].to_lowercase().as_str())
}

fn get_applicaton_open_location(args: &Vec<String>) -> ApplicationOpenLocation {
    match check_aol_argument(args) {
        Some(0) => ApplicationOpenLocation::Generate,
        Some(1) => ApplicationOpenLocation::Retrieve,
        _ => ApplicationOpenLocation::Auto
    }
}

fn create_window_config() -> WindowConfig {
    WindowConfig {
        label: "1".to_string(),
        url: WindowUrl::External(Url::from_str("http://localhost:3000").unwrap()),
        file_drop_enabled: false,
        center: true,
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

fn create_custom_protocol_handler(
) -> Box<dyn Fn(&Request) -> Result<Response, Box<dyn std::error::Error>> + Send + Sync + 'static> {
    let mut current_exe = std::env::current_exe().unwrap();
    current_exe.pop();
    let tarfile = File::open(current_exe.join("bundle.tar")).unwrap();
    let tar: HashMap<PathBuf, Vec<u8>> = Archive::new(tarfile)
        .entries()
        .unwrap()
        .map(|e| {
            let mut e = e.unwrap();
            let path = e.path().unwrap().as_ref().to_owned();
            let mut buffer: Vec<u8> = Vec::default();
            e.read_to_end(&mut buffer).unwrap();
            (path, buffer)
        }).collect();
    Box::new(move |request| {
        let path = request.uri().replace("mne://", "");
        let path = std::path::Path::new(&path);

        if path.starts_with("apps") {
            let path = path.strip_prefix("apps").unwrap();

            
            if let Some(data) = tar.get(path) {
                let mimetype = match &path.extension().and_then(OsStr::to_str).unwrap().to_lowercase() as &str {
                    "html" => "text/html",
                    "svg" => "image/svg+xml",
                    "ttf" => "font/ttf",
                    "js" => "text/javascript",
                    "css" => "text/css",
                    _ => panic!("Hi Mom!")
                };
                return Ok(ResponseBuilder::new().status(200).mimetype(mimetype).body(data.to_vec()).unwrap());
            }
        }

        Ok(ResponseBuilder::new().status(404).body(vec![]).unwrap())
    })
}

fn create_window_form_runtime(
    runtime: &Wry<EventLoopMessage>
) -> (DetachedWindow<EventLoopMessage, Wry<EventLoopMessage>>, HWND) {
    let config = create_window_config();
    let url = config.url.clone();
    let mut pending = PendingWindow::with_config(
        config, 
        WebviewAttributes::new(url), 
        "1"
    ).unwrap();
    if cfg!(debug_assertions)
    {
        pending.url = "http://localhost:3000".to_string();
    } else {
        pending.register_uri_scheme_protocol("mne", create_custom_protocol_handler());
        pending.url = "mne://apps/index.html".to_string();
    }
    pending.ipc_handler = Some(ipc::create_ipc_handler(runtime.handle()));
    pending.webview_attributes.initialization_scripts.push(include_str!("../resources/init.js").to_string());
    let detached = runtime.create_window(pending).unwrap();

    let hwnd = detached.dispatcher.hwnd().expect("Couldn't get hwnd");
    win32::set_icon_from_resource(hwnd, 1).expect("seticon failed");
    win32::install_event_hook(hwnd, runtime.handle().create_proxy());

    (detached, hwnd)
}

fn show_window_borderless(
    window: &DetachedWindow<EventLoopMessage, Wry<EventLoopMessage>>,
    hwnd: HWND
) {
    let _ = window.dispatcher.show();
    win32::window_enable_visual_styles(hwnd).expect("Couldn't make window borderless");
}

fn run(
    args: Vec<String>,
    runtime: Wry<EventLoopMessage>,
    is_launcher: bool,
    (window, hwnd): (DetachedWindow<EventLoopMessage, Wry<EventLoopMessage>>, HWND)
) {
    let should_show_window = if is_launcher {
        config::get_config_or_default("generalApp.showOnStart", Some(false)).unwrap()
    } else { true };

    let application_open_location = if should_show_window {
        Some(get_applicaton_open_location(&args))
    } else { None };

    let channels = Channels::new();
    let mut initialized = false;
    let mut force_close = false;
    let mut show_with_delay = false;
    runtime.run(move |event| match event {
        RunEvent::UserEvent(tp) => {
            match tp {
                EventLoopMessage::WebAppInit => {
                    if !initialized {
                        if should_show_window {
                            let mut success = false;
                            if let Some(channel) = channels.get_channel("ui-events") {
                                if let Some(aol) = application_open_location.clone() {
                                    channel.send_message(aol);
                                    success = true;
                                    show_with_delay = true;
                                }
                            }
                            if !success {
                                show_window_borderless(&window, hwnd);
                            }
                        }
                        initialized = true;
                    }
                }
                EventLoopMessage::PageContentLoaded => {
                    if show_with_delay {
                        show_with_delay = false;
                        show_window_borderless(&window, hwnd);
                    }
                }
                EventLoopMessage::EstablishChannel(req) => {
                    let _ = channels.open_channel(&req.0, window.clone(), req.1);
                }
                EventLoopMessage::CloseChannel(id) => {
                    if let Some(channel) = channels.get_channel_by_id(id) {
                        channel.send_close();                    
                    }
                }
                EventLoopMessage::WindowShowSysMenu { x, y } => {
                    let _ = win32::show_sys_menu(hwnd, x, y);
                }
                EventLoopMessage::WindowSysCommand(msg) => {
                    let _ = match msg {
                        WindowButton::Close => window.dispatcher.close(),
                        WindowButton::Minimize => window.dispatcher.minimize()
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
                EventLoopMessage::ApplicationOpenWindow(aol) => {
                    if !window.dispatcher.is_visible().unwrap_or(true) {
                        if let Some(channel) = channels.get_channel("ui-events") {
                            channel.send_message(aol);
                            show_with_delay = true;
                        } else {
                            show_window_borderless(&window, hwnd);
                        }
                    } else {
                        let _ = window.dispatcher.set_focus();
                        let _ = window.dispatcher.request_user_attention(
                            Some(UserAttentionType::Informational)
                        );
                    }
                }
                EventLoopMessage::ApplicationCloseWindow => {
                    if is_launcher {
                        let _ = window.dispatcher.hide();
                    } else {
                        force_close = true;
                        let _ = window.dispatcher.close();
                    }
                }
                EventLoopMessage::ApplicationQuit => {
                    force_close = true;
                    let _ = window.dispatcher.close();
                }
            }
        }
        RunEvent::WindowEvent { event, .. } => {
            match event {
                WindowEvent::CloseRequested { signal_tx } => {
                    if !force_close {
                        let _ = signal_tx.send(true);
                    }
                    ipc::js_window_close_event(&window);
                }
                _ => ()
            }
        }
        _ => ()
    });
}

static PIPE_PATH: &str = r#"\\?\pipe\mn\{FA1CF89B-458F-416F-8251-7A3DE2157E9D}"#;

fn start_pipe_server(
    proxy: EventProxy<EventLoopMessage>,
) {
    std::thread::spawn(move || {
        win32::create_pipe_server(
            PIPE_PATH.to_string(),
            |mut server_file| {
                let mut buffer = [0; 1];
                server_file.read(&mut buffer).unwrap();

                let aol = match buffer[0] {
                    0x42 => Some(ApplicationOpenLocation::Auto),
                    0x44 => Some(ApplicationOpenLocation::Generate),
                    0x46 => Some(ApplicationOpenLocation::Retrieve),
                    _ => None
                };
                
                if let Some(aol) = aol {
                    let _ = proxy.send_event(EventLoopMessage::ApplicationOpenWindow(aol));
                }
            }
        );
    });
}

fn notify_window_process(aol: ApplicationOpenLocation) {
    let payload: u8 = match aol {
        ApplicationOpenLocation::Auto => 0x42,
        ApplicationOpenLocation::Generate => 0x44,
        ApplicationOpenLocation::Retrieve => 0x46,
    };
    let mut client_pipe_handle = win32::connect_to_pipe(PIPE_PATH.to_string());
    client_pipe_handle.write(&[payload]).unwrap();
}

fn init_system_tray(runtime: &mut Wry<EventLoopMessage>) {
    let open = CustomMenuItem::new("open", "Open");
    let quit = CustomMenuItem::new("quit", "Quit");

    let menu = SystemTrayMenu::new()
        .add_item(open.clone())
        .add_item(quit.clone());

    let icon_data = include_bytes!("../Icons/Icon.ico").to_vec();
    let tray = SystemTray::new().with_icon(TrayIcon::Raw(icon_data))
        .with_menu(menu);

    let _tray_handler = runtime.system_tray(tray)
        .expect("Failed to run as tray");
    runtime.on_system_tray_event(
        create_system_tray_handler(runtime.create_proxy(), (open.id, quit.id))
    );
}

fn create_system_tray_handler(
    proxy: EventProxy<EventLoopMessage>,
    (open, quit): (u16, u16)
) -> Box<dyn Fn(&SystemTrayEvent) + Send + 'static> {
    Box::new(move |event| match event {
        SystemTrayEvent::LeftClick { .. } => {
            let _ = proxy.send_event(EventLoopMessage::ApplicationOpenWindow(ApplicationOpenLocation::Auto));
        }
        SystemTrayEvent::MenuItemClick(e) => {
            let _ = if e == &open {
                proxy.send_event(EventLoopMessage::ApplicationOpenWindow(ApplicationOpenLocation::Auto))
            } else if e == &quit {
                proxy.send_event(EventLoopMessage::ApplicationQuit)
            } else { Ok(()) };
        }
        _ => ()
    })
}

fn install_plugin(
    runtime: &mut Wry<EventLoopMessage>,
    (_, window): &(DetachedWindow<EventLoopMessage, Wry<EventLoopMessage>>, HWND)
) {
    runtime.plugin(ApplicationMessagePlugin(window.clone()))
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let mutex = win32::try_open_allocation_mutex();

    let mut runtime = Wry::<EventLoopMessage>::new()
        .expect("Couldn't build wry runtime");

    if mutex.is_none() { // App already open in other process
        notify_window_process(get_applicaton_open_location(&args));
        return;
    }

    let window_tpl = create_window_form_runtime(&runtime);
    
    let use_launcher = check_start_with_launcher(&args);
    
    if use_launcher {
        init_system_tray(&mut runtime);
    }
    install_plugin(&mut runtime, &window_tpl);
    start_pipe_server(runtime.create_proxy());

    run(
        args,
        runtime,
        use_launcher,
        window_tpl
    );
}
