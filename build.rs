extern crate winres;
use embed_manifest::{embed_manifest, new_manifest};

fn main() {
    let mut res =  winres::WindowsResource::new();
    res.set_icon("icons/Icon.ico");
    res.compile().unwrap();

    embed_manifest(new_manifest("Stausee.Mnemonic")).unwrap();
}