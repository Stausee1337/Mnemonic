use crate::{ipc::ChannelHandshakeRequest, commands::WindowButton};

#[derive(Debug, Clone)]
pub enum EventLoopMessage {
    WebAppInit,
    ShowSysMenu { x: i32, y: i32 },
    EstablishChannel(ChannelHandshakeRequest),
    CloseChannel(uuid::Uuid),

    WindowSysCommand(WindowButton),
    WindowFocus,
    WindowBlur,
    WindowMinimize,

    ApplicationQuit,
    ApplicationOpenWindow
}