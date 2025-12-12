use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allowed_tools: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disallowed_tools: Option<Vec<String>>,
    pub is_default: bool,
    pub enable_user_context: bool,
    pub fallback_agent: String,
    pub classify_model: String,
    pub classify_timeout: i32,
    pub rate_limit_rpm: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateProject {
    pub name: String,
    pub system_prompt: Option<String>,
    pub allowed_tools: Option<Vec<String>>,
    pub disallowed_tools: Option<Vec<String>>,
    #[serde(default)]
    pub is_default: bool,
    #[serde(default = "default_enable_user_context")]
    pub enable_user_context: bool,
    #[serde(default = "default_fallback_agent")]
    pub fallback_agent: String,
    #[serde(default = "default_classify_model")]
    pub classify_model: String,
    #[serde(default = "default_classify_timeout")]
    pub classify_timeout: i32,
    #[serde(default)]
    pub rate_limit_rpm: i32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateProject {
    pub name: Option<String>,
    pub system_prompt: Option<String>,
    pub allowed_tools: Option<Vec<String>>,
    pub disallowed_tools: Option<Vec<String>>,
    pub is_default: Option<bool>,
    pub enable_user_context: Option<bool>,
    pub fallback_agent: Option<String>,
    pub classify_model: Option<String>,
    pub classify_timeout: Option<i32>,
    pub rate_limit_rpm: Option<i32>,
}

fn default_fallback_agent() -> String {
    "general".into()
}
fn default_enable_user_context() -> bool {
    true
}
fn default_classify_model() -> String {
    "haiku".into()
}
fn default_classify_timeout() -> i32 {
    30
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub description: String,
    pub model: String,
    pub priority: i32,
    pub keywords: Vec<String>,
    pub examples: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instruction: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_schema: Option<serde_json::Value>,
    pub timeout: i32,
    pub static_response: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub working_dir: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateAgent {
    pub name: String,
    pub description: String,
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default = "default_priority")]
    pub priority: i32,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(default)]
    pub examples: Vec<String>,
    pub instruction: Option<String>,
    pub tools: Option<Vec<String>>,
    pub output_schema: Option<serde_json::Value>,
    #[serde(default = "default_timeout")]
    pub timeout: i32,
    #[serde(default)]
    pub static_response: bool,
    pub working_dir: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateAgent {
    pub name: Option<String>,
    pub description: Option<String>,
    pub model: Option<String>,
    pub priority: Option<i32>,
    pub keywords: Option<Vec<String>>,
    pub examples: Option<Vec<String>>,
    pub instruction: Option<String>,
    pub tools: Option<Vec<String>>,
    pub output_schema: Option<serde_json::Value>,
    pub timeout: Option<i32>,
    pub static_response: Option<bool>,
    pub working_dir: Option<String>,
}

