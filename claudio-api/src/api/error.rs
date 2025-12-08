use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub code: ErrorCode,
    pub message: String,
    #[serde(skip)]
    pub status_code: StatusCode,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    NotFound,
    Forbidden,
    RateLimited,
    Internal,
}

impl ApiError {
    pub fn not_found(resource: &str, id: &str) -> Self {
        Self {
            code: ErrorCode::NotFound,
            message: format!("{} '{}' not found", resource, id),
            status_code: StatusCode::NOT_FOUND,
        }
    }

    pub fn forbidden(message: impl Into<String>) -> Self {
        Self {
            code: ErrorCode::Forbidden,
            message: message.into(),
            status_code: StatusCode::FORBIDDEN,
        }
    }

    pub fn rate_limit(project_id: &str) -> Self {
        Self {
            code: ErrorCode::RateLimited,
            message: format!("Rate limit exceeded for project '{}'", project_id),
            status_code: StatusCode::TOO_MANY_REQUESTS,
        }
    }

    pub fn internal() -> Self {
        Self {
            code: ErrorCode::Internal,
            message: "Internal server error".into(),
            status_code: StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status_code, Json(self)).into_response()
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        tracing::error!(error = %err, "Internal error");
        Self::internal()
    }
}

pub type ApiResult<T> = Result<Json<T>, ApiError>;
