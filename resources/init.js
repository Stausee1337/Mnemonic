document.addEventListener('contextmenu', event => event.preventDefault());

// console.log('init.js')
const ipcHandler = (function () {
    let handlerId = 0;
    const handleRegister = new Map();

    function _dispatchResolver(handle, object) {
        const registerObject = handleRegister.get(handle);
        // console.log(handle, object, registerObject);
        if (registerObject === undefined) {
            return;
        }

        // console.log('executed');

        handleRegister.delete(registerObject.handles.callback);
        handleRegister.delete(registerObject.handles.error);

        // console.log('executed');

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