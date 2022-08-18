extern crate winres;
use std::fs::File;

use embed_manifest::{embed_manifest, new_manifest};
use tar::Builder;

fn build_web_app() {
    let profile = std::env::var("PROFILE").unwrap();
    if profile == "release" {
        
        let cwd = std::env::current_dir().unwrap();
        std::fs::remove_dir_all(&cwd.join("dist")).unwrap();
        std::fs::create_dir(&cwd.join("dist")).unwrap();

        let mut app_dir = cwd.clone();
        app_dir.push("web-app");

        let mut build_file = app_dir.clone();
        build_file.push("buildfile.js");

        let _ = std::process::Command::new("node")
            .arg(build_file)
            .arg("build")
            .current_dir(app_dir)
            .status();

        let file = File::create(
            cwd.join("target").join("release").join("bundle.tar")
        ).unwrap();
        let mut b = Builder::new(file);

        let root = cwd.join("dist");
        for entry in walkdir::WalkDir::new(&root) {
            if let Ok(entry) = entry {
                if entry.path().is_file() {
                    let rel_path = entry.path().strip_prefix(&root).unwrap();
                    let abs_path = root.join(entry.path());
                    b.append_file(
                        rel_path,
                        &mut File::open(abs_path).unwrap()
                    ).unwrap();
                }
            }
        }
    }
}

fn main() {
    build_web_app();

    let mut res =  winres::WindowsResource::new();
    res.set_icon("icons/Icon.ico");
    res.set_icon_with_id("icons/generate.ico", "2");
    res.set_icon_with_id("icons/retrieve.ico", "3");
    res.compile().unwrap();

    embed_manifest(new_manifest("Stausee.Mnemonic")).unwrap();
}