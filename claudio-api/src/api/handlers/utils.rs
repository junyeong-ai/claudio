use axum::Json;
use serde::Serialize;

use crate::api::types::{HealthResponse, MrkdwnRequest, MrkdwnResponse};
use crate::config::Config;

pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".into(),
        version: env!("CARGO_PKG_VERSION").into(),
    })
}

#[derive(Serialize)]
pub struct ConfigResponse {
    pub defaults: DefaultsResponse,
}

#[derive(Serialize)]
pub struct DefaultsResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    pub timeout: u32,
    pub disallowed_tools: Vec<String>,
}

pub async fn get_config() -> Json<ConfigResponse> {
    let config = Config::global();
    Json(ConfigResponse {
        defaults: DefaultsResponse {
            model: config.defaults.model.clone(),
            timeout: config.defaults.timeout,
            disallowed_tools: config.defaults.disallowed_tools.clone(),
        },
    })
}

pub async fn convert_to_mrkdwn(Json(req): Json<MrkdwnRequest>) -> Json<MrkdwnResponse> {
    Json(MrkdwnResponse {
        text: crate::utils::to_mrkdwn(&req.text),
    })
}
