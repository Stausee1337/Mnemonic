use serde::{Deserialize, Serialize};

use serde_json::{Value, value::RawValue};
use serialize_to_javascript::Serialized;
use tauri_runtime::{
    window::{DetachedWindow}, webview::WebviewIpcHandler, Dispatch, Runtime, RuntimeHandle, EventLoopProxy
};
use tauri_runtime_wry::Wry;

use crate::{events::EventLoopMessage, mnemonic, commands};

// use crate::settings::{};

const MIN_JSON_PARSE_LEN: usize = 10_240;
const MAX_JSON_STR_LEN: usize = usize::pow(2, 30) - 2;



#[derive(Deserialize, Debug, Clone, Copy)]
pub struct CallbackFn(pub usize);

#[derive(Deserialize)]
pub struct IpcPayload {
    pub callback: CallbackFn,
    pub error: CallbackFn,
    pub command: String,
    pub inner: Value
}

type Window = DetachedWindow<EventLoopMessage, Wry<EventLoopMessage>>;
type RHandle = <Wry<EventLoopMessage> as Runtime<EventLoopMessage>>::Handle;


#[derive(Clone)]
pub struct InvokeMessage {
    pub window: Window,
    pub command: String,
    pub payload: Value
}

#[derive(Clone)]
pub struct InvokeResolver {
    pub window: Window,
    pub callback: CallbackFn,
    pub error: CallbackFn
}

impl InvokeResolver {
    pub fn resolve<T: Serialize>(self, value: T) {
        Self::return_response(
            self.window, 
            Ok(value).into(), 
            self.callback,
            self.error
        );
    }

    pub fn reject<T: Serialize>(self, value: T) {
        Self::return_response(
            self.window,
            Result::<(), _>::Err(value.into()).into(),
            self.callback,
            self.error
        );
    }

    fn return_response(
        window: Window,
        response: InvokeResponse,
        success_callback: CallbackFn,
        error_callback: CallbackFn
    ) {
        let callback_string = 
            match format_callback_result(response.into_result(), success_callback, error_callback) {
                Ok(cb_str) => cb_str,
                Err(e) => format_callback(error_callback, &e.to_string())
                    .expect("unable to serialze response")
            };
        // println!("{}", callback_string);
        let _ = window.dispatcher.eval_script(&callback_string);
    }
}

pub struct InvokeError(Value);

impl InvokeError {
    pub fn from_serde_json(error: serde_json::Error) -> Self {
        Self(Value::String(error.to_string()))
    }
}

impl<T: Serialize> From<T> for InvokeError {
    fn from(value: T) -> Self {
        serde_json::to_value(value)
            .map(Self)
            .unwrap_or_else(Self::from_serde_json)
    }
}

pub enum InvokeResponse {
    Ok(Value),
    Err(InvokeError)
}

impl InvokeResponse {
    pub fn into_result(self) -> Result<Value, Value> {
        match self {
            Self::Ok(v) => Ok(v),
            Self::Err(e) => Err(e.0)
        }
    }
}

impl<T: Serialize> From<Result<T, InvokeError>> for InvokeResponse {
    fn from(result: Result<T, InvokeError>) -> Self {
        match result {
            Ok(ok) => match serde_json::to_value(ok) {
                Ok(value) => Self::Ok(value),
                Err(err) => Self::Err(InvokeError::from_serde_json(err))
            },
            Err(err) => Self::Err(err)
        }
    }
}

#[derive(Clone)]
pub struct Invoke {
    pub message: InvokeMessage,
    pub resolver: InvokeResolver
}

fn invoke_handler(invoke: Invoke) {
    let cmd = invoke.message.command.as_str();
    match cmd {
        "testFn" => {
            invoke.resolver.resolve(1337);
        }
        "generateMnemonicPhrase" => {
            mnemonic::generate_mnemonic_phrase(invoke);
        }
        "fromMnemonicPhrase" => {
            mnemonic::from_mnemonic_phrase(invoke);
        }
        "getWordlist" => {
            commands::get_wordlist(invoke);
        }
        _ => {
            invoke.resolver.reject(format!("command {} not found", cmd));
        }
    };
}

