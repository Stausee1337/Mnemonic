extern crate winres;

fn main() {
    let mut res =  winres::WindowsResource::new();
    res.set_icon("icons/Icon.ico");
    res.compile().unwrap();
}