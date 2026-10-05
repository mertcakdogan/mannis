//! Network boundary for explicitly configured chat providers.
use std::time::Duration;

use reqwest::{Client, RequestBuilder, Url};
use serde::{de::DeserializeOwned, Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Endpoint(Url);

impl Endpoint {
    pub(crate) fn parse(value: &str) -> Result<Self, String> {
        let mut url = Url::parse(value.trim()).map_err(|_| "Invalid server URL.".to_string())?;
        let authority = value
            .trim()
            .split_once("://")
            .map(|(_, rest)| rest.split(['/', '?', '#']).next().unwrap_or(""))
            .unwrap_or("");
        if authority.contains('@')
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
        {
            return Err("Server URL must not contain credentials, a query or a fragment.".into());
        }
        let loopback = url.host_str().is_some_and(|host| {
            host.eq_ignore_ascii_case("localhost")
                || host
                    .trim_matches(['[', ']'])
                    .parse::<std::net::IpAddr>()
                    .is_ok_and(|ip| ip.is_loopback())
        });
        if url.scheme() != "https" && !(url.scheme() == "http" && loopback) {
            return Err("Use HTTPS for remote servers, or HTTP on localhost.".into());
        }
        if url.host().is_none() {
            return Err("Server URL needs a host.".into());
        }
        if !url.path().ends_with('/') {
            url.set_path(&format!("{}/", url.path()));
        }
        Ok(Self(url))
    }

    pub(crate) fn route(&self, segments: &[&str]) -> Result<Url, String> {
        let mut url = self.0.clone();
        url.path_segments_mut()
            .map_err(|_| "Invalid server URL.".to_string())?
            .pop_if_empty()
            .extend(segments);
        Ok(url)
    }
}

pub(crate) struct Connection {
    pub(crate) endpoint: Endpoint,
    client: Client,
    auth: Auth,
    label: &'static str,
}

pub(crate) enum Auth {
    None,
    Basic { username: String, password: String },
    Bearer(String),
}

impl Connection {
    pub(crate) fn new(url: &str, auth: Auth, label: &'static str) -> Result<Self, String> {
        Ok(Self {
            endpoint: Endpoint::parse(url)?,
            client: Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .timeout(Duration::from_secs(90))
                .connect_timeout(Duration::from_secs(10))
                .build()
                .map_err(|_| "Could not create HTTP client.".to_string())?,
            auth,
            label,
        })
    }

    pub(crate) fn request(
        &self,
        method: reqwest::Method,
        route: &[&str],
    ) -> Result<RequestBuilder, String> {
        let request = self.client.request(method, self.endpoint.route(route)?);
        Ok(match &self.auth {
            Auth::None => request,
            Auth::Basic { username, password } => request.basic_auth(username, Some(password)),
            Auth::Bearer(key) => request.bearer_auth(key),
        })
    }

    pub(crate) async fn json<T: DeserializeOwned>(
        &self,
        request: RequestBuilder,
    ) -> Result<T, String> {
        let response = request.send().await.map_err(|err| {
            if err.is_timeout() {
                format!("{} timed out. Check the server and retry.", self.label)
            } else {
                format!(
                    "Could not connect to {}. Check its server URL and connection.",
                    self.label
                )
            }
        })?;
        let status = response.status();
        if !status.is_success() {
            // Do not expose arbitrary upstream bodies: they can contain credentials.
            return Err(match status.as_u16() {
                401 | 403 => format!(
                    "{} authentication failed ({status}). Check credentials in Settings.",
                    self.label
                ),
                _ => format!("{} returned HTTP {status}.", self.label),
            });
        }
        response
            .json()
            .await
            .map_err(|_| format!("{} returned an unexpected response.", self.label))
    }
}

#[derive(Clone, Deserialize, Serialize)]
pub struct ChatModel {
    pub id: String,
    pub name: String,
}

#[cfg(test)]
#[path = "provider_tests.rs"]
mod tests;
