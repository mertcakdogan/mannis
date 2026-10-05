// Read-only link to a Beyin vault (avenoxbeyin). Beyin's own engine does the
// work: we run `beyin.py recap` / `context` with fixed arguments and use what it returns.
// The vault path comes from Settings only, and nothing the user or an agent
// typed ever reaches the command line.

use serde::Serialize;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

const SCRIPT: &str = "beyin.py";
const TIMEOUT: Duration = Duration::from_secs(8);
const MAX_OUTPUT: u64 = 256 * 1024;
const MAX_SUMMARY_CHARS: usize = 300;
const MAX_ERROR: u64 = 4 * 1024;
const MAX_QUERY_CHARS: usize = 500;
const MAX_NOTE_CHARS: usize = 4000;
const MAX_TITLE_CHARS: usize = 80;
const CONTEXT_BUDGET_CHARS: usize = 1500;

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct RecapItem {
    pub created_at: String,
    pub summary: String,
}

/// The vault must be an existing folder, by full path, that holds beyin.py.
pub fn check_vault(vault: &str) -> Result<PathBuf, String> {
    let path = Path::new(vault);
    if !path.is_absolute() || !path.is_dir() {
        return Err("The Beyin vault must be the full path of an existing folder.".into());
    }
    if !path.join(SCRIPT).is_file() {
        return Err(format!("{SCRIPT} was not found in that folder."));
    }
    Ok(path.to_path_buf())
}

/// Python launcher plus the arguments that precede the script.
fn python() -> Option<(PathBuf, &'static [&'static str])> {
    #[cfg(windows)]
    if let Some(py) = crate::platform::find_on_path("py") {
        return Some((py, &["-3"]));
    }
    ["python3", "python"]
        .iter()
        .find_map(|name| crate::platform::find_on_path(name))
        .map(|p| (p, &[][..]))
}

pub fn parse_recap(stdout: &str) -> Result<Vec<RecapItem>, String> {
    let json: serde_json::Value =
        serde_json::from_str(stdout).map_err(|_| "Beyin returned something unexpected.".to_string())?;
    let items = json
        .get("items")
        .and_then(|i| i.as_array())
        .ok_or_else(|| "Beyin returned something unexpected.".to_string())?;
    Ok(items
        .iter()
        .filter_map(|item| {
            let summary = item.get("summary")?.as_str()?;
            Some(RecapItem {
                created_at: item.get("created_at").and_then(|v| v.as_str()).unwrap_or_default().into(),
                summary: summary.chars().take(MAX_SUMMARY_CHARS).collect(),
            })
        })
        .collect())
}

/// Blocking: runs `beyin.py` with fixed arguments in the vault and returns stdout.
/// Call from a blocking thread.
fn run(vault: &str, args: &[&str]) -> Result<String, String> {
    run_with_input(vault, args, None)
}

/// `input` (a small JSON document) is written to stdin, so user text never touches the
/// command line.
fn run_with_input(vault: &str, args: &[&str], input: Option<&str>) -> Result<String, String> {
    let dir = check_vault(vault)?;
    let (python, lead) = python().ok_or("Python 3 was not found on PATH.")?;
    let mut cmd = Command::new(python);
    cmd.args(lead)
        .arg(SCRIPT)
        .args(args)
        .current_dir(dir)
        .stdin(if input.is_some() { Stdio::piped() } else { Stdio::null() })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    crate::platform::no_console(&mut cmd);
    let mut child = cmd.spawn().map_err(|e| format!("Could not start Beyin: {e}"))?;
    if let (Some(text), Some(mut stdin)) = (input, child.stdin.take()) {
        stdin
            .write_all(text.as_bytes())
            .map_err(|e| format!("Could not talk to Beyin: {e}"))?;
    }
    let mut stderr = child.stderr.take().ok_or("Could not read Beyin's output.")?;
    let error_reader = std::thread::spawn(move || {
        let mut text = String::new();
        let _ = (&mut stderr).take(MAX_ERROR).read_to_string(&mut text);
        text
    });

    let mut pipe = child.stdout.take().ok_or("Could not read Beyin's output.")?;
    let reader = std::thread::spawn(move || {
        let mut out = String::new();
        let _ = (&mut pipe).take(MAX_OUTPUT).read_to_string(&mut out);
        out
    });

    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if started.elapsed() < TIMEOUT => std::thread::sleep(Duration::from_millis(25)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("Beyin took too long to answer.".into());
            }
        }
    };
    let out = reader.join().unwrap_or_default();
    let errors = error_reader.join().unwrap_or_default();
    if !status.success() {
        return Err(match errors.lines().rev().find(|l| !l.trim().is_empty()) {
            Some(line) => format!("Beyin: {}", line.trim().chars().take(200).collect::<String>()),
            None => "Beyin reported an error. Run `beyin.py doctor` in the vault.".into(),
        });
    }
    Ok(out)
}

