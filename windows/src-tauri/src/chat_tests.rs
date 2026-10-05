use super::wire::{completion, runtime, wire};
use super::*;
use serde_json::json;

#[test]
fn router_preserves_successful_history_and_rolls_back_failed_turns() {
    // Given a wire server with a rejected turn, when retrying, then only accepted turns persist.
    let wire = wire(vec![
        (200, completion("first reply")),
        (500, json!({})),
        (200, completion("second reply")),
    ]);
    runtime().block_on(async {
        let connection =
            Connection::new(&wire.url, Auth::Bearer("test-key".into()), "9router").unwrap();
        let mut state = Conversation::default();
        assert_eq!(
            state
                .send(
                    &connection,
                    ChatProvider::NineRouter,
                    "selected/model",
                    "first".into()
                )
                .await
                .unwrap()
                .text,
            "first reply"
        );
        assert!(state
            .send(
                &connection,
                ChatProvider::NineRouter,
                "selected/model",
                "failed".into()
            )
            .await
            .is_err());
        assert_eq!(
            state
                .send(
                    &connection,
                    ChatProvider::NineRouter,
                    "selected/model",
                    "second".into()
                )
                .await
                .unwrap()
                .text,
            "second reply"
        );
    });
    let (headers, first) = wire.received.recv().unwrap();
    assert!(headers
        .to_ascii_lowercase()
        .contains("authorization: bearer test-key"));
    assert_eq!(first["model"], "selected/model");
    wire.received.recv().unwrap();
    let (_, third) = wire.received.recv().unwrap();
    assert_eq!(
        third["messages"],
        json!([{"role":"user","content":"first"},{"role":"assistant","content":"first reply"},{"role":"user","content":"second"}])
    );
    wire.handle.join().unwrap();
}

#[test]
fn auth_error_is_actionable_without_exposing_upstream_secrets() {
    // Given a rejected credential, when calling the server, then the error is safe and actionable.
    let wire = wire(vec![(401, json!({"error":{"message":"secret api token"}}))]);
    runtime().block_on(async {
        let connection = Connection::new(&wire.url, Auth::None, "9router").unwrap();
        let error = provider_router::models(&connection).await.err().unwrap();
        assert!(error.contains("authentication"));
        assert!(!error.contains("secret api token"));
    });
    wire.handle.join().unwrap();
}

#[test]
fn model_list_decodes_and_sorts_router_models() {
    // Given model metadata, when listed, then IDs and display labels are usable by the UI.
    let wire = wire(vec![(
        200,
        json!({"data":[{"id":"z"},{"id":"a","name":"A model"}]}),
    )]);
    runtime().block_on(async {
        let connection = Connection::new(&wire.url, Auth::None, "9router").unwrap();
        let models = provider_router::models(&connection).await.unwrap();
        assert_eq!(
            models.iter().map(|m| m.id.as_str()).collect::<Vec<_>>(),
            vec!["a", "z"]
        );
        assert_eq!(models[0].name, "A model");
    });
    wire.handle.join().unwrap();
}

#[test]
#[ignore = "requires an explicitly configured live 9router server and credentials"]
fn live_router_adapter_smoke() {
    // Given an explicitly opted-in live server, when chatting, then the adapter returns text.
    let url = std::env::var("MANNIS_TEST_URL").expect("MANNIS_TEST_URL required");
    let model = std::env::var("MANNIS_TEST_MODEL").expect("MANNIS_TEST_MODEL required");
    let auth = std::env::var("MANNIS_TEST_API_KEY")
        .ok()
        .filter(|value| !value.is_empty())
        .map_or(Auth::None, Auth::Bearer);
    runtime().block_on(async {
        let connection = Connection::new(&url, auth, "9router").unwrap();
        let reply = Conversation::default()
            .send(
                &connection,
                ChatProvider::NineRouter,
                &model,
                "Reply with a short greeting.".into(),
            )
            .await
            .unwrap();
        assert!(!reply.text.trim().is_empty());
    });
}

#[test]
fn empty_router_response_is_not_added_to_history() {
    // Given a tool-only/empty response, when sending, then no failed turn enters the next request.
    let wire = wire(vec![
        (200, json!({"choices":[{"message":{"content":null}}]})),
        (200, completion("reply")),
    ]);
    runtime().block_on(async {
        let connection = Connection::new(&wire.url, Auth::None, "9router").unwrap();
        let mut state = Conversation::default();
        assert!(state
            .send(&connection, ChatProvider::NineRouter, "m", "failed".into())
            .await
            .is_err());
        state
            .send(&connection, ChatProvider::NineRouter, "m", "retry".into())
            .await
            .unwrap();
    });
    wire.received.recv().unwrap();
    let (_, retry) = wire.received.recv().unwrap();
    assert_eq!(
        retry["messages"],
        json!([{"role":"user","content":"retry"}])
    );
    wire.handle.join().unwrap();
}

#[test]
fn redirects_are_reported_without_forwarding_credentials() {
    // Given a credentialled redirect, when requesting models, then the redirect is not followed.
    let wire = wire(vec![(302, json!({}))]);
    runtime().block_on(async {
        let connection =
            Connection::new(&wire.url, Auth::Bearer("private-key".into()), "9router").unwrap();
        let error = provider_router::models(&connection).await.err().unwrap();
        assert!(error.contains("302"));
    });
    wire.handle.join().unwrap();
}

#[test]
fn router_requires_a_model_before_network_access() {
    // Given an empty configured model, when chatting, then a local actionable error precedes I/O.
    runtime().block_on(async {
        let connection = Connection::new("http://127.0.0.1:1", Auth::None, "9router").unwrap();
        let error = Conversation::default()
            .send(&connection, ChatProvider::NineRouter, "", "hello".into())
            .await
            .err()
            .unwrap();
        assert!(error.contains("Choose a 9router model"));
    });
}
