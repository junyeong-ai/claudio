use anyhow::Result;
use once_cell::sync::Lazy;
use regex::Regex;
use reqwest::{Client, StatusCode};
use serde::Serialize;
use slack_morphism::prelude::*;
use std::sync::Arc;
use tracing::{error, info, warn};

use crate::config::SlackConfig;

static MENTION_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"<@[A-Z0-9]+>").expect("Invalid mention regex pattern"));

#[derive(Debug, Clone, Copy)]
enum WebhookEndpoint {
    Mention,
    Message,
    Reaction,
    Feedback,
}

#[derive(Clone, Serialize)]
pub struct SlackEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub channel: String,
    pub user: String,
    pub text: String,
    pub ts: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thread_ts: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bot_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reaction: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_ts: Option<String>,
}

#[derive(Clone)]
struct BridgeState {
    config: Arc<SlackConfig>,
    http: Client,
    slack_client: Arc<SlackHyperClient>,
    bot_token: SlackApiToken,
}

pub struct SlackBridge {
    config: Arc<SlackConfig>,
}

impl SlackBridge {
    pub fn new(config: SlackConfig) -> Self {
        Self {
            config: Arc::new(config),
        }
    }

    pub async fn run(self) -> Result<()> {
        let client = Arc::new(slack_morphism::SlackClient::new(
            SlackClientHyperConnector::new()?,
        ));

        let bot_token = SlackApiToken::new(self.config.bot_token.clone().into());

        let state = BridgeState {
            config: self.config.clone(),
            http: Client::new(),
            slack_client: client.clone(),
            bot_token,
        };

        let callbacks = SlackSocketModeListenerCallbacks::new()
            .with_push_events(push_events_handler)
            .with_interaction_events(interaction_events_handler)
            .with_command_events(command_events_handler);

        let listener_environment = Arc::new(
            SlackClientEventsListenerEnvironment::new(client.clone())
                .with_error_handler(error_handler)
                .with_user_state(state),
        );

        let socket_listener = SlackClientSocketModeListener::new(
            &SlackClientSocketModeConfig::new(),
            listener_environment,
            callbacks,
        );

        let app_token = SlackApiToken::new(self.config.app_token.clone().into());

        info!("Connecting to Slack Socket Mode...");
        socket_listener.listen_for(&app_token).await?;
        info!("Slack Socket Mode connected");

        socket_listener.serve().await;
        Ok(())
    }
}

async fn push_events_handler(
    event: SlackPushEventCallback,
    _client: Arc<SlackHyperClient>,
    states: SlackClientEventsUserState,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let state_guard = states.read().await;
    if let Some(state) = state_guard.get_user_state::<BridgeState>() {
        handle_push_event(event, state.clone()).await;
    }
    Ok(())
}

async fn handle_push_event(event: SlackPushEventCallback, state: BridgeState) {
    match &event.event {
        SlackEventCallbackBody::AppMention(mention) => {
            let text = mention.content.text.clone().unwrap_or_default();
            let clean_text = strip_mentions(&text);

            if clean_text.is_empty() {
                info!("Empty mention, skipping");
                return;
            }

            let event = SlackEvent {
                event_type: "app_mention".to_string(),
                channel: mention.channel.to_string(),
                user: mention.user.to_string(),
                text: clean_text,
                ts: mention.origin.ts.to_string(),
                thread_ts: mention.origin.thread_ts.as_ref().map(|t| t.to_string()),
                bot_id: None,
                attachments: None,
                reaction: None,
                message_ts: None,
            };

            tokio::spawn(forward_to_webhook(state, event, WebhookEndpoint::Mention));
        }

        SlackEventCallbackBody::Message(msg) => {
            let sender = &msg.sender;
            let bot_id = sender.bot_id.as_ref().map(|b| b.to_string());

            // Only process bot messages (e.g., Datadog alerts)
            if bot_id.is_none() {
                return;
            }

            // Skip messages from our own bot
            let user_id = sender
                .user
                .as_ref()
                .map(|u| u.to_string())
                .unwrap_or_default();
            if state.config.bot_user_ids.contains(&user_id) {
                info!("Skipping message from own bot: {}", user_id);
                return;
            }

            let channel = msg
                .origin
                .channel
                .as_ref()
                .map(|c| c.to_string())
                .unwrap_or_default();

            let ts = msg.origin.ts.to_string();

            let (text, attachments) = match &msg.content {
                Some(content) => extract_from_content(content),
                None => fetch_message_content(&state, &channel, &ts).await,
            };

            let event = SlackEvent {
                event_type: "bot_message".to_string(),
                channel,
                user: sender
                    .user
                    .as_ref()
                    .map(|u| u.to_string())
                    .unwrap_or_default(),
                text,
                ts,
                thread_ts: msg.origin.thread_ts.as_ref().map(|t| t.to_string()),
                bot_id,
                attachments,
                reaction: None,
                message_ts: None,
            };

            tokio::spawn(forward_to_webhook(state, event, WebhookEndpoint::Message));
        }

        SlackEventCallbackBody::ReactionAdded(r) => {
            forward_reaction(&state, &r.item, &r.reaction.0, &r.user, "reaction_added");
        }

        SlackEventCallbackBody::ReactionRemoved(r) => {
            forward_reaction(&state, &r.item, &r.reaction.0, &r.user, "reaction_removed");
        }

        _ => {}
    }
}

