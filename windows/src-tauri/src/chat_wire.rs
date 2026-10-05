use serde_json::{json, Value};
use std::{
    io::{Read, Write},
    net::TcpListener,
    sync::mpsc,
    thread,
};

pub(super) struct Wire {
    pub(super) url: String,
    pub(super) received: mpsc::Receiver<(String, Value)>,
    pub(super) handle: thread::JoinHandle<()>,
}
pub(super) fn wire(responses: Vec<(u16, Value)>) -> Wire {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let (tx, received) = mpsc::channel();
    let handle = thread::spawn(move || {
        for (status, body) in responses {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(std::time::Duration::from_secs(10)))
                .unwrap();
            let mut bytes = Vec::new();
            let header_end = loop {
                let mut block = [0; 4096];
                let n = stream.read(&mut block).unwrap();
                assert!(n > 0);
                bytes.extend_from_slice(&block[..n]);
                if let Some(pos) = bytes.windows(4).position(|v| v == b"\r\n\r\n") {
                    break pos + 4;
                }
            };
            let headers = String::from_utf8(bytes[..header_end].to_vec()).unwrap();
            let length = headers
                .lines()
                .find_map(|line| {
                    line.to_ascii_lowercase()
                        .strip_prefix("content-length: ")
                        .and_then(|v| v.parse::<usize>().ok())
                })
                .unwrap_or(0);
            while bytes.len() < header_end + length {
                let mut block = [0; 4096];
                let n = stream.read(&mut block).unwrap();
                assert!(n > 0);
                bytes.extend_from_slice(&block[..n]);
            }
            let request = if length == 0 {
                Value::Null
            } else {
                serde_json::from_slice(&bytes[header_end..header_end + length]).unwrap()
            };
            tx.send((headers, request)).unwrap();
            let body = body.to_string();
            write!(stream, "HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
        }
    });
    Wire {
        url,
        received,
        handle,
    }
}
pub(super) fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap()
}
pub(super) fn completion(text: &str) -> Value {
    json!({"choices":[{"message":{"content":text}}]})
}
pub(super) fn session(id: &str) -> Value {
    json!({"id":id,"permission":[{"permission":"*","pattern":"*","action":"deny"}]})
}
pub(super) fn answer(text: &str) -> Value {
    json!({"info":{},"parts":[{"type":"text","text":text}]})
}
