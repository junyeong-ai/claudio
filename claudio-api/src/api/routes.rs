use axum::{
    Router,
    extract::DefaultBodyLimit,
    http::{Method, header},
    routing::{delete, get, post},
};
use std::net::SocketAddr;

use crate::api::handlers;
use crate::api::rate_limit::RateLimitState;
use crate::storage::Storage;

const MAX_REQUEST_SIZE: usize = 10 * 1024 * 1024; // 10MB

#[derive(Clone)]
pub struct AppState {
    pub storage: Storage,
    pub rate_limit: RateLimitState,
}

pub fn create_router(storage: Storage) -> Router {
    let state = AppState {
        storage,
        rate_limit: RateLimitState::new(),
    };

    let cors = tower_http::cors::CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]);

    Router::new()
        // Health & Config
        .route("/health", get(handlers::health))
        .route("/v1/config", get(handlers::get_config))
        // Projects
        .route(
            "/v1/projects",
            get(handlers::list_projects).post(handlers::create_project),
        )
        .route(
            "/v1/projects/{id}",
            get(handlers::get_project)
                .put(handlers::update_project)
                .delete(handlers::delete_project),
        )
        // Agents
        .route(
            "/v1/projects/{project_id}/agents",
            get(handlers::list_agents).post(handlers::create_agent),
        )
        .route(
            "/v1/agents/{id}",
            get(handlers::get_agent)
                .put(handlers::update_agent)
                .delete(handlers::delete_agent),
        )
        // Chat & Classify
        .route(
            "/v1/projects/{project_id}/classify",
            post(handlers::classify_project),
        )
        .route(
            "/v1/projects/{project_id}/chat",
            post(handlers::chat_project),
        )
        // Executions
        .route("/v1/executions", get(handlers::list_executions))
        .route("/v1/executions/filters", get(handlers::get_filter_options))
        .route("/v1/executions/lookup", get(handlers::lookup_execution))
        .route(
            "/v1/executions/recent",
            get(handlers::get_recent_executions),
        )
        .route(
            "/v1/executions/{id}",
            get(handlers::get_execution_detail).patch(handlers::update_execution),
        )
        .route(
            "/v1/executions/{id}/reactions",
            get(handlers::get_reactions)
                .post(handlers::add_reaction)
                .delete(handlers::remove_reaction),
        )
        // Stats
        .route("/v1/stats", get(handlers::get_stats))
        .route("/v1/stats/{project}", get(handlers::get_project_stats))
        .route("/v1/stats/overview", get(handlers::get_stats_overview))
        .route("/v1/stats/timeseries", get(handlers::get_stats_timeseries))
        .route("/v1/stats/models", get(handlers::get_stats_models))
        .route("/v1/stats/errors", get(handlers::get_stats_errors))
        .route("/v1/stats/sources", get(handlers::get_stats_sources))
        .route("/v1/stats/requesters", get(handlers::get_stats_requesters))
        // Workflows
        .route(
            "/v1/workflows/stats",
            get(handlers::get_workflow_stats).post(handlers::record_workflow_stats),
        )
        // Classify
        .route("/v1/classify/stats", get(handlers::get_classify_stats))
        .route("/v1/classify/logs", get(handlers::get_classify_logs))
        // Users
        .route("/v1/users", get(handlers::list_users))
        .route(
            "/v1/users/{user_id}/context",
            get(handlers::get_user_context).put(handlers::save_user_context),
        )
        .route(
            "/v1/users/{user_id}/rules",
            get(handlers::get_user_rules)
                .post(handlers::add_user_rule)
                .delete(handlers::delete_user_rule),
        )
        .route(
            "/v1/users/{user_id}/context/lock",
            delete(handlers::release_summary_lock),
        )
        // Utils
        .route("/v1/format/mrkdwn", post(handlers::convert_to_mrkdwn))
        .layer(DefaultBodyLimit::max(MAX_REQUEST_SIZE))
        .layer(cors)
        .with_state(state)
}

pub fn into_service(
    router: Router,
) -> axum::extract::connect_info::IntoMakeServiceWithConnectInfo<Router, SocketAddr> {
    router.into_make_service_with_connect_info::<SocketAddr>()
}