fn extract_from_content(content: &SlackMessageContent) -> (String, Option<Vec<serde_json::Value>>) {
    let text = content.text.clone().unwrap_or_default();
    let attachments = content.attachments.as_ref().map(|atts| {
        atts.iter()
            .map(|a| serde_json::to_value(a).unwrap_or_default())
            .collect()
    });
    (text, attachments)
}

async fn fetch_message_content(
    state: &BridgeState,
    channel: &str,
    ts: &str,
) -> (String, Option<Vec<serde_json::Value>>) {
    let session = state.slack_client.open_session(&state.bot_token);

    let request = SlackApiConversationsHistoryRequest::new()
        .with_channel(channel.into())
        .with_latest(ts.into())
        .with_limit(1)
        .with_inclusive(true);

    match session.conversations_history(&request).await {
        Ok(response) => {
            if let Some(message) = response.messages.first() {
                let text = message.content.text.clone().unwrap_or_default();
                let attachments = message.content.attachments.as_ref().map(|atts| {
                    atts.iter()
                        .map(|a| serde_json::to_value(a).unwrap_or_default())
                        .collect()
                });
                return (text, attachments);
            }
        }
        Err(e) => {
            warn!("Failed to fetch message via API: {}", e);
        }
    }

    (String::new(), None)
}

fn forward_reaction(
    state: &BridgeState,
    item: &SlackReactionsItem,
    reaction_name: &str,
    user: &SlackUserId,
    event_type: &str,
) {
    // Skip reactions added by bot users
    let user_id = user.to_string();
    if state.config.bot_user_ids.contains(&user_id) {
        info!("Skipping reaction from bot user: {}", user_id);
        return;
    }

    let (channel, ts) = match item {
        SlackReactionsItem::Message(msg) => (
            msg.origin
                .channel
                .as_ref()
                .map(|c| c.to_string())
                .unwrap_or_default(),
            msg.origin.ts.to_string(),
        ),
        _ => return,
    };

    let endpoint = match reaction_name {
        "+1" | "-1" => WebhookEndpoint::Feedback,
        "one" | "two" => WebhookEndpoint::Reaction,
        _ => return,
    };

    let event = SlackEvent {
        event_type: event_type.to_string(),
        channel,
        user: user.to_string(),
        text: String::new(),
        ts: String::new(),
        thread_ts: None,
        bot_id: None,
        attachments: None,
        reaction: Some(reaction_name.to_string()),
        message_ts: Some(ts),
    };

    tokio::spawn(forward_to_webhook(state.clone(), event, endpoint));
}

async fn forward_to_webhook(state: BridgeState, event: SlackEvent, endpoint: WebhookEndpoint) {
    let webhooks = &state.config.webhooks;

    let (url, endpoint_name) = match endpoint {
        WebhookEndpoint::Mention => (&webhooks.mention, "mention"),
        WebhookEndpoint::Message => (&webhooks.message, "message"),
        WebhookEndpoint::Reaction => (&webhooks.reaction, "reaction"),
        WebhookEndpoint::Feedback => (&webhooks.feedback, "feedback"),
    };

    let webhook_url = match url {
        Some(u) => u,
        None => {
            warn!("n8n webhook URL not configured for: {}", endpoint_name);
            return;
        }
    };

    info!(
        "Forwarding {} to {}: channel={}",
        event.event_type, endpoint_name, event.channel
    );

    match state.http.post(webhook_url).json(&event).send().await {
        Ok(res) if res.status().is_success() => {
            info!("Forwarded to {} successfully", endpoint_name);
        }
        Ok(res) => {
            error!("{} returned error: {}", endpoint_name, res.status());
        }
        Err(e) => {
            error!("Failed to forward to {}: {}", endpoint_name, e);
        }
    }
}

fn strip_mentions(text: &str) -> String {
    MENTION_REGEX.replace_all(text, "").trim().to_string()
}

async fn interaction_events_handler(
    _event: SlackInteractionEvent,
    _client: Arc<SlackHyperClient>,
    _states: SlackClientEventsUserState,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    Ok(())
}

async fn command_events_handler(
    _event: SlackCommandEvent,
    _client: Arc<SlackHyperClient>,
    _states: SlackClientEventsUserState,
) -> Result<SlackCommandEventResponse, Box<dyn std::error::Error + Send + Sync>> {
    Ok(SlackCommandEventResponse::new(
        SlackMessageContent::new().with_text("Use @mention instead".to_string()),
    ))
}

fn error_handler(
    err: Box<dyn std::error::Error + Send + Sync>,
    _client: Arc<SlackHyperClient>,
    _states: SlackClientEventsUserState,
) -> StatusCode {
    error!("Socket Mode error: {}", err);
    StatusCode::OK
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_from_content() {
        let content = SlackMessageContent::new()
            .with_text("test message".to_string())
            .with_attachments(vec![
                SlackMessageAttachment::new()
                    .with_title("Test Title".to_string())
                    .with_text("Test Text".to_string()),
            ]);

        let (text, attachments) = extract_from_content(&content);

        assert_eq!(text, "test message");
        assert!(attachments.is_some());
        assert_eq!(attachments.unwrap().len(), 1);
    }

    #[test]
    fn test_strip_mentions() {
        assert_eq!(strip_mentions("<@U123> hello"), "hello");
        assert_eq!(strip_mentions("<@U123> <@U456> hi"), "hi");
        assert_eq!(strip_mentions("no mentions"), "no mentions");
    }
}