pub fn recap(vault: &str, days: u32) -> Result<Vec<RecapItem>, String> {
    let days = days.clamp(1, 366).to_string();
    parse_recap(&run(vault, &["recap", "--days", &days, "--limit", "20"])?)
}

#[derive(Debug, PartialEq, Eq)]
pub struct Note {
    pub source: String,
    pub text: String,
}

pub fn parse_context(stdout: &str) -> Result<Vec<Note>, String> {
    let json: serde_json::Value =
        serde_json::from_str(stdout).map_err(|_| "Beyin returned something unexpected.".to_string())?;
    let records = json
        .get("records")
        .and_then(|r| r.as_array())
        .ok_or_else(|| "Beyin returned something unexpected.".to_string())?;
    Ok(records
        .iter()
        .filter_map(|r| {
            Some(Note {
                source: r.get("source")?.as_str()?.to_string(),
                text: r.get("text")?.as_str()?.to_string(),
            })
        })
        .collect())
}

/// Notes matching `query`, read-only (`--no-sync`: nothing is written to the vault or its
/// runtime). `audience` must be "public" or "internal". The query goes after `--`, so it
/// can never be read as an option.
pub fn context(vault: &str, query: &str, audience: &str) -> Result<Vec<Note>, String> {
    if !matches!(audience, "public" | "internal") {
        return Err("Beyin audience must be public or internal.".into());
    }
    let query: String = query.chars().take(MAX_QUERY_CHARS).collect();
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }
    let budget = CONTEXT_BUDGET_CHARS.to_string();
    parse_context(&run(
        vault,
        &[
            "context", "--audience", audience, "--limit", "3", "--budget-chars", &budget,
            "--no-sync", "--", &query,
        ],
    )?)
}

/// Lower-case ASCII slug for a file name; Turkish letters are folded, the rest dropped.
fn slug(title: &str) -> String {
    let mut out = String::new();
    for c in title.chars().flat_map(char::to_lowercase) {
        let c = match c {
            'ı' => 'i',
            'ş' => 's',
            'ç' => 'c',
            'ğ' => 'g',
            'ö' => 'o',
            'ü' => 'u',
            c => c,
        };
        if c.is_ascii_alphanumeric() {
            out.push(c);
        } else if !out.ends_with('-') && !out.is_empty() {
            out.push('-');
        }
    }
    let out: String = out.trim_end_matches('-').chars().take(40).collect();
    if out.is_empty() { "note".into() } else { out }
}

/// Builds the vault-relative source path and the JSON `note-create` reads on stdin.
/// Beyin only accepts new notes under `notes/` or `knowledge/` and never overwrites;
/// the time in the name keeps two notes with one title apart.
fn note_payload(title: &str, text: &str, t: &crate::platform::LocalTime) -> Result<(String, String), String> {
    let title = title.trim();
    let text = text.trim();
    if title.is_empty() || text.is_empty() {
        return Err("A note needs a title and some text.".into());
    }
    if title.chars().count() > MAX_TITLE_CHARS || text.chars().count() > MAX_NOTE_CHARS {
        return Err("That note is too long.".into());
    }
    let source = format!(
        "knowledge/mannis-{:04}{:02}{:02}-{:02}{:02}{:02}-{}.md",
        t.year, t.month, t.day, t.hour, t.minute, t.second, slug(title)
    );
    let payload = serde_json::json!({
        "source": source,
        "text": format!("# {title}\n\n{text}"),
        "metadata": {
            "visibility": "internal",
            "updated_at": format!("{:04}-{:02}-{:02}", t.year, t.month, t.day),
        },
    });
    Ok((source, payload.to_string()))
}

/// Saves a note into the vault through Beyin's own `note-create` (it checks the path,
/// filters secrets and refuses to overwrite). Returns the vault-relative source path.
pub fn save_note(vault: &str, title: &str, text: &str) -> Result<String, String> {
    let (source, payload) = note_payload(title, text, &crate::platform::local_time())?;
    run_with_input(vault, &["note-create"], Some(&payload))?;
    Ok(source)
}

