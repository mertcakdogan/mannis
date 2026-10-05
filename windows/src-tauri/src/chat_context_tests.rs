use super::*;
use std::sync::atomic::{AtomicU64, Ordering};

struct Fixture(std::path::PathBuf);
impl Fixture {
    fn new(extension: &str, contents: &[u8]) -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "mannis-{}-{stamp}-{}.{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed),
            extension
        ));
        std::fs::write(&path, contents).unwrap();
        Self(path)
    }
    fn context(&self) -> ChatContext {
        ChatContext::File {
            name: "drop".into(),
            path: self.0.to_string_lossy().into_owned(),
        }
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

#[test]
fn dropped_text_is_inlined_without_sending_local_path() {
    // Given dropped code, when building context, then its contents accompany the query.
    let file = Fixture::new("rs", b"fn example() {}");
    let result = text("query", Some(&file.context())).unwrap();
    assert!(result.contains("fn example() {}"));
    assert!(!result.contains(file.0.to_str().unwrap()));
}
#[test]
fn unsupported_binary_is_rejected_explicitly() {
    // Given binary contents, when building context, then no request can silently omit the file.
    let file = Fixture::new("bin", &[0, 1, 2]);
    assert!(text("query", Some(&file.context()))
        .err()
        .unwrap()
        .contains("binary"));
}
#[test]
fn pdf_is_refused_even_when_its_bytes_are_utf8() {
    // Given a PDF with ASCII bytes, when dropped, then it is not mislabelled as plain text.
    let file = Fixture::new("pdf", b"%PDF-1.7 ascii content");
    assert!(text("query", Some(&file.context())).is_err());
}
#[test]
fn oversized_text_is_rejected() {
    // Given an oversized text file, when dropped, then the size limit is explicit.
    let file = Fixture::new("txt", &vec![b'a'; 200_001]);
    assert!(text("query", Some(&file.context()))
        .err()
        .unwrap()
        .contains("200 KB"));
}
#[test]
fn maximum_size_text_is_accepted() {
    // Given text at the limit, when dropped, then no bytes are lost.
    let file = Fixture::new("txt", &vec![b'a'; 200_000]);
    assert!(text("query", Some(&file.context())).is_ok());
}
