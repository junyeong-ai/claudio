use axum::{
    Json,
    extract::{Path, Query, State},
};
use serde::{Deserialize, Serialize};

use crate::api::error::{ApiError, ApiResult};
use crate::api::routes::AppState;
use crate::storage::{
    Execution, ExecutionDetail, ExecutionFilter, ExecutionListResponse, FilterOptions,
    ReactionResult, ReactionSummary,
};

#[derive(Serialize)]
pub struct UpdateResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Deserialize)]
pub struct AddReactionRequest {
    pub user_id: String,
    pub reaction: String,
}

#[derive(Deserialize)]
pub struct RemoveReactionQuery {
    pub user_id: String,
    pub reaction: String,
}

#[derive(Serialize)]
pub struct ReactionResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<String>,
}

pub async fn add_reaction(
    State(state): State<AppState>,
    Path(execution_id): Path<String>,
    Json(req): Json<AddReactionRequest>,
) -> ApiResult<ReactionResponse> {
    validate_feedback_permission(&state, &execution_id, &req.user_id, &req.reaction)?;

    let result = state
        .storage
        .upsert_reaction(&execution_id, &req.user_id, &req.reaction)?;

    let result_str = match result {
        ReactionResult::Created => "created",
        ReactionResult::Updated => "updated",
        ReactionResult::AlreadyTriggered => "already_triggered",
    };

    Ok(Json(ReactionResponse {
        success: true,
        result: Some(result_str.into()),
    }))
}

pub async fn remove_reaction(
    State(state): State<AppState>,
    Path(execution_id): Path<String>,
    Query(req): Query<RemoveReactionQuery>,
) -> ApiResult<ReactionResponse> {
    let deleted = state
        .storage
        .delete_reaction(&execution_id, &req.user_id, &req.reaction)?;

    Ok(Json(ReactionResponse {
        success: true,
        result: Some(if deleted { "deleted" } else { "not_found" }.into()),
    }))
}

pub async fn get_reactions(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<ReactionSummary> {
    state
        .storage
        .get_reaction_summary(&id)
        .map(Json)
        .map_err(Into::into)
}

fn validate_feedback_permission(
    state: &AppState,
    execution_id: &str,
    user_id: &str,
    reaction: &str,
) -> Result<(), ApiError> {
    if crate::storage::is_feedback_reaction(reaction)
        && let Ok(Some(exec)) = state.storage.get_execution_by_id(execution_id)
        && exec.requester.as_deref() != Some(user_id)
    {
        return Err(ApiError::forbidden(
            "only the original requester can add feedback",
        ));
    }
    Ok(())
}

#[derive(Deserialize)]
pub struct LookupQuery {
    pub source: String,
    pub ref_key: String,
    pub ref_value: String,
}

#[derive(Serialize)]
pub struct ExecutionResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub execution: Option<Execution>,
}

pub async fn lookup_execution(
    State(state): State<AppState>,
    Query(query): Query<LookupQuery>,
) -> Json<ExecutionResponse> {
    let execution = state
        .storage
        .find_by_metadata_ref(&query.source, &query.ref_key, &query.ref_value)
        .ok()
        .flatten();

    Json(ExecutionResponse { execution })
}

#[derive(Deserialize)]
pub struct RecentQuery {
    #[serde(default = "default_recent_limit")]
    pub limit: i64,
}

fn default_recent_limit() -> i64 {
    10
}

#[derive(Serialize)]
pub struct RecentResponse {
    pub executions: Vec<crate::storage::RecentExecution>,
}

pub async fn get_recent_executions(
    State(state): State<AppState>,
    Query(query): Query<RecentQuery>,
) -> Json<RecentResponse> {
    let limit = query.limit.min(50);
    let executions = state
        .storage
        .get_recent_executions(limit)
        .unwrap_or_default();
    Json(RecentResponse { executions })
}

#[derive(Deserialize)]
pub struct ListExecutionsQuery {
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_list_limit")]
    pub limit: i64,
    #[serde(default)]
    pub project: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub agent: Option<String>,
    #[serde(default)]
    pub feedback: Option<i32>,
    #[serde(default)]
    pub requester: Option<String>,
    #[serde(default)]
    pub channel: Option<String>,
    #[serde(default)]
    pub from: Option<i64>,
    #[serde(default)]
    pub to: Option<i64>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub failed_only: Option<bool>,
}

fn default_page() -> i64 {
    1
}

fn default_list_limit() -> i64 {
    20
}

pub async fn list_executions(
    State(state): State<AppState>,
    Query(query): Query<ListExecutionsQuery>,
) -> ApiResult<ExecutionListResponse> {
    let filter = ExecutionFilter {
        project: query.project,
        source: query.source,
        model: query.model,
        agent: query.agent,
        feedback: query.feedback,
        requester: query.requester,
        channel: query.channel,
        from: query.from,
        to: query.to,
        search: query.search,
        failed_only: query.failed_only,
    };

    let page = query.page.max(1);
    let limit = query.limit.clamp(1, 100);

    state
        .storage
        .get_executions(&filter, page, limit)
        .map(Json)
        .map_err(Into::into)
}

#[derive(Serialize)]
pub struct ExecutionDetailResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub execution: Option<ExecutionDetail>,
}

pub async fn get_execution_detail(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<ExecutionDetailResponse> {
    state
        .storage
        .get_execution_by_id(&id)
        .map(|execution| Json(ExecutionDetailResponse { execution }))
        .map_err(Into::into)
}

pub async fn update_execution(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(updates): Json<serde_json::Value>,
) -> Json<UpdateResponse> {
    match state.storage.update_metadata(&id, &updates) {
        Ok(true) => Json(UpdateResponse {
            success: true,
            error: None,
        }),
        Ok(false) => Json(UpdateResponse {
            success: false,
            error: Some("execution not found".into()),
        }),
        Err(e) => Json(UpdateResponse {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

pub async fn get_filter_options(State(state): State<AppState>) -> ApiResult<FilterOptions> {
    state
        .storage
        .get_filter_options()
        .map(Json)
        .map_err(Into::into)
}
