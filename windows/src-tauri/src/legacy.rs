// The app used to be called Coucou. These are the one-time moves that keep what
// it stored under that name: preferences, the file inbox and the log.

use crate::platform::{config_dir, local_dir, LEGACY_DIR};
use std::io;
use std::path::Path;

/// Moves every entry of `old` into `new` except those named in `skip`, which stay
/// behind. Does nothing when `old` is missing or `new` already exists, so it never
/// merges into or overwrites a folder the new app has started using.
pub fn move_contents(old: &Path, new: &Path, skip: &[&str]) -> io::Result<()> {
    if !old.is_dir() || new.exists() {
        return Ok(());
    }
    std::fs::create_dir_all(new)?;
    for entry in std::fs::read_dir(old)? {
        let entry = entry?;
        if skip.iter().any(|s| entry.file_name() == *s) {
            continue;
        }
        std::fs::rename(entry.path(), new.join(entry.file_name()))?;
    }
    let _ = std::fs::remove_dir(old); // only succeeds when nothing was left behind
    Ok(())
}

/// Call before settings are loaded. The old `bin` folder stays where it is: Claude
/// Code hook entries written by the old app still point into it, and the old relay
/// exits quietly when it finds no app to talk to, until the hooks are reinstalled.
pub fn migrate() {
    for (new, skip) in [(config_dir(), &[][..]), (local_dir(), &["bin"][..])] {
        let _ = move_contents(&new.with_file_name(LEGACY_DIR), &new, skip);
    }
    crate::secrets::migrate_legacy();
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("mannis-legacy-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn moves_everything_except_what_is_skipped() {
        let root = scratch("move");
        let (old, new) = (root.join("Coucou"), root.join("Mannis"));
        std::fs::create_dir_all(old.join("bin")).unwrap();
        std::fs::create_dir_all(old.join("inbox")).unwrap();
        std::fs::write(old.join("settings.json"), "{}").unwrap();
        move_contents(&old, &new, &["bin"]).unwrap();
        assert!(new.join("settings.json").is_file());
        assert!(new.join("inbox").is_dir());
        assert!(!new.join("bin").exists());
        assert!(old.join("bin").is_dir());
        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn an_existing_new_folder_is_left_alone() {
        let root = scratch("exists");
        let (old, new) = (root.join("Coucou"), root.join("Mannis"));
        std::fs::create_dir_all(&old).unwrap();
        std::fs::create_dir_all(&new).unwrap();
        std::fs::write(old.join("settings.json"), "old").unwrap();
        std::fs::write(new.join("settings.json"), "new").unwrap();
        move_contents(&old, &new, &[]).unwrap();
        assert_eq!(std::fs::read_to_string(new.join("settings.json")).unwrap(), "new");
        assert!(old.join("settings.json").is_file());
        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn a_missing_old_folder_is_fine() {
        let root = scratch("missing");
        move_contents(&root.join("Coucou"), &root.join("Mannis"), &[]).unwrap();
        assert!(!root.join("Mannis").exists());
        std::fs::remove_dir_all(&root).unwrap();
    }
}
