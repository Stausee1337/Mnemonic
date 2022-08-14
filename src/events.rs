use serde::Serialize;

use crate::{ipc::{ChannelHandshakeRequest}, commands::WindowButton};

#[derive(Serialize, Debug, Clone)]
pub enum ApplicationOpenLocation { Auto, Generate, Retrieve }

#[derive(Debug, Clone)]
pub enum EventLoopMessage {
    WebAppInit,
    PageContentLoaded,
    EstablishChannel(ChannelHandshakeRequest),
    CloseChannel(uuid::Uuid),
    
    WindowShowSysMenu { x: i32, y: i32 },
    WindowSysCommand(WindowButton),
    WindowFocus,
    WindowBlur,
    WindowMinimize,

    ApplicationQuit,
    ApplicationOpenWindow(ApplicationOpenLocation),
    ApplicationCloseWindow
}