use axum::{
    Json,
    extract::{Path, Query, State},
};
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::analytics::{self, Granularity, Period};
use crate::api::error::ApiResult;
use crate::api::routes::AppState;

#[derive(Serialize)]
pub struct StatsResponse {
    pub total_requests: i64,
    pub successful_requests: i64,
    pub success_rate: f64,
    pub total_cost_usd: f64,
    pub total_input_tokens: i64,
    pub total_output_tokens: i64,
    pub avg_duration_ms: f64,
    pub feedback: FeedbackStats,
}

#[derive(Serialize)]
pub struct FeedbackStats {
    pub positive: i64,
    pub negative: i64,
    pub satisfaction_rate: Option<f64>,
}

pub async fn get_stats(State(state): State<AppState>) -> Json<StatsResponse> {
    let stats = state.storage.get_stats(None).unwrap_or_default();
    Json(build_stats_response(stats))
}

pub async fn get_project_stats(
    State(state): State<AppState>,
    Path(project): Path<String>,
) -> Json<StatsResponse> {
    let stats = state.storage.get_stats(Some(&project)).unwrap_or_default();
    Json(build_stats_response(stats))
}

fn build_stats_response(stats: crate::storage::Stats) -> StatsResponse {
    let success_rate = if stats.total_requests > 0 {
        stats.successful_requests as f64 / stats.total_requests as f64 * 100.0
    } else {
        0.0
    };

    let total_feedback = stats.positive_feedback + stats.negative_feedback;
    let satisfaction_rate = if total_feedback > 0 {
        Some(stats.positive_feedback as f64 / total_feedback as f64 * 100.0)
    } else {
        None
    };

    StatsResponse {
        total_requests: stats.total_requests,
        successful_requests: stats.successful_requests,
        success_rate,
        total_cost_usd: stats.total_cost_usd,
        total_input_tokens: stats.total_input_tokens,
        total_output_tokens: stats.total_output_tokens,
        avg_duration_ms: stats.avg_duration_ms,
        feedback: FeedbackStats {
            positive: stats.positive_feedback,
            negative: stats.negative_feedback,
            satisfaction_rate,
        },
    }
}

#[derive(Deserialize)]
pub struct OverviewQuery {
    #[serde(default)]
    pub period: Period,
    #[serde(default)]
    pub project: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
}

pub async fn get_stats_overview(
    State(state): State<AppState>,
    Query(query): Query<OverviewQuery>,
) -> ApiResult<analytics::OverviewStats> {
    state
        .storage
        .with_connection(|conn| {
            analytics::get_overview_stats(
                conn,
                query.period,
                query.project.as_deref(),
                query.source.as_deref(),
            )
        })
        .map(Json)
        .map_err(Into::into)
}

#[derive(Deserialize)]
pub struct TimeseriesQuery {
    #[serde(default)]
    pub granularity: Granularity,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
    #[serde(default)]
    pub project: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
}

pub async fn get_stats_timeseries(
    State(state): State<AppState>,
    Query(query): Query<TimeseriesQuery>,
) -> ApiResult<analytics::TimeSeriesResponse> {
    let now = Utc::now().timestamp();

    let to = query
        .to
        .as_ref()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.timestamp())
        .unwrap_or(now);

    let from = query
        .from
        .as_ref()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.timestamp())
        .unwrap_or(to - 604800);

    state
        .storage
        .with_connection(|conn| {
            analytics::get_timeseries(
                conn,
                query.granularity,
                from,
                to,
                query.project.as_deref(),
                query.source.as_deref(),
                query.model.as_deref(),
            )
        })
        .map(Json)
        .map_err(Into::into)
}

#[derive(Deserialize)]
pub struct ModelsQuery {
    #[serde(default)]
    pub period: Period,
    #[serde(default)]
    pub project: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
}

pub async fn get_stats_models(
    State(state): State<AppState>,
    Query(query): Query<ModelsQuery>,
) -> ApiResult<analytics::ModelsResponse> {
    state
        .storage
        .with_connection(|conn| {
            analytics::get_model_stats(
                conn,
                query.period,
                query.project.as_deref(),
                query.source.as_deref(),
            )
        })
        .map(Json)
        .map_err(Into::into)
}