/// What the chat model receives. With no notes the question is unchanged.
pub fn prompt_with_notes(query: &str, notes: &[Note]) -> String {
    if notes.is_empty() {
        return query.to_string();
    }
    let mut out = String::from("Notes from the user's Beyin vault (may be relevant, may be out of date):\n");
    for note in notes {
        out.push_str(&format!("- [{}] {}\n", note.source, note.text.trim()));
    }
    out.push_str("\nQuestion: ");
    out.push_str(query);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_items_and_drops_what_it_cannot_use() {
        let json = r#"{"status":"ok","items":[
            {"created_at":"2026-10-04T10:00:00Z","summary":"Shipped the picker","source":"s","refs":["x"]},
            {"created_at":"2026-10-03T10:00:00Z"},
            {"summary":"No date"}]}"#;
        let items = parse_recap(json).unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].summary, "Shipped the picker");
        assert_eq!(items[1].created_at, "");
    }

    #[test]
    fn long_summaries_are_cut() {
        let long = "x".repeat(1000);
        let json = format!(r#"{{"items":[{{"summary":"{long}"}}]}}"#);
        assert_eq!(parse_recap(&json).unwrap()[0].summary.chars().count(), MAX_SUMMARY_CHARS);
    }

    #[test]
    fn rejects_non_json_and_missing_items() {
        assert!(parse_recap("hello").is_err());
        assert!(parse_recap(r#"{"status":"ok"}"#).is_err());
    }

    #[test]
    fn vault_must_be_an_absolute_existing_folder_with_the_script() {
        assert!(check_vault("relative/path").is_err());
        assert!(check_vault("").is_err());
        let dir = std::env::temp_dir().join(format!("beyin-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        assert!(check_vault(dir.to_str().unwrap()).is_err());
        std::fs::write(dir.join(SCRIPT), "").unwrap();
        assert!(check_vault(dir.to_str().unwrap()).is_ok());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn parses_context_records() {
        let json = r#"{"records":[{"source":"a.md","text":"Use pnpm","id":"1"},{"id":"2"}],"abstained":false}"#;
        assert_eq!(
            parse_context(json).unwrap(),
            vec![Note { source: "a.md".into(), text: "Use pnpm".into() }]
        );
        assert!(parse_context("nope").is_err());
        assert!(parse_context(r#"{"abstained":true}"#).is_err());
    }

    #[test]
    fn prompt_is_unchanged_without_notes_and_labelled_with_them() {
        assert_eq!(prompt_with_notes("hi", &[]), "hi");
        let notes = [Note { source: "a.md".into(), text: "Use pnpm\n".into() }];
        let p = prompt_with_notes("which manager?", &notes);
        assert!(p.contains("- [a.md] Use pnpm\n"));
        assert!(p.ends_with("Question: which manager?"));
    }

    fn at() -> crate::platform::LocalTime {
        crate::platform::LocalTime { year: 2026, month: 10, day: 5, hour: 9, minute: 7, second: 3 }
    }

    #[test]
    fn slug_folds_turkish_and_drops_the_rest() {
        assert_eq!(slug("Çok Önemli Karar: Şimdi!"), "cok-onemli-karar-simdi");
        assert_eq!(slug("日本語"), "note");
        assert_eq!(slug("---"), "note");
        assert!(slug(&"a".repeat(200)).len() <= 40);
    }

    #[test]
    fn note_goes_under_knowledge_with_a_title_heading_and_body_only_text() {
        let (source, json) = note_payload("Use pnpm", "---\nnot frontmatter", &at()).unwrap();
        assert_eq!(source, "knowledge/mannis-20261005-090703-use-pnpm.md");
        let v: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(v["source"], source);
        assert!(v["text"].as_str().unwrap().starts_with("# Use pnpm\n\n"));
        assert_eq!(v["metadata"]["visibility"], "internal");
        assert_eq!(v["metadata"]["updated_at"], "2026-10-05");
    }

    #[test]
    fn note_rejects_empty_and_oversized_input() {
        assert!(note_payload("  ", "x", &at()).is_err());
        assert!(note_payload("t", "   ", &at()).is_err());
        assert!(note_payload(&"t".repeat(81), "x", &at()).is_err());
        assert!(note_payload("t", &"x".repeat(4001), &at()).is_err());
    }

    #[test]
    fn context_rejects_unknown_audience_and_skips_blank_queries() {
        assert!(context("C:\\nowhere", "x", "private").is_err());
        assert_eq!(context("C:\\nowhere", "   ", "public").unwrap(), vec![]);
    }
}