fn default_model() -> String {
    "haiku".into()
}
fn default_priority() -> i32 {
    50
}
fn default_timeout() -> i32 {
    300
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Execution {
    pub id: String,
    pub project: String,
    pub source: Option<String>,
    pub requester: Option<String>,
    pub agent: Option<String>,
    pub instruction: Option<String>,
    pub user_message: String,
    pub user_context: Option<String>,
    pub response: String,
    pub structured_output: Option<String>,
    pub model: Option<String>,
    pub cost_usd: Option<f64>,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub cache_read_tokens: Option<i64>,
    pub cache_creation_tokens: Option<i64>,
    pub duration_ms: Option<i64>,
    pub duration_api_ms: Option<i64>,
    pub session_id: Option<String>,
    pub metadata: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReactionCategory {
    Feedback,
    Trigger,
    Action,
}

impl ReactionCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Feedback => "feedback",
            Self::Trigger => "trigger",
            Self::Action => "action",
        }
    }

    pub fn from_reaction(reaction: &str) -> Self {
        match reaction {
            "thumbsup" | "+1" | "thumbsdown" | "-1" => Self::Feedback,
            "one" | "two" | "three" | "four" | "five" | "six" | "seven" | "eight" | "nine"
            | "zero" => Self::Trigger,
            _ => Self::Action,
        }
    }
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct ReactionSummary {
    pub positive: i64,
    pub negative: i64,
    pub triggers: Vec<TriggerInfo>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TriggerInfo {
    pub reaction: String,
    pub user_id: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReactionResult {
    Created,
    Updated,
    AlreadyTriggered,
}

#[derive(Debug, Clone, Serialize)]
pub struct ClassificationLog {
    pub text: String,
    pub agent: String,
    pub model: Option<String>,
    pub confidence: f64,
    pub method: String,
    pub matched_keyword: Option<String>,
    pub reasoning: Option<String>,
    pub duration_ms: i64,
    pub project: Option<String>,
    pub source: Option<String>,
    pub requester: Option<String>,
}

#[derive(Debug, Default)]
pub struct Stats {
    pub total_requests: i64,
    pub successful_requests: i64,
    pub total_cost_usd: f64,
    pub total_input_tokens: i64,
    pub total_output_tokens: i64,
    pub avg_duration_ms: f64,
    pub positive_feedback: i64,
    pub negative_feedback: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct RecentExecution {
    pub id: String,
    pub project: String,
    pub agent: Option<String>,
    pub requester: Option<String>,
    pub user_message_preview: String,
    pub status: String,
    pub cost_usd: Option<f64>,
    pub duration_ms: Option<i64>,
    pub feedback: Option<i32>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExecutionDetail {
    pub id: String,
    pub project: String,
    pub agent: Option<String>,
    pub source: Option<String>,
    pub requester: Option<String>,
    pub session_id: Option<String>,
    pub instruction: Option<String>,
    pub user_message: String,
    pub user_context: Option<String>,
    pub response: String,
    pub structured_output: Option<String>,
    pub model: Option<String>,
    pub cost_usd: Option<f64>,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub cache_read_tokens: Option<i64>,
    pub cache_creation_tokens: Option<i64>,
    pub duration_ms: Option<i64>,
    pub duration_api_ms: Option<i64>,
    pub feedback: Option<i32>,
    pub metadata: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExecutionListItem {
    pub id: String,
    pub project: String,
    pub agent: Option<String>,
    pub source: Option<String>,
    pub requester: Option<String>,
    pub user_message_preview: String,
    pub instruction_preview: Option<String>,
    pub response_preview: String,
    pub model: Option<String>,
    pub cost_usd: Option<f64>,
    pub duration_ms: Option<i64>,
    pub feedback: Option<i32>,
    pub channel: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExecutionListResponse {
    pub executions: Vec<ExecutionListItem>,
    pub total: i64,
    pub page: i64,
    pub limit: i64,
    pub total_pages: i64,
}

#[derive(Debug, Default)]
pub struct ExecutionFilter {
    pub project: Option<String>,
    pub source: Option<String>,
    pub model: Option<String>,
    pub agent: Option<String>,
    pub feedback: Option<i32>,
    pub requester: Option<String>,
    pub channel: Option<String>,
    pub from: Option<i64>,
    pub to: Option<i64>,
    pub search: Option<String>,
    pub failed_only: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FilterOptions {
    pub projects: Vec<String>,
    pub sources: Vec<String>,
    pub models: Vec<String>,
    pub agents: Vec<String>,
    pub requesters: Vec<String>,
    pub channels: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct UserContext {
    pub user_id: String,
    pub rules: Vec<String>,
    pub summary: Option<String>,
    pub last_summarized_at: Option<i64>,
    pub recent_conversations: Vec<ConversationItem>,
    pub conversation_count: usize,
    pub context_bytes: i64,
    pub needs_summary: bool,
    pub summary_locked: bool,
    pub lock_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConversationItem {
    pub id: String,
    pub user_message: String,
    pub response: Option<String>,
    pub created_at: i64,
    pub has_negative_feedback: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct UserListItem {
    pub user_id: String,
    pub rule_count: i64,
    pub has_summary: bool,
    pub last_activity: Option<i64>,
    pub request_count: i64,
    pub total_cost_usd: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_source: Option<String>,
}