#[derive(Deserialize)]
pub struct ErrorsQuery {
    #[serde(default)]
    pub period: Period,
    #[serde(default)]
    pub project: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
}

pub async fn get_stats_errors(
    State(state): State<AppState>,
    Query(query): Query<ErrorsQuery>,
) -> ApiResult<analytics::ErrorsResponse> {
    state
        .storage
        .with_connection(|conn| {
            analytics::get_error_stats(
                conn,
                query.period,
                query.project.as_deref(),
                query.source.as_deref(),
            )
        })
        .map(Json)
        .map_err(Into::into)
}

#[derive(Deserialize)]
pub struct SourcesQuery {
    #[serde(default)]
    pub period: Period,
    #[serde(default)]
    pub project: Option<String>,
}

pub async fn get_stats_sources(
    State(state): State<AppState>,
    Query(query): Query<SourcesQuery>,
) -> ApiResult<analytics::SourcesResponse> {
    state
        .storage
        .with_connection(|conn| {
            analytics::get_source_stats(conn, query.period, query.project.as_deref())
        })
        .map(Json)
        .map_err(Into::into)
}

#[derive(Deserialize)]
pub struct RequestersQuery {
    #[serde(default)]
    pub period: Period,
    #[serde(default)]
    pub project: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    20
}

pub async fn get_stats_requesters(
    State(state): State<AppState>,
    Query(query): Query<RequestersQuery>,
) -> ApiResult<analytics::RequestersResponse> {
    state
        .storage
        .with_connection(|conn| {
            analytics::get_requester_stats(
                conn,
                query.period,
                query.project.as_deref(),
                query.source.as_deref(),
                query.limit,
            )
        })
        .map(Json)
        .map_err(Into::into)
}

#[derive(Deserialize)]
pub struct WorkflowStatsQuery {
    #[serde(default)]
    pub period: Period,
}

pub async fn get_workflow_stats(
    State(state): State<AppState>,
    Query(query): Query<WorkflowStatsQuery>,
) -> ApiResult<analytics::WorkflowsResponse> {
    state
        .storage
        .with_connection(|conn| analytics::get_workflow_stats(conn, query.period))
        .map(Json)
        .map_err(Into::into)
}

pub async fn record_workflow_stats(
    State(state): State<AppState>,
    Json(req): Json<analytics::RecordWorkflowRequest>,
) -> ApiResult<analytics::RecordWorkflowResponse> {
    state
        .storage
        .with_connection(|conn| analytics::record_workflow_execution(conn, &req))
        .map(Json)
        .map_err(Into::into)
}

#[derive(Deserialize)]
pub struct ClassifyStatsQuery {
    #[serde(default)]
    pub period: Period,
    #[serde(default)]
    pub project: Option<String>,
}

pub async fn get_classify_stats(
    State(state): State<AppState>,
    Query(query): Query<ClassifyStatsQuery>,
) -> ApiResult<analytics::ClassifyStatsResponse> {
    state
        .storage
        .with_connection(|conn| {
            analytics::get_classify_stats(conn, query.period, query.project.as_deref())
        })
        .map(Json)
        .map_err(Into::into)
}

#[derive(Deserialize)]
pub struct ClassifyLogsQuery {
    #[serde(default)]
    pub period: Period,
    #[serde(default)]
    pub project: Option<String>,
    #[serde(default)]
    pub agent: Option<String>,
    #[serde(default)]
    pub method: Option<String>,
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_list_limit")]
    pub limit: i64,
}

fn default_page() -> i64 {
    1
}

fn default_list_limit() -> i64 {
    20
}

pub async fn get_classify_logs(
    State(state): State<AppState>,
    Query(query): Query<ClassifyLogsQuery>,
) -> ApiResult<analytics::ClassifyLogsResponse> {
    let page = query.page.max(1);
    let limit = query.limit.clamp(1, 100);

    state
        .storage
        .with_connection(|conn| {
            analytics::get_classify_logs(
                conn,
                query.period,
                query.project.as_deref(),
                query.agent.as_deref(),
                query.method.as_deref(),
                page,
                limit,
            )
        })
        .map(Json)
        .map_err(Into::into)
}
