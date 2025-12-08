use axum::{
    Json,
    extract::{Path, State},
};

use crate::api::error::{ApiError, ApiResult};
use crate::api::handlers::DeleteResponse;
use crate::api::routes::AppState;
use crate::storage::{Agent, CreateAgent, UpdateAgent};

pub async fn list_agents(
    State(state): State<AppState>,
    Path(project_id): Path<String>,
) -> ApiResult<Vec<Agent>> {
    state
        .storage
        .list_agents(&project_id)
        .map(Json)
        .map_err(Into::into)
}

pub async fn get_agent(State(state): State<AppState>, Path(id): Path<String>) -> ApiResult<Agent> {
    state
        .storage
        .get_agent(&id)?
        .map(Json)
        .ok_or_else(|| ApiError::not_found("Agent", &id))
}

pub async fn create_agent(
    State(state): State<AppState>,
    Path(project_id): Path<String>,
    Json(input): Json<CreateAgent>,
) -> ApiResult<Agent> {
    let agent = state.storage.create_agent(&project_id, input)?;

    if let Ok(agents) = state.storage.list_agents(&project_id) {
        let _ = crate::plugins::semantic::sync_agents(&project_id, &agents);
    }

    Ok(Json(agent))
}

pub async fn update_agent(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(input): Json<UpdateAgent>,
) -> ApiResult<Agent> {
    let project_id = state.storage.get_agent(&id)?.map(|a| a.project_id);

    let result = state
        .storage
        .update_agent(&id, &input)?
        .ok_or_else(|| ApiError::not_found("Agent", &id))?;

    if let Some(pid) = project_id
        && let Ok(agents) = state.storage.list_agents(&pid)
    {
        let _ = crate::plugins::semantic::sync_agents(&pid, &agents);
    }

    Ok(Json(result))
}

pub async fn delete_agent(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<DeleteResponse> {
    let project_id = state.storage.get_agent(&id)?.map(|a| a.project_id);

    let deleted = state.storage.delete_agent(&id)?;

    if let Some(pid) = project_id
        && let Ok(agents) = state.storage.list_agents(&pid)
    {
        let _ = crate::plugins::semantic::sync_agents(&pid, &agents);
    }

    Ok(Json(DeleteResponse { deleted }))
}
