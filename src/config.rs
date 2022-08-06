use bson::{Bson, Document};
use std::{fs::{File, self}};
use serde_json::Value;

use crate::{ipc::{Invoke, deserialize_arguments, get_argument}};

enum Access {
    Read, Write
}

fn file_access(access: Access) -> Result<File, String> {
    let mut config_path = std::env::current_exe().unwrap();
    config_path.pop();
    config_path.push("data");
    if !config_path.exists() {
        fs::create_dir(&config_path).map_err(|e| e.to_string())?
    }
    config_path.push("user.db");

    match access {
        Access::Read => {
            File::open(config_path)
        }
        Access::Write => {
            File::create(config_path)
        }
    }.map_err(|err| err.to_string())        
}

fn iter_prop_tree_mut<'a>(
    path: &Vec<String>,
    root_doc: &'a mut Document
) -> &'a mut Document {
    let mut current = root_doc;

    for prop in path.iter() {
        let new = current.get_document(prop)
            .map_or_else(
                |_| Document::new(),
                |d| d.clone()
            );
        let _ = current.insert(prop, new);
        current = current.get_document_mut(prop).unwrap();
    }

    current
}

fn get_prop_from_path(
    path: &Vec<String>,
    root_doc: Document
) -> Option<Bson> {
    let mut current = &Bson::Document(root_doc);

    for prop in path.iter() {
        match current {
            Bson::Document(doc) => {
                current = doc.get(prop)?;
            }
            _ => {
                return None;
            }
        }
    }

    Some(current.clone())
}

fn read_get_document_safe() -> Document {
    let access = file_access(Access::Read);
    match access {
        Ok(file) => {
            Document::from_reader(file).map_or_else(
                |_| Document::new(),
                |d| d
            )
        }
        Err(_) => Document::new()
    }
}

fn js_config_set_property_impl(
    mut dotted_path: Vec<String>,
    value: Bson
) -> Result<(), String>{
    let mut bson_document = read_get_document_safe();
    
    if dotted_path.is_empty() {
        return Err("dottedPath musn't be empty".to_string());
    }
    
    if &dotted_path[0] == "globalConfig" {
        dotted_path.drain(0..1);  // first element will be globalConfig anyways
    } else {
        return Err("dottedPath must start with globalConfig".to_string());
    }
    let property = match dotted_path.pop() {
        Some(v) => v,
        None => "globalConfig".to_string()
    };

    if &property == "globalConfig" {
        match value.as_document() {
            Some(write_doc) => {
                return write_doc.to_writer(file_access(Access::Write)?).map_err(|err| err.to_string());
            }
            None => {
                return Err("globalConfig has to be an object".to_string());
            }
        }
    }

    let prop_doc = iter_prop_tree_mut(&dotted_path, &mut bson_document);
    prop_doc.insert(property, value);

    bson_document.to_writer(file_access(Access::Write)?).map_err(|err| err.to_string())
}

pub fn js_config_set_property(invoke: Invoke) -> Option<()> {
    let arguments = deserialize_arguments(invoke.clone())?;
    let mut iter = arguments.iter();
    let resolver = invoke.resolver.clone();

    let result = js_config_set_property_impl(
        get_argument(iter.next()?, resolver.clone())?,
        get_argument(iter.next()?, resolver.clone())?
    );

    match result {
        Ok(_) => {
            resolver.resolve(Value::Null);
        }
        Err(err) => {
            resolver.reject(err);
        }
    }

    Some(())
}

fn js_config_get_property_impl(
    mut dotted_path: Vec<String>,
) -> Option<Bson> {
    let bson_document = read_get_document_safe();
    
    dotted_path.drain(0..1);

    get_prop_from_path(&dotted_path, bson_document)
}

pub fn js_config_get_property(invoke: Invoke) -> Option<()> {
    let arguments = deserialize_arguments(invoke.clone())?;
    let mut iter = arguments.iter();
    let resolver = invoke.resolver.clone();

    let value = js_config_get_property_impl(
        get_argument(iter.next()?, resolver.clone())?,
    );

    resolver.resolve(value);

    Some(())
}

fn promise_is_file() -> bool {
    match file_access(Access::Read) {
        Ok(_) => true,
        Err(_) => false
    }
}

pub fn js_promise_is_file(invoke: Invoke) {
    invoke.resolver.resolve(promise_is_file())
}
