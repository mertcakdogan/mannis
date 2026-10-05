use std::collections::BTreeMap;

use reqwest::Method;
use serde::{Deserialize, Serialize};

use crate::provider::{ChatModel, Connection};

#[derive(Deserialize)]
struct ProviderList {
    providers: Vec<Provider>,
}
#[derive(Deserialize)]
struct Provider {
    id: String,
    name: String,
    models: BTreeMap<String, Model>,
}
#[derive(Deserialize)]
struct Model {
    id: String,
    name: String,
}

pub(crate) async fn models(connection: &Connection) -> Result<Vec<ChatModel>, String> {
    let response: ProviderList = connection
        .json(connection.request(Method::GET, &["config", "providers"])?)
        .await?;
    let mut models = Vec::new();
    for provider in response.providers {
        for model in provider.models.into_values() {
            if !provider.id.is_empty() && !model.id.is_empty() {
                models.push(ChatModel {
                    id: format!("{}/{}", provider.id, model.id),
                    name: format!("{} — {}", provider.name, model.name),
                });
            }
        }
    }
    models.sort_by(|a, b| a.id.cmp(&b.id));
    models.dedup_by(|a, b| a.id == b.id);
    Ok(models)
}

#[derive(Deserialize, Serialize)]
struct Permission {
    permission: String,
    pattern: String,
    action: String,
}
#[derive(Deserialize)]
struct Session {
    id: String,
    permission: Option<Vec<Permission>>,
}
#[derive(Serialize)]
struct CreateSession {
    title: &'static str,
    permission: [Permission; 1],
}

pub(crate) async fn create(connection: &Connection) -> Result<String, String> {
    let body = CreateSession {
        title: "Mannis chat",
        permission: [Permission {
            permission: "*".into(),
            pattern: "*".into(),
            action: "deny".into(),
        }],
    };
    let session: Session = connection
        .json(connection.request(Method::POST, &["session"])?.json(&body))
        .await?;
    let protected = session.permission.as_ref().is_some_and(|rules| {
        rules.len() == 1
            && rules[0].permission == "*"
            && rules[0].pattern == "*"
            && rules[0].action == "deny"
    });
    if !protected {
        return Err("OpenCode did not confirm disabled tool permissions. Update the server before chatting.".into());
    }
    if session.id.is_empty() {
        return Err("OpenCode returned an invalid session.".into());
    }
    Ok(session.id)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SelectedModel<'a> {
    #[serde(rename = "providerID")]
    provider_id: &'a str,
    #[serde(rename = "modelID")]
    model_id: &'a str,
}
#[derive(Serialize)]
struct Prompt<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    model: Option<SelectedModel<'a>>,
    parts: [TextPart<'a>; 1],
    system: &'static str,
}
#[derive(Serialize)]
struct TextPart<'a> {
    r#type: &'static str,
    text: &'a str,
}
#[derive(Deserialize)]
struct Response {
    info: MessageInfo,
    parts: Vec<Part>,
}
#[derive(Deserialize)]
struct MessageInfo {
    error: Option<MessageError>,
}
#[derive(Deserialize)]
struct MessageError {
    name: String,
}
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum Part {
    Text {
        text: String,
    },
    #[serde(other)]
    Other,
}

pub(crate) fn parse_model(model: &str) -> Result<(&str, &str), String> {
    let (provider, model) = model
        .split_once('/')
        .ok_or_else(|| "Choose an OpenCode model in Settings (provider/model).".to_string())?;
    if provider.trim().is_empty() || model.trim().is_empty() {
        return Err("Choose an OpenCode model in Settings (provider/model).".into());
    }
    Ok((provider, model))
}

pub(crate) async fn send(
    connection: &Connection,
    session: &str,
    model: &str,
    text: &str,
) -> Result<String, String> {
    let selected = if model.is_empty() {
        None
    } else {
        let (provider_id, model_id) = parse_model(model)?;
        Some(SelectedModel {
            provider_id,
            model_id,
        })
    };
    let body = Prompt { model: selected, parts: [TextPart { r#type: "text", text }], system: "You are Mochi, the user's personal assistant. Answer in the user's language, using plain text. Tools are disabled; use only the provided conversation and context." };
    let response: Response = connection
        .json(
            connection
                .request(Method::POST, &["session", session, "message"])?
                .json(&body),
        )
        .await?;
    if let Some(error) = response.info.error {
        return Err(match error.name.as_str() {
            "ProviderAuthError" => {
                "OpenCode provider authentication failed. Configure its provider credentials."
            }
            "MessageAbortedError" => "OpenCode cancelled the message. Retry it.",
            _ => "OpenCode could not complete the message. Check the server and selected model.",
        }
        .into());
    }
    let text = response
        .parts
        .into_iter()
        .filter_map(|part| match part {
            Part::Text { text } => Some(text),
            Part::Other => None,
        })
        .collect::<Vec<_>>()
        .join("\n");
    if text.trim().is_empty() {
        return Err("OpenCode returned no response text.".into());
    }
    Ok(text.trim().to_string())
}
