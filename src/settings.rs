use serde::{Serialize};


#[derive(Serialize)]
pub struct Settings {
    length: i8,
    first_startup: bool
}