fn handle_invoke_payload(window: Window, payload: IpcPayload, runtime_handle: &RHandle) {
    let event_proxy = runtime_handle.create_proxy();
    match payload.command.as_str() {
        "setInitialized" => {  // Application Initialized
            let resolver = InvokeResolver {
                window,
                callback: payload.callback,
                error: payload.error
            };
            let _ = event_proxy.send_event(EventLoopMessage::WebAppInit);
            resolver.resolve(Value::Null);
        }
        _ => {
            let message = InvokeMessage { 
                window: window.clone(),
                command: payload.command,
                payload: payload.inner
            };

            let resolver = InvokeResolver {
                window,
                callback: payload.callback,
                error: payload.error
            };
            let invoke = Invoke { message, resolver };
            invoke_handler(invoke);
        }
    }
}

fn serialize_js_with<T, F>(value: &T, cb: F) -> Result<String, serde_json::Error>
where
    T: Serialize,
    F: Fn(&str) -> String 
{
    let string = serde_json::to_string(value)?;
    let raw = RawValue ::from_string(string)?;

    // from here we know json.len() > 1 because an empty string is not a valid json value.
    let json = raw.get();
    let first = json.as_bytes()[0];

    #[cfg(debug_assertions)]
    if first == b'"' {
        assert!(
        json.len() < MAX_JSON_STR_LEN,
        "passing a string larger than the max JavaScript literal string size"
        )
    }

    let return_val = if json.len() > MIN_JSON_PARSE_LEN && (first == b'{' || first == b'[') {
        let serialized = Serialized::new(&raw, &Default::default()).into_string();
        // only use JSON.parse('{arg}') for arrays and objects less than the limit
        // smaller literals do not benefit from being parsed from json
        if serialized.len() < MAX_JSON_STR_LEN {
            cb(&serialized)
        } else {
            cb(json)
        }
    } else {
        cb(json)
    };

    Ok(return_val)
}

fn format_callback<T: Serialize>(function_handle: CallbackFn, arg: &T) -> Result<String, serde_json::Error> {
    serialize_js_with(arg, |arg| {
        format!(
            r"
        window.ipcHandler._dispatchResolver({fc}, {arg});
            ",
            fc = function_handle.0,
            arg = arg
        )
    })
}

fn format_callback_result<T: Serialize, E: Serialize>(
    result: Result<T, E>,
    success_callback: CallbackFn,
    error_callback: CallbackFn
) -> Result<String, serde_json::Error> {
    match result {
        Ok(res) => format_callback(success_callback, &res),
        Err(err) => format_callback(error_callback, &err)
    }
}

pub fn create_ipc_handler(
    runtime_handle: RHandle
) -> WebviewIpcHandler<EventLoopMessage, Wry<EventLoopMessage>> {
    Box::new(move |window, request| {
        match serde_json::from_str::<IpcPayload>(&request) {
            Ok(payload) => {
                handle_invoke_payload(window, payload, &runtime_handle);
            },
            Err(e) => {
                let msg = e.to_string();
                let _ = window.dispatcher.eval_script(&format!(
                    "console.error({});",
                    Value::String(msg)
                ));
            }
        }
    })
}

pub fn deserialize_arguments(invoke: Invoke) -> Option<Vec<Value>> {
    let result: Option<&Vec<Value>> = invoke.message.payload.as_array();
    if matches!(result, None) {
        invoke.resolver.reject("payload has to be an array.");
    }
    if let Some(result) = result {
        return Some(result.clone());
    }
    return None;
}

pub fn get_argument<'a, D: Deserialize<'a>>(value: &'a Value, resolver: InvokeResolver) -> Option<D> {
    match D::deserialize(value) {
        Ok(res) => Some(res),
        Err(err) => {
            resolver.reject(err.to_string());
            None
        }
    }
}
