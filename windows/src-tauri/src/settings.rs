// Preferences, stored as plain JSON in settings.json under platform::config_dir().
// No secret ever lands here — API keys live in the OS keychain (see secrets.rs).

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ChatProvider {
    #[default]
    Anthropic,
    Opencode,
    NineRouter,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub sound_enabled: bool,
    pub sound_volume: f64,
    pub auto_close_interval: f64,
    pub absence_interval: f64,
    pub active_integrations: Vec<String>,
    /// "primary" = the main display, "cursor" = whichever display the mouse is on.
    pub screen: String,
    pub autostart: bool,
    pub hooks_installed: bool,
    /// Claude model used by the chat. Changeable in the settings window.
    /// Defaulted explicitly so a settings.json written by an older build still loads.
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default)]
    pub chat_provider: ChatProvider,
    #[serde(default = "default_opencode_url")]
    pub opencode_url: String,
    #[serde(default = "default_opencode_username")]
    pub opencode_username: String,
    #[serde(default)]
    pub opencode_model: String,
    #[serde(default = "default_nine_router_url")]
    pub nine_router_url: String,
    #[serde(default)]
    pub nine_router_model: String,
    /// Active companion id. Unknown ids are resolved by the front end.
    #[serde(default = "default_character")]
    pub character: String,
    /// Full path of a Beyin vault. Empty = the Beyin link is off.
    #[serde(default)]
    pub beyin_vault: String,
    /// Rule-based nudges from companion events; no model involved.
    #[serde(default = "default_true")]
    pub proactive: bool,
    /// Send matching Beyin notes to the chat provider with each question. Off by default.
    #[serde(default)]
    pub beyin_chat: bool,
    /// "public" or "internal": which notes may leave the vault for the chat provider.
    #[serde(default = "default_beyin_audience")]
    pub beyin_audience: String,
}

fn default_true() -> bool {
    true
}

fn default_character() -> String {
    "stannis".into()
}

fn default_beyin_audience() -> String {
    "public".into()
}

fn default_model() -> String {
    crate::claude::DEFAULT_MODEL.to_string()
}

fn default_opencode_url() -> String {
    "http://127.0.0.1:4096".into()
}
fn default_opencode_username() -> String {
    "opencode".into()
}
fn default_nine_router_url() -> String {
    "http://127.0.0.1:20128/v1".into()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            sound_enabled: true,
            sound_volume: 0.12,
            auto_close_interval: 15.0,
            absence_interval: 180.0,
            active_integrations: vec![
                "integration_resend".into(),
                "integration_n8n".into(),
                "integration_vercel".into(),
                "integration_github".into(),
            ],
            screen: "primary".into(),
            autostart: false,
            hooks_installed: false,
            model: default_model(),
            chat_provider: ChatProvider::default(),
            opencode_url: default_opencode_url(),
            opencode_username: default_opencode_username(),
            opencode_model: String::new(),
            nine_router_url: default_nine_router_url(),
            nine_router_model: String::new(),
            character: default_character(),
            beyin_vault: String::new(),
            proactive: true,
            beyin_chat: false,
            beyin_audience: default_beyin_audience(),
        }
    }
}

pub use crate::platform::{config_dir, local_dir};

pub fn hook_exe_path() -> PathBuf {
    local_dir().join("bin").join(crate::platform::HOOK_EXE)
}

fn settings_path() -> PathBuf {
    config_dir().join("settings.json")
}

pub fn load() -> Settings {
    match std::fs::read(settings_path()) {
        Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_default(),
        Err(_) => Settings::default(),
    }
}

pub fn save(settings: &Settings) -> std::io::Result<()> {
    let dir = config_dir();
    crate::platform::ensure_private_dir(&dir)?;
    let json = serde_json::to_vec_pretty(settings)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
    std::fs::write(settings_path(), json)
}

pub fn validate(settings: &Settings) -> Result<(), String> {
    if !matches!(settings.beyin_audience.as_str(), "public" | "internal") {
        return Err("Beyin audience must be public or internal.".into());
    }
    if !settings.beyin_vault.is_empty() {
        crate::beyin::check_vault(&settings.beyin_vault)?;
    }
    match settings.chat_provider {
        ChatProvider::Anthropic => Ok(()),
        ChatProvider::Opencode => {
            crate::provider::Endpoint::parse(&settings.opencode_url)?;
            if !settings.opencode_model.is_empty() {
                crate::provider_opencode::parse_model(&settings.opencode_model)?;
            }
            Ok(())
        }
        ChatProvider::NineRouter => {
            crate::provider::Endpoint::parse(&settings.nine_router_url).map(|_| ())
        }
    }
}

#[cfg(test)]
mod character_tests {
    use super::*;

    #[test]
    fn character_defaults_to_stannis() {
        assert_eq!(Settings::default().character, "stannis");
    }

    #[test]
    fn old_settings_json_without_character_still_loads() {
        let mut v = serde_json::to_value(Settings::default()).unwrap();
        v.as_object_mut().unwrap().remove("character");
        let s: Settings = serde_json::from_value(v).unwrap();
        assert_eq!(s.character, "stannis");
    }

    #[test]
    fn chosen_character_round_trips() {
        let s = Settings { character: "mochi".into(), ..Settings::default() };
        let back: Settings = serde_json::from_slice(&serde_json::to_vec(&s).unwrap()).unwrap();
        assert_eq!(back.character, "mochi");
    }
}

#[cfg(test)]
mod beyin_setting_tests {
    use super::*;

    #[test]
    fn beyin_chat_is_off_and_public_by_default() {
        let s = Settings::default();
        assert!(!s.beyin_chat);
        assert_eq!(s.beyin_audience, "public");
        assert!(s.beyin_vault.is_empty());
    }

    #[test]
    fn suggestions_are_on_by_default_and_old_files_get_that_default() {
        assert!(Settings::default().proactive);
        let mut v = serde_json::to_value(Settings::default()).unwrap();
        v.as_object_mut().unwrap().remove("proactive");
        assert!(serde_json::from_value::<Settings>(v).unwrap().proactive);
    }

    #[test]
    fn unknown_audience_is_rejected() {
        let s = Settings { beyin_audience: "private".into(), ..Settings::default() };
        assert!(validate(&s).is_err());
    }
}
