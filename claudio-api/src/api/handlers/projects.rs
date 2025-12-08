use axum::{
    Json,
    extract::{Path, State},
};
use serde::Serialize;

use crate::api::error::{ApiError, ApiResult};
use crate::api::routes::AppState;
use crate::storage::{CreateProject, Project, UpdateProject};

pub async fn list_projects(State(state): State<AppState>) -> ApiResult<Vec<Project>> {
    state.storage.list_projects().map(Json).map_err(Into::into)
}

pub async fn get_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Project> {
    state
        .storage
        .get_project(&id)?
        .map(Json)
        .ok_or_else(|| ApiError::not_found("Project", &id))
}

pub async fn create_project(
    State(state): State<AppState>,
    Json(input): Json<CreateProject>,
) -> ApiResult<Project> {
    state
        .storage
        .create_project(input)
        .map(Json)
        .map_err(Into::into)
}

pub async fn update_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(input): Json<UpdateProject>,
) -> ApiResult<Project> {
    state
        .storage
        .update_project(&id, &input)?
        .map(Json)
        .ok_or_else(|| ApiError::not_found("Project", &id))
}

#[derive(Serialize)]
pub struct DeleteResponse {
    pub deleted: bool,
}

pub async fn delete_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<DeleteResponse> {
    let deleted = state.storage.delete_project(&id)?;
    if deleted {
        state.rate_limit.remove(&id);
    }
    Ok(Json(DeleteResponse { deleted }))
}
