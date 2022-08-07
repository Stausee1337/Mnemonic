mod ipc;
mod config;
mod events;
mod settings;
mod commands;
mod mnemonic;
mod win32;

use std::str::FromStr;
use std::io::prelude::*;

// use win32::DispatchExt;
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
    webview::{WebviewAttributes}, Dispatch, RuntimeHandle, SystemTray, TrayIcon, SystemTrayEvent, EventLoopProxy, menu::{SystemTrayMenu, CustomMenuItem}
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
    pending.url = "http://localhost:3000".to_string();
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
    runtime: Wry<EventLoopMessage>,
    is_launcher: bool,
    (window, hwnd): (DetachedWindow<EventLoopMessage, Wry<EventLoopMessage>>, HWND)
) {
    let should_show_window = if is_launcher {
        config::get_config_or_default("globalConfig.generalApp.showOnStart", Some(false)).unwrap()
    } else { true };

    let channels = Channels::new();
    let mut initialized = false;
    let mut force_close = false;
    runtime.run(move |event| match event {
        RunEvent::Exit => {
            println!("Exit")
        }
        RunEvent::UserEvent(tp) => {
            match tp {
                EventLoopMessage::WebAppInit => {
                    if !initialized {
                        if should_show_window {
                            show_window_borderless(&window, hwnd);
                        }
                        initialized = true;
                    }
                }
                EventLoopMessage::ShowSysMenu { x, y } => {
                    let _ = win32::show_sys_menu(hwnd, x, y);
                }
                EventLoopMessage::EstablishChannel(req) => {
                    let _ = channels.open_channel(&req.0, window.clone(), req.1);
                }
                EventLoopMessage::CloseChannel(id) => {
                    if let Some(channel) = channels.get_channel_by_id(id) {
                        channel.send_close();                    
                    }
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
                EventLoopMessage::ApplicationOpenWindow => {
                    if !window.dispatcher.is_visible().unwrap_or(true) {
                        show_window_borderless(&window, hwnd);
                    } else {
                        let _ = window.dispatcher.set_focus();
                        let _ = window.dispatcher.request_user_attention(
                            Some(UserAttentionType::Informational)
                        );
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
                    if is_launcher && !force_close {
                        let _ = signal_tx.send(true);
                        let _ = window.dispatcher.hide();
                    }
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
                
                if buffer[0] == 0x42 {
                    let _ = proxy.send_event(EventLoopMessage::ApplicationOpenWindow);
                }
            }
        );
    });
}

fn notify_window_process() {
    let mut client_pipe_handle = win32::connect_to_pipe(PIPE_PATH.to_string());
    client_pipe_handle.write(&[0x42u8]).unwrap();
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
            let _ = proxy.send_event(EventLoopMessage::ApplicationOpenWindow);
        }
        SystemTrayEvent::MenuItemClick(e) => {
            let _ = if e == &open {
                proxy.send_event(EventLoopMessage::ApplicationOpenWindow)
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

    if mutex.is_none() { // App already open
        notify_window_process();
        return;
    }

    let window_tpl = create_window_form_runtime(&runtime);
    
    let use_launcher = check_start_with_launcher(&args);
    
    if use_launcher {
        install_plugin(&mut runtime, &window_tpl);
        init_system_tray(&mut runtime);
    }
    start_pipe_server(runtime.create_proxy());

    run(
        runtime,
        use_launcher,
        window_tpl
    );
}
