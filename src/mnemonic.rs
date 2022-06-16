use crate::ipc::{Invoke, deserialize_arguments, get_argument};
use serde::{Deserialize, Serialize};
use lazy_static::lazy_static;

use pyo3::{prelude::*, types::{PyDict, PyTuple}};

lazy_static! {
    static ref CONTEXT: Py<PyDict> = {
        Python::with_gil(|py| {
            // let locals = PyDict::new(py);
            let module = PyModule::from_code(
                py, 
                include_str!("../resources/crypto.py"), 
                "crypto.py",
                "__main__"
            ).unwrap();
            module.add_function(wrap_pyfunction!(get_wordlist, module).unwrap()).unwrap();
            let globals = module.dict();
            // locals.set_item("wordlist", wordlist2).unwrap();
            println!("{}", globals.keys().to_string());
            globals.into()
        })
    };

    static ref WORDLIST: Vec<String> = {
        include_str!("../resources/wordlist.txt")
            .split("\r\n").map(|f| f.to_string()).collect()
    };
}


#[derive(Deserialize, Debug)]
struct ConfigData {
    characters: bool,
    digits: bool,
    punctuation: bool,
    special: bool,
    length: i32,
}

impl ToPyObject for ConfigData {
    fn to_object(&self, py: Python<'_>) -> PyObject  {
        let obj = PyDict::new(py);
        obj.set_item("characters", self.characters).unwrap();
        obj.set_item("digits", self.digits).unwrap();
        obj.set_item("punctuation", self.punctuation).unwrap();
        obj.set_item("special", self.special).unwrap();
        obj.set_item("length", self.length).unwrap();

        obj.into()
    }
}

#[derive(Serialize)]
struct PharseData {
    phrase: Vec<String>,
    password: String
}

fn execute_python_function<F>(
    name: &str,
    args: F
) -> Result<PharseData, String> 
where
    F: for<'py> FnOnce(Python<'py>) -> &PyTuple
{
    Python::with_gil(|py| {
        let locals = CONTEXT.as_ref(py);
        
        let function = locals.get_item(name)
            .ok_or("Can't find function".to_string())?;
        
        let result = function.call(PyTuple::new(py, args(py)), None)
            .map_err(|err| err.to_string())?;

        let (phrase, password): (Vec<String>, String) = result.extract().map_err(|err| err.to_string())?;
        
        Ok(PharseData { phrase, password })
    })
}

fn generate_mnemonic_phrase_impl(data: ConfigData) -> Result<PharseData, String> {
    execute_python_function("generate_phrase", move |py| PyTuple::new(py, vec![data]))
}

pub fn generate_mnemonic_phrase(invoke: Invoke) -> Option<()> {
    let arguments = deserialize_arguments(invoke.clone())?;
    let mut iter = arguments.iter();
    let resolver = invoke.resolver.clone();

    // let c = ConfigData::deserialize(iter.next()?);

    let result = generate_mnemonic_phrase_impl(
        get_argument(iter.next()?, resolver.clone())?
    );

    match result {
        Ok(data) => {
            resolver.resolve(data);
        }
        Err(err) => {
            resolver.reject(err);
        } 
    }

    Some(())
}

fn from_mnemonic_phrase_impl(phrase: Vec<String>, config: ConfigData) -> Result<PharseData, String> {
    execute_python_function("from_phrase", move |py| {
        let phrase = phrase.to_object(py);
        let config = config.to_object(py);

        PyTuple::new(py, vec![phrase, config])
    })
}

pub fn from_mnemonic_phrase(invoke: Invoke) -> Option<()> {
    let arguments = deserialize_arguments(invoke.clone())?;
    let mut iter = arguments.iter();
    let resolver = invoke.resolver.clone();

    let result = from_mnemonic_phrase_impl(
        get_argument(iter.next()?, resolver.clone())?,
        get_argument(iter.next()?, resolver.clone())?,
    );

    match result {
        Ok(data) => {
            resolver.resolve(data);
        }
        Err(err) => {
            resolver.reject(err);
        } 
    }

    Some(())
}

#[pyfunction]
fn get_wordlist() -> Vec<String> {
    WORDLIST.clone()
}
