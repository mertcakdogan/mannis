use reqwest::Method;
use serde::{Deserialize, Serialize};

use crate::provider::{ChatModel, Connection};

#[derive(Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Role {
    User,
    Assistant,
}

#[derive(Clone, Serialize)]
pub(crate) struct Message {
    pub(crate) role: Role,
    pub(crate) content: String,
}

#[derive(Deserialize)]
struct ModelList {
    data: Vec<RouterModel>,
}
#[derive(Deserialize)]
struct RouterModel {
    id: String,
    name: Option<String>,
}

pub(crate) async fn models(connection: &Connection) -> Result<Vec<ChatModel>, String> {
    let response: ModelList = connection
        .json(connection.request(Method::GET, &["models"])?)
        .await?;
    let mut models: Vec<_> = response
        .data
        .into_iter()
        .filter(|m| !m.id.trim().is_empty())
        .map(|m| ChatModel {
            name: m
                .name
                .filter(|name| !name.is_empty())
                .unwrap_or_else(|| m.id.clone()),
            id: m.id,
        })
        .collect();
    models.sort_by(|a, b| a.id.cmp(&b.id));
    models.dedup_by(|a, b| a.id == b.id);
    Ok(models)
}

#[derive(Serialize)]
struct Completion<'a> {
    model: &'a str,
    messages: &'a [Message],
    stream: bool,
}
#[derive(Deserialize)]
struct Response {
    choices: Vec<Choice>,
}
#[derive(Deserialize)]
struct Choice {
    message: AssistantMessage,
}
#[derive(Deserialize)]
struct AssistantMessage {
    content: Option<String>,
}

pub(crate) async fn send(
    connection: &Connection,
    model: &str,
    messages: &[Message],
) -> Result<String, String> {
    if model.trim().is_empty() {
        return Err("Choose a 9router model in Settings.".into());
    }
    let response: Response = connection
        .json(
            connection
                .request(Method::POST, &["chat", "completions"])?
                .json(&Completion {
                    model,
                    messages,
                    stream: false,
                }),
        )
        .await?;
    let text = response
        .choices
        .into_iter()
        .next()
        .and_then(|c| c.message.content)
        .unwrap_or_default();
    if text.trim().is_empty() {
        return Err("9router returned no response text.".into());
    }
    Ok(text.trim().to_string())
}
