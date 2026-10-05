use super::wire::runtime;
use super::*;

#[test]
fn reset_waits_for_inflight_turn_and_clears_history() {
    // Given a held send lock, when reset is queued, then reset completes after the turn and clears state.
    runtime().block_on(async {
        let chat = std::sync::Arc::new(Chat::default());
        let mut turn = chat.state.lock().await;
        let resetting = chat.clone();
        let reset = tokio::spawn(async move {
            resetting.reset().await;
        });
        tokio::task::yield_now().await;
        assert!(!reset.is_finished());
        turn.messages.push(Message {
            role: Role::User,
            content: "accepted before reset".into(),
        });
        turn.session = Some("ses_before_reset".into());
        drop(turn);
        reset.await.unwrap();
        let state = chat.state.lock().await;
        assert!(state.messages.is_empty());
        assert!(state.session.is_none());
    });
}
