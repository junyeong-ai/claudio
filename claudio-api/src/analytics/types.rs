use serde::{Deserialize, Serialize};

/// Period for statistics queries
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Period {
    #[serde(rename = "1h")]
    Hour1,
    #[default]
    #[serde(rename = "24h")]
    Hours24,
    #[serde(rename = "7d")]
    Days7,
    #[serde(rename = "30d")]
    Days30,
    #[serde(rename = "90d")]
    Days90,
    #[serde(rename = "all")]
    All,
}

impl Period {
    /// Returns the number of seconds for this period
    pub fn seconds(&self) -> Option<i64> {
        match self {
            Period::Hour1 => Some(3600),
            Period::Hours24 => Some(86400),
            Period::Days7 => Some(604800),
            Period::Days30 => Some(2592000),
            Period::Days90 => Some(7776000),
            Period::All => None,
        }
    }

    /// Returns the display name
    pub fn as_str(&self) -> &'static str {
        match self {
            Period::Hour1 => "1h",
            Period::Hours24 => "24h",
            Period::Days7 => "7d",
            Period::Days30 => "30d",
            Period::Days90 => "90d",
            Period::All => "all",
        }
    }
}

impl std::fmt::Display for Period {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Granularity for time series data
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Granularity {
    #[default]
    Auto,
    Hour,
    Day,
    Week,
}

impl Granularity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Granularity::Auto => "auto",
            Granularity::Hour => "hour",
            Granularity::Day => "day",
            Granularity::Week => "week",
        }
    }

    /// Determine appropriate granularity based on time range
    pub fn from_range(seconds: i64) -> Self {
        if seconds <= 86400 {
            // <= 24h: hourly
            Granularity::Hour
        } else if seconds <= 604800 {
            // <= 7d: hourly
            Granularity::Hour
        } else if seconds <= 2592000 {
            // <= 30d: daily
            Granularity::Day
        } else {
            // > 30d: weekly
            Granularity::Week
        }
    }
}

/// Overview statistics response
#[derive(Debug, Serialize)]
pub struct OverviewStats {
    pub period: String,
    pub period_start: String,
    pub period_end: String,
    pub summary: SummaryStats,
    pub feedback: FeedbackSummary,
    pub comparison: ComparisonStats,
}

#[derive(Debug, Default, Serialize)]
pub struct SummaryStats {
    pub total_requests: i64,
    pub successful_requests: i64,
    pub failed_requests: i64,
    pub success_rate: f64,
    pub total_cost_usd: f64,
    pub total_input_tokens: i64,
    pub total_output_tokens: i64,
    pub cache_read_tokens: i64,
    pub cache_hit_rate: f64,
    pub avg_duration_ms: f64,
    pub p50_duration_ms: Option<i64>,
    pub p90_duration_ms: Option<i64>,
    pub p95_duration_ms: Option<i64>,
    pub p99_duration_ms: Option<i64>,
}

#[derive(Debug, Default, Serialize)]
pub struct FeedbackSummary {
    pub total_with_feedback: i64,
    pub positive: i64,
    pub negative: i64,
    pub satisfaction_rate: Option<f64>,
    pub pending_feedback: i64,
}

#[derive(Debug, Default, Serialize)]
pub struct ComparisonStats {
    pub requests_change_pct: Option<f64>,
    pub cost_change_pct: Option<f64>,
    pub duration_change_pct: Option<f64>,
    pub satisfaction_change_pct: Option<f64>,
}

/// Time series data point
#[derive(Debug, Serialize)]
pub struct TimeSeriesPoint {
    pub timestamp: String,
    pub requests: i64,
    pub successful: i64,
    pub cost_usd: f64,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub avg_duration_ms: f64,
    pub p95_duration_ms: Option<i64>,
    pub positive_feedback: i64,
    pub negative_feedback: i64,
}

/// Time series response
#[derive(Debug, Serialize)]
pub struct TimeSeriesResponse {
    pub granularity: String,
    pub from: String,
    pub to: String,
    pub data: Vec<TimeSeriesPoint>,
}

/// Model statistics
#[derive(Debug, Serialize)]
pub struct ModelStats {
    pub model: String,
    pub display_name: String,
    pub requests: i64,
    pub percentage: f64,
    pub cost_usd: f64,
    pub cost_per_request: f64,
    pub avg_input_tokens: f64,
    pub avg_output_tokens: f64,
    pub avg_duration_ms: f64,
    pub success_rate: f64,
    pub satisfaction_rate: Option<f64>,
}

