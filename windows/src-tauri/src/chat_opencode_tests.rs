use super::wire::{answer, runtime, session, wire};
use super::*;
use serde_json::json;

#[test]
fn opencode_reuses_protected_session_and_sends_selected_model() {
    // Given a server, when chatting twice, then one protected session carries both turns.
    let wire = wire(vec![
        (200, session("ses_test")),
        (200, answer("hello")),
        (200, answer("again")),
    ]);
    runtime().block_on(async {
        let connection = Connection::new(
            &wire.url,
            Auth::Basic {
                username: "opencode".into(),
                password: "test-password".into(),
            },
            "OpenCode",
        )
        .unwrap();
        let mut state = Conversation::default();
        state
            .send(
                &connection,
                ChatProvider::Opencode,
                "provider/model/submodel",
                "first".into(),
            )
            .await
            .unwrap();
        state
            .send(
                &connection,
                ChatProvider::Opencode,
                "provider/model/submodel",
                "second".into(),
            )
            .await
            .unwrap();
    });
    let (headers, create) = wire.received.recv().unwrap();
    assert!(headers.to_ascii_lowercase().contains(
        "authorization: basic b3blbmNvZGU6dGVzdC1wYXNzd29yZA=="
            .to_ascii_lowercase()
            .as_str()
    ));
    assert_eq!(
        create["permission"],
        json!([{"permission":"*","pattern":"*","action":"deny"}])
    );
    let (_, prompt) = wire.received.recv().unwrap();
    assert_eq!(
        prompt["model"],
        json!({"providerID":"provider","modelID":"model/submodel"})
    );
    let (headers, second) = wire.received.recv().unwrap();
    assert!(headers.starts_with("POST /session/ses_test/message "));
    assert_eq!(second["parts"][0]["text"], "second");
    wire.handle.join().unwrap();
}

#[test]
fn opencode_recovers_accepted_history_after_failed_remote_turn() {
    // Given a failed remote turn, when retried, then a new session excludes failed input.
    let wire = wire(vec![
        (200, session("ses_first")),
        (200, answer("accepted reply")),
        (500, json!({})),
        (200, session("ses_second")),
        (200, answer("retry reply")),
    ]);
    runtime().block_on(async {
        let connection = Connection::new(&wire.url, Auth::None, "OpenCode").unwrap();
        let mut state = Conversation::default();
        state
            .send(
                &connection,
                ChatProvider::Opencode,
                "p/m",
                "accepted".into(),
            )
            .await
            .unwrap();
        assert!(state
            .send(
                &connection,
                ChatProvider::Opencode,
                "p/m",
                "failed input".into()
            )
            .await
            .is_err());
        state
            .send(&connection, ChatProvider::Opencode, "p/m", "retry".into())
            .await
            .unwrap();
    });
    for _ in 0..4 {
        wire.received.recv().unwrap();
    }
    let (headers, prompt) = wire.received.recv().unwrap();
    assert!(headers.starts_with("POST /session/ses_second/message "));
    let text = prompt["parts"][0]["text"].as_str().unwrap();
    assert!(text.contains("accepted reply"));
    assert!(!text.contains("failed input"));
    wire.handle.join().unwrap();
}

#[test]
fn opencode_refuses_servers_that_ignore_disabled_permissions() {
    // Given an old server ignoring permissions, when creating a session, then no message is sent.
    let wire = wire(vec![(200, json!({"id":"ses_unsafe"}))]);
    runtime().block_on(async {
        let connection = Connection::new(&wire.url, Auth::None, "OpenCode").unwrap();
        assert!(Conversation::default()
            .send(&connection, ChatProvider::Opencode, "p/m", "hello".into())
            .await
            .err()
            .unwrap()
            .contains("permissions"));
    });
    wire.handle.join().unwrap();
}

#[test]
fn opencode_empty_model_uses_server_default() {
    // Given no selected model, when sending, then the server chooses its configured default.
    let wire = wire(vec![(200, session("ses_default")), (200, answer("hello"))]);
    runtime().block_on(async {
        let connection = Connection::new(&wire.url, Auth::None, "OpenCode").unwrap();
        Conversation::default()
            .send(&connection, ChatProvider::Opencode, "", "query".into())
            .await
            .unwrap();
    });
    wire.received.recv().unwrap();
    let (_, prompt) = wire.received.recv().unwrap();
    assert!(prompt.get("model").is_none());
    wire.handle.join().unwrap();
}

#[test]
fn opencode_model_listing_exposes_only_model_metadata() {
    // Given provider credentials in the upstream response, when listing, then IPC emits only model labels.
    let wire = wire(vec![(
        200,
        json!({"providers":[{"id":"provider","name":"Provider","key":"private-key","models":{"m":{"id":"model/submodel","name":"Display"}}}]}),
    )]);
    runtime().block_on(async {
        let connection = Connection::new(&wire.url, Auth::None, "OpenCode").unwrap();
        let models = provider_opencode::models(&connection).await.unwrap();
        assert_eq!(models[0].id, "provider/model/submodel");
        assert_eq!(
            serde_json::to_value(models).unwrap(),
            json!([{"id":"provider/model/submodel","name":"Provider — Display"}])
        );
    });
    wire.handle.join().unwrap();
}
