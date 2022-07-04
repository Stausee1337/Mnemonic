#[derive(Debug, Clone)]
pub enum EventLoopMessage {
    WebAppInit,
    ShowSysMenu{ x: i32, y: i32 }
}