/// Models response
#[derive(Debug, Serialize)]
pub struct ModelsResponse {
    pub period: String,
    pub models: Vec<ModelStats>,
}

/// Error type breakdown
#[derive(Debug, Serialize)]
pub struct ErrorBreakdown {
    #[serde(rename = "type")]
    pub error_type: String,
    pub count: i64,
    pub percentage: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trend: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub affected_workflows: Option<Vec<String>>,
}

/// Errors response
#[derive(Debug, Serialize)]
pub struct ErrorsResponse {
    pub period: String,
    pub total_errors: i64,
    pub error_rate: f64,
    pub errors: Vec<ErrorBreakdown>,
}

/// Workflow execution status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WorkflowStatus {
    Success,
    Error,
    Timeout,
}

impl WorkflowStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            WorkflowStatus::Success => "success",
            WorkflowStatus::Error => "error",
            WorkflowStatus::Timeout => "timeout",
        }
    }
}

impl std::fmt::Display for WorkflowStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Workflow health status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Critical,
}

impl HealthStatus {
    pub fn from_success_rate(rate: f64) -> Self {
        if rate >= 90.0 {
            HealthStatus::Healthy
        } else if rate >= 70.0 {
            HealthStatus::Degraded
        } else {
            HealthStatus::Critical
        }
    }
}

/// Workflow stats for a single workflow
#[derive(Debug, Serialize)]
pub struct WorkflowStats {
    pub name: String,
    pub display_name: String,
    pub status: HealthStatus,
    pub executions: i64,
    pub successful: i64,
    pub failed: i64,
    pub success_rate: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avg_duration_ms: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub p95_duration_ms: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_execution: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

/// Workflow stats response
#[derive(Debug, Serialize)]
pub struct WorkflowsResponse {
    pub period: String,
    pub workflows: Vec<WorkflowStats>,
}

/// Source statistics
#[derive(Debug, Serialize)]
pub struct SourceStats {
    pub source: String,
    pub requests: i64,
    pub percentage: f64,
    pub cost_usd: f64,
    pub avg_duration_ms: f64,
    pub success_rate: f64,
    pub satisfaction_rate: Option<f64>,
    pub unique_requesters: i64,
}

/// Sources response
#[derive(Debug, Serialize)]
pub struct SourcesResponse {
    pub period: String,
    pub sources: Vec<SourceStats>,
}

/// Requester statistics
#[derive(Debug, Serialize)]
pub struct RequesterStats {
    pub requester: String,
    pub source: Option<String>,
    pub requests: i64,
    pub cost_usd: f64,
    pub avg_duration_ms: f64,
    pub success_rate: f64,
    pub satisfaction_rate: Option<f64>,
    pub last_active: String,
}

/// Requesters response
#[derive(Debug, Serialize)]
pub struct RequestersResponse {
    pub period: String,
    pub requesters: Vec<RequesterStats>,
}

/// Request to record workflow execution
#[derive(Debug, Deserialize)]
pub struct RecordWorkflowRequest {
    pub workflow: String,
    #[serde(default)]
    pub execution_id: Option<String>,
    pub status: WorkflowStatus,
    #[serde(default)]
    pub duration_ms: Option<i64>,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
}

/// Response for recording workflow execution
#[derive(Debug, Serialize)]
pub struct RecordWorkflowResponse {
    pub id: i64,
    pub recorded_at: String,
}

/// Classification statistics response
#[derive(Debug, Serialize)]
pub struct ClassifyStatsResponse {
    pub period: String,
    pub total_classifications: i64,
    pub avg_duration_ms: f64,
    pub agents: Vec<AgentClassifyStats>,
    pub methods: Vec<MethodClassifyStats>,
}

#[derive(Debug, Serialize)]
pub struct AgentClassifyStats {
    pub agent: String,
    pub count: i64,
    pub percentage: f64,
    pub avg_confidence: f64,
    pub avg_duration_ms: f64,
}

#[derive(Debug, Serialize)]
pub struct MethodClassifyStats {
    pub method: String,
    pub count: i64,
    pub percentage: f64,
    pub avg_duration_ms: f64,
}

/// Classification log entry
#[derive(Debug, Serialize)]
pub struct ClassifyLogEntry {
    pub id: i64,
    pub text_preview: String,
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
    pub created_at: String,
}

/// Classification logs response
#[derive(Debug, Serialize)]
pub struct ClassifyLogsResponse {
    pub logs: Vec<ClassifyLogEntry>,
    pub total: i64,
    pub page: i64,
    pub limit: i64,
    pub total_pages: i64,
}
