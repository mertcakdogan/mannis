//! Serializes turns and reset; only successful turns enter local history.
use crate::{
    chat_context,
    claude::{self, ChatContext, ChatReply},
    provider::{Auth, ChatModel, Connection, Endpoint},
    provider_opencode,
    provider_router::{self, Message, Role},
    secrets,
    settings::{ChatProvider, Settings},
};
use tokio::sync::Mutex;

#[derive(Default)]
pub struct Chat {
    state: Mutex<Conversation>,
    anthropic: claude::Chat,
}
#[derive(Default)]
struct Conversation {
    identity: Option<Identity>,
    messages: Vec<Message>,
    session: Option<String>,
    anthropic_model: Option<String>,
}
#[derive(PartialEq, Eq)]
struct Identity {
    provider: ChatProvider,
    endpoint: Endpoint,
    username: String,
    model: String,
}

fn connection(settings: &Settings) -> Result<Connection, String> {
    match settings.chat_provider {
        ChatProvider::Anthropic => Err("Anthropic uses its built-in connection.".into()),
        ChatProvider::Opencode => {
            let auth = match secrets::get("opencode-server-password") {
                Some(password) => Auth::Basic {
                    username: settings.opencode_username.clone(),
                    password,
                },
                None => Auth::None,
            };
            Connection::new(&settings.opencode_url, auth, "OpenCode")
        }
        ChatProvider::NineRouter => Connection::new(
            &settings.nine_router_url,
            secrets::get("nine-router-api-key").map_or(Auth::None, Auth::Bearer),
            "9router",
        ),
    }
}

pub async fn models(settings: &Settings) -> Result<Vec<ChatModel>, String> {
    match settings.chat_provider {
        ChatProvider::Anthropic => Ok(vec![ChatModel {
            id: claude::DEFAULT_MODEL.into(),
            name: claude::DEFAULT_MODEL.into(),
        }]),
        ChatProvider::Opencode => provider_opencode::models(&connection(settings)?).await,
        ChatProvider::NineRouter => provider_router::models(&connection(settings)?).await,
    }
}

impl Chat {
    pub async fn reset(&self) {
        let mut state = self.state.lock().await;
        self.anthropic.reset();
        *state = Conversation::default();
    }

    pub async fn send(
        &self,
        settings: &Settings,
        query: String,
        context: Option<ChatContext>,
    ) -> Result<ChatReply, String> {
        let mut state = self.state.lock().await;
        match settings.chat_provider {
            ChatProvider::Anthropic => {
                if state.identity.is_some()
                    || state.anthropic_model.as_deref() != Some(&settings.model)
                {
                    self.anthropic.reset();
                    *state = Conversation {
                        anthropic_model: Some(settings.model.clone()),
                        ..Conversation::default()
                    };
                }
                claude::send(&self.anthropic, &settings.model, query, context).await
            }
            ChatProvider::Opencode | ChatProvider::NineRouter => {
                let connection = connection(settings)?;
                let (model, username) = match settings.chat_provider {
                    ChatProvider::Opencode => {
                        (&settings.opencode_model, settings.opencode_username.clone())
                    }
                    ChatProvider::NineRouter => (&settings.nine_router_model, String::new()),
                    ChatProvider::Anthropic => return Err("Invalid provider dispatch.".into()),
                };
                let identity = Identity {
                    provider: settings.chat_provider,
                    endpoint: connection.endpoint.clone(),
                    username,
                    model: model.clone(),
                };
                if state.identity.as_ref() != Some(&identity) {
                    self.anthropic.reset();
                    *state = Conversation {
                        identity: Some(identity),
                        ..Conversation::default()
                    };
                }
                let context = if state.messages.is_empty() {
                    context.as_ref()
                } else {
                    None
                };
                let text = chat_context::text(&query, context)?;
                state
                    .send(&connection, settings.chat_provider, model, text)
                    .await
            }
        }
    }
}

impl Conversation {
    async fn send(
        &mut self,
        connection: &Connection,
        provider: ChatProvider,
        model: &str,
        text: String,
    ) -> Result<ChatReply, String> {
        let result = match provider {
            ChatProvider::NineRouter => {
                let mut pending = self.messages.clone();
                pending.push(Message {
                    role: Role::User,
                    content: text.clone(),
                });
                provider_router::send(connection, model, &pending).await
            }
            ChatProvider::Opencode => {
                if !model.is_empty() {
                    provider_opencode::parse_model(model)?;
                }
                let prompt = if self.session.is_none() {
                    // A new remote session recovers accepted history after an uncertain failed request.
                    let mut prompt = String::new();
                    for message in &self.messages {
                        let role = match message.role {
                            Role::User => "User",
                            Role::Assistant => "Assistant",
                        };
                        prompt.push_str(&format!("{role}: {}\n\n", message.content));
                    }
                    prompt.push_str(&text);
                    self.session = Some(provider_opencode::create(connection).await?);
                    prompt
                } else {
                    text.clone()
                };
                let session = self
                    .session
                    .as_deref()
                    .ok_or_else(|| "OpenCode session unavailable.".to_string())?;
                let result = provider_opencode::send(connection, session, model, &prompt).await;
                if result.is_err() {
                    self.session = None;
                }
                result
            }
            ChatProvider::Anthropic => return Err("Invalid provider dispatch.".into()),
        };
        let answer = result?;
        self.messages.push(Message {
            role: Role::User,
            content: text,
        });
        self.messages.push(Message {
            role: Role::Assistant,
            content: answer.clone(),
        });
        Ok(ChatReply { text: answer })
    }
}

#[cfg(test)]
#[path = "chat_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "chat_opencode_tests.rs"]
mod opencode_tests;
#[cfg(test)]
#[path = "chat_state_tests.rs"]
mod state_tests;
#[cfg(test)]
#[path = "chat_wire.rs"]
mod wire;
