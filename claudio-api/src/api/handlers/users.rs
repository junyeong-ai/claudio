use axum::{
    Json,
    extract::{Path, Query, State},
};
use serde::{Deserialize, Serialize};

use crate::api::error::{ApiError, ApiResult};
use crate::api::handlers::UpdateResponse;
use crate::api::handlers::chat::format_user_context;
use crate::api::routes::AppState;
use crate::storage::{UserContext, UserListItem};

pub async fn list_users(State(state): State<AppState>) -> ApiResult<Vec<UserListItem>> {
    state
        .storage
        .list_users_with_context()
        .map(Json)
        .map_err(Into::into)
}

#[derive(Deserialize)]
pub struct UserContextQuery {
    #[serde(default)]
    pub format: Option<String>,
    #[serde(default)]
    pub user_name: Option<String>,
    #[serde(default)]
    pub acquire_lock: Option<bool>,
    #[serde(default)]
    pub lock_id: Option<String>,
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum UserContextResponse {
    Json(UserContext),
    Markdown {
        user_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        user_name: Option<String>,
        markdown: String,
        needs_summary: bool,
        summary_locked: bool,
        lock_acquired: bool,
        lock_id: Option<String>,
    },
}

pub async fn get_user_context(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
    Query(query): Query<UserContextQuery>,
) -> ApiResult<UserContextResponse> {
    let ctx = state
        .storage
        .get_user_context(&user_id)
        .map_err(ApiError::from)?;

    if query.format.as_deref() == Some("markdown") {
        let mut lock_acquired = false;
        let mut effective_lock_id = query.lock_id.clone();

        if query.acquire_lock == Some(true)
            && ctx.needs_summary
            && !ctx.summary_locked
            && let Some(ref lid) = query.lock_id
        {
            lock_acquired = state
                .storage
                .acquire_summary_lock(&user_id, lid)
                .unwrap_or(false);
            if lock_acquired {
                effective_lock_id = Some(lid.clone());
            }
        }

        let markdown = format_user_context(&ctx, query.user_name.as_deref());

        Ok(Json(UserContextResponse::Markdown {
            user_id: ctx.user_id,
            user_name: query.user_name.clone(),
            markdown,
            needs_summary: ctx.needs_summary,
            summary_locked: ctx.summary_locked,
            lock_acquired,
            lock_id: effective_lock_id,
        }))
    } else {
        Ok(Json(UserContextResponse::Json(ctx)))
    }
}

#[derive(Deserialize)]
pub struct SaveContextRequest {
    pub summary: String,
    pub rules: Vec<String>,
}

pub async fn save_user_context(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
    Json(req): Json<SaveContextRequest>,
) -> ApiResult<UpdateResponse> {
    state
        .storage
        .save_user_context(&user_id, &req.summary, &req.rules)
        .map(|_| {
            Json(UpdateResponse {
                success: true,
                error: None,
            })
        })
        .map_err(Into::into)
}

pub async fn get_user_rules(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> ApiResult<Vec<String>> {
    state
        .storage
        .get_user_rules(&user_id)
        .map(Json)
        .map_err(Into::into)
}

#[derive(Deserialize)]
pub struct RuleRequest {
    pub rule: String,
}

pub async fn add_user_rule(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
    Json(req): Json<RuleRequest>,
) -> ApiResult<UpdateResponse> {
    state
        .storage
        .add_user_rule(&user_id, &req.rule)
        .map(|added| {
            Json(UpdateResponse {
                success: added,
                error: if added {
                    None
                } else {
                    Some("rule already exists".into())
                },
            })
        })
        .map_err(Into::into)
}

pub async fn delete_user_rule(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
    Json(req): Json<RuleRequest>,
) -> ApiResult<UpdateResponse> {
    state
        .storage
        .delete_user_rule(&user_id, &req.rule)
        .map(|deleted| {
            Json(UpdateResponse {
                success: deleted,
                error: if deleted {
                    None
                } else {
                    Some("rule not found".into())
                },
            })
        })
        .map_err(Into::into)
}

#[derive(Deserialize)]
pub struct ReleaseLockRequest {
    pub lock_id: String,
}

pub async fn release_summary_lock(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
    Json(req): Json<ReleaseLockRequest>,
) -> ApiResult<UpdateResponse> {
    state
        .storage
        .release_summary_lock(&user_id, &req.lock_id)
        .map(|released| {
            Json(UpdateResponse {
                success: released,
                error: if released {
                    None
                } else {
                    Some("lock not found or mismatch".into())
                },
            })
        })
        .map_err(Into::into)
}
