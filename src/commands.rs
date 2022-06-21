use crate::ipc::Invoke;


fn get_wordlist_impl() -> String {
    include_str!("../resources/wordlist.txt").to_string()
}

pub fn get_wordlist(invoke: Invoke) {
    invoke.resolver.resolve(get_wordlist_impl());
}
