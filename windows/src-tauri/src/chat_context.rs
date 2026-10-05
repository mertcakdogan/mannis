use std::io::Read;

use crate::claude::ChatContext;

const MAX_INLINE: u64 = 200_000;

/// Read only user-dropped text; local providers receive no filesystem paths.
pub(crate) fn text(query: &str, context: Option<&ChatContext>) -> Result<String, String> {
    let prefix = match context {
        Some(ChatContext::File { name, path }) => {
            let extension = std::path::Path::new(path)
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();
            if matches!(
                extension.as_str(),
                "pdf"
                    | "png"
                    | "jpg"
                    | "jpeg"
                    | "gif"
                    | "webp"
                    | "doc"
                    | "docx"
                    | "zip"
                    | "exe"
                    | "mp3"
                    | "mp4"
                    | "xlsx"
            ) {
                return Err("This provider supports text and code files only; binary files are not supported.".into());
            }
            let file = std::fs::File::open(path)
                .map_err(|_| "Could not read the dropped file.".to_string())?;
            if !file
                .metadata()
                .map_err(|_| "Could not inspect the dropped file.".to_string())?
                .is_file()
            {
                return Err("Drop a regular text or code file.".into());
            }
            let mut bytes = Vec::new();
            file.take(MAX_INLINE + 1)
                .read_to_end(&mut bytes)
                .map_err(|_| "Could not read the dropped file.".to_string())?;
            if bytes.len() > MAX_INLINE as usize {
                return Err("Text files must be at most 200 KB.".into());
            }
            let contents = String::from_utf8(bytes).map_err(|_| "This provider supports text and code files only; binary files are not supported.".to_string())?;
            if contents
                .chars()
                .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t'))
            {
                return Err("This provider supports text and code files only; binary files are not supported.".into());
            }
            format!("File: {name}\nFile contents:\n{contents}\n\n")
        }
        Some(ChatContext::Window {
            app_name,
            title,
            url,
        }) => {
            let mut prefix = format!("Context — App: {app_name}, Window: {title}");
            if let Some(url) = url {
                prefix.push_str(&format!(", URL: {url}"));
            }
            prefix.push_str("\n\n");
            prefix
        }
        None => String::new(),
    };
    Ok(format!("{prefix}{query}"))
}

#[cfg(test)]
#[path = "chat_context_tests.rs"]
mod tests;
