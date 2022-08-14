document.addEventListener('contextmenu', event => event.preventDefault());

const ipcHandler = (function () {
    let handlerId = 0;
    const handleRegister = new Map();

    function _dispatchResolver(handle, object) {
        const registerObject = handleRegister.get(handle);
        if (registerObject === undefined) {
            return;
        }

        handleRegister.delete(registerObject.handles.callback);
        handleRegister.delete(registerObject.handles.error);

        registerObject.resolver.call(undefined, object); // Invoke via call method to avoid injecting some kind of weird this refrence
    }

    function _respondChannelMessage(message) {
        window.channel.next(message);
    }

    function genHandles() {
        return {
            callback: handlerId++,
            error: handlerId++
        }
    }

    function registerResolver(callback, error) {
        const handles = genHandles();
        handleRegister.set(handles.callback, {
            handles,
            resolver: callback
        });
        handleRegister.set(handles.error, {
            handles,
            resolver: error
        });
        return handles;
    }
    return { _dispatchResolver, _respondChannelMessage, registerResolver };
})();
window.ipcHandler = ipcHandler;

window.addEventListener('application-init', () => {
    window.RustInterface._update({
        sendIPCMessage: window.ipc.postMessage,
        ipcHandler
    });
})

function _triggerWindowClose() {
    const closeEvent = new CustomEvent('close', { cancelable: true })
    window.dispatchEvent(closeEvent);
    if (!closeEvent.defaultPrevented) {
        window.ipc.postMessage('{"callback":0,"error":0,"command":"application-close-window","inner":null}');
    }
}
