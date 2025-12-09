use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExecutionStatus {
    Completed,
    Failed,
    Timeout,
}

impl ExecutionStatus {
    pub fn is_success(self) -> bool {
        matches!(self, Self::Completed)
    }
}

impl fmt::Display for ExecutionStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Completed => write!(f, "completed"),
            Self::Failed => write!(f, "failed"),
            Self::Timeout => write!(f, "timeout"),
        }
    }
}

#[derive(Debug, Default, Deserialize)]
pub struct ChatCompletionRequest {
    #[serde(default)]
    pub user_message: String,
    #[serde(default)]
    pub instruction: Option<String>,
    #[serde(default)]
    pub project: Option<String>,
    #[serde(default)]
    pub requester: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub agent: Option<String>,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub fallback_model: Option<String>,
    #[serde(default)]
    pub allowed_tools: Option<Vec<String>>,
    #[serde(default)]
    pub disallowed_tools: Option<Vec<String>>,
    #[serde(default)]
    pub system_prompt: Option<String>,
    #[serde(default)]
    pub working_dir: Option<String>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub continue_session: Option<bool>,
    #[serde(default)]
    pub resume_session_id: Option<String>,
    #[serde(default)]
    pub add_dirs: Option<Vec<String>>,
    #[serde(default)]
    pub mcp_config: Option<serde_json::Value>,
    #[serde(default)]
    pub agents: Option<serde_json::Value>,
    #[serde(default = "default_timeout")]
    pub timeout: Option<u64>,
}

fn default_timeout() -> Option<u64> {
    Some(300)
}

#[derive(Debug, Serialize)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub status: ExecutionStatus,
    pub created: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub claude_response: Option<ClaudeCliOutput>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ErrorInfo>,
    pub project: String,
    pub duration_ms: u64,
}

#[derive(Debug, Deserialize)]
pub struct MrkdwnRequest {
    pub text: String,
}

#[derive(Debug, Serialize)]
pub struct MrkdwnResponse {
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClaudeCliOutput {
    #[serde(rename = "type")]
    pub output_type: String,
    pub subtype: Option<String>,
    pub is_error: bool,
    pub duration_ms: u64,
    pub duration_api_ms: Option<u64>,
    pub num_turns: Option<u32>,
    pub result: String,
    pub session_id: String,
    pub total_cost_usd: Option<f64>,
    #[serde(default)]
    pub usage: Option<UsageInfo>,
    #[serde(rename = "modelUsage")]
    pub model_usage: Option<HashMap<String, ModelUsage>>,
    pub uuid: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct UsageInfo {
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub cache_creation_input_tokens: Option<u64>,
    pub cache_read_input_tokens: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelUsage {
    #[serde(rename = "inputTokens")]
    pub input_tokens: Option<u64>,
    #[serde(rename = "outputTokens")]
    pub output_tokens: Option<u64>,
    #[serde(rename = "cacheReadInputTokens")]
    pub cache_read_input_tokens: Option<u64>,
    #[serde(rename = "cacheCreationInputTokens")]
    pub cache_creation_input_tokens: Option<u64>,
    #[serde(rename = "costUSD")]
    pub cost_usd: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct ErrorInfo {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
}
