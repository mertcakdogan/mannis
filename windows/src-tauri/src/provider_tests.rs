use super::*;

#[test]
fn endpoint_rejects_credentials_and_insecure_remote_hosts() {
    // Given untrusted configuration, when parsed, then unsafe URLs fail.
    for url in [
        "http://example.com",
        "https://user:pass@example.com",
        "https://@example.com",
        "https://example.com?key=secret",
        "https://example.com#fragment",
        "file:///tmp/server",
    ] {
        assert!(Endpoint::parse(url).is_err(), "accepted {url}");
    }
}

#[test]
fn endpoint_accepts_loopback_and_https_and_preserves_base_path() {
    // Given supported URLs, when routing, then the configured prefix survives.
    for url in [
        "http://127.0.0.1:20128/v1",
        "http://localhost:4096",
        "http://[::1]:4096",
        "https://example.com/api/",
    ] {
        let endpoint = Endpoint::parse(url).unwrap();
        assert!(endpoint
            .route(&["models"])
            .unwrap()
            .path()
            .ends_with("/models"));
    }
    assert_eq!(
        Endpoint::parse("http://127.0.0.1:20128/v1")
            .unwrap()
            .route(&["models"])
            .unwrap()
            .path(),
        "/v1/models"
    );
}

#[test]
fn legacy_settings_default_to_anthropic_and_provider_urls() {
    // Given old settings, when decoded, then the existing chat remains selected.
    let mut old = serde_json::to_value(crate::settings::Settings::default()).unwrap();
    for key in [
        "chatProvider",
        "opencodeUrl",
        "opencodeUsername",
        "opencodeModel",
        "nineRouterUrl",
        "nineRouterModel",
    ] {
        old.as_object_mut().unwrap().remove(key);
    }
    let settings: crate::settings::Settings = serde_json::from_value(old).unwrap();
    assert_eq!(
        settings.chat_provider,
        crate::settings::ChatProvider::Anthropic
    );
    assert_eq!(settings.opencode_url, "http://127.0.0.1:4096");
    assert_eq!(settings.nine_router_url, "http://127.0.0.1:20128/v1");
}

#[test]
fn provider_names_match_frontend_contract() {
    // Given provider choices, when encoded, then the UI enum values are stable.
    use crate::settings::ChatProvider;
    for (provider, name) in [
        (ChatProvider::Anthropic, "anthropic"),
        (ChatProvider::Opencode, "opencode"),
        (ChatProvider::NineRouter, "nineRouter"),
    ] {
        assert_eq!(serde_json::to_value(provider).unwrap(), name);
    }
}

#[test]
fn settings_reject_selected_unsafe_server_url() {
    // Given a configured remote HTTP server, when saved, then validation rejects it.
    let settings = crate::settings::Settings {
        chat_provider: crate::settings::ChatProvider::NineRouter,
        nine_router_url: "http://example.com/v1".into(),
        ..Default::default()
    };
    assert!(crate::settings::validate(&settings).is_err());
}
