use axum::{
    Json,
    extract::{Path, State},
};
use chrono::Utc;
use serde::Deserialize;

use crate::api::classify::{self, ClassifyResponse, ClassifySettings};
use crate::api::error::{ApiError, ApiResult};
use crate::api::routes::AppState;
use crate::api::types::{ChatCompletionRequest, ChatCompletionResponse};
use crate::claude::ClaudeExecutor;
use crate::config::Config;
use crate::storage::{ClassificationLog, Execution};

#[derive(Deserialize)]
pub struct ProjectClassifyRequest {
    pub text: String,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub requester: Option<String>,
}

pub async fn classify_project(
    State(state): State<AppState>,
    Path(project_id): Path<String>,
    Json(req): Json<ProjectClassifyRequest>,
) -> ApiResult<ClassifyResponse> {
    let project = state
        .storage
        .get_project(&project_id)?
        .ok_or_else(|| ApiError::not_found("Project", &project_id))?;

    let agents = state.storage.list_agents(&project_id)?;

    if agents.is_empty() {
        return Err(ApiError::not_found("Agents for project", &project_id));
    }

    let settings = ClassifySettings::from(&project);
    let response = classify::classify_with_agents(&req.text, &project_id, &agents, &settings).await;

    let log = ClassificationLog {
        text: req.text,
        agent: response.agent.clone(),
        model: response.model.clone(),
        confidence: response.confidence,
        method: response.method.clone(),
        matched_keyword: response.matched_keyword.clone(),
        reasoning: response.reasoning.clone(),
        duration_ms: response.duration_ms as i64,
        project: Some(project_id),
        source: req.source,
        requester: req.requester,
    };

    if let Err(e) = state.storage.save_classification(&log) {
        tracing::error!(agent = %log.agent, error = %e, "Failed to save classification log");
    }

    Ok(Json(response))
}

pub async fn chat_project(
    State(state): State<AppState>,
    Path(project_id): Path<String>,
    Json(mut req): Json<ChatCompletionRequest>,
) -> ApiResult<ChatCompletionResponse> {
    let original_user_message = req.user_message.clone();

    if let Ok(Some(project)) = state.storage.get_project(&project_id)
        && state
            .rate_limit
            .check(&project_id, project.rate_limit_rpm)
            .is_err()
    {
        return Err(ApiError::rate_limit(&project_id));
    }

    let mut is_isolated = false;
    let mut agent_tools: Option<Vec<String>> = None;
    if let Some(ref agent_name) = req.agent
        && let Ok(Some(agent)) = state.storage.get_agent_by_name(&project_id, agent_name)
    {
        if let Some(ref agent_instruction) = agent.instruction {
            req.instruction = match req.instruction {
                Some(ref req_instruction) => {
                    Some(format!("{}\n\n{}", agent_instruction, req_instruction))
                }
                None => Some(agent_instruction.clone()),
            };
        }
        if req.model.is_none() {
            req.model = Some(agent.model);
        }
        if req.timeout.is_none() && agent.timeout > 0 {
            req.timeout = Some(agent.timeout as u64);
        }
        agent_tools = agent.tools;
        is_isolated = agent.isolated;
    }

    if let Ok(Some(project)) = state.storage.get_project(&project_id) {
        if req.working_dir.is_none() {
            if is_isolated {
                let config = Config::global();
                req.working_dir = Some(config.defaults.isolated_dir.clone());
            } else {
                req.working_dir = Some(project.working_dir);
            }
        }
        if req.allowed_tools.is_none() {
            req.allowed_tools = match (agent_tools, project.allowed_tools) {
                (Some(agent), Some(project)) => {
                    let mut merged = agent;
                    for tool in project {
                        if !merged.contains(&tool) {
                            merged.push(tool);
                        }
                    }
                    Some(merged)
                }
                (Some(agent), None) => Some(agent),
                (None, Some(project)) => Some(project),
                (None, None) => None,
            };
        }
        if req.disallowed_tools.is_none() {
            req.disallowed_tools = project.disallowed_tools;
        }
        if req.system_prompt.is_none() {
            req.system_prompt = project.system_prompt;
        }
    }

    let mut user_context_snapshot: Option<String> = None;
    if req.include_context
        && let Some(ref requester) = req.requester
        && let Ok(ctx) = state.storage.get_user_context(requester)
    {
        let formatted = format_user_context(&ctx, None);
        if !formatted.is_empty() {
            user_context_snapshot = Some(formatted);
        }
    }

    let instruction_snapshot = req.instruction.clone();
    req.user_message = format_structured_message(
        req.instruction.as_deref(),
        user_context_snapshot.as_deref(),
        &original_user_message,
    );
    req.instruction = None;

    req.project = Some(project_id.clone());

    let source = req.source.clone();
    let requester = req.requester.clone();
    let agent = req.agent.clone();
    let model_for_execution = req.model.clone();
    let metadata_str = req.metadata.as_ref().map(|m| m.to_string());

    let response = ClaudeExecutor::execute(req).await;

    let actual_model = response
        .claude_response
        .as_ref()
        .and_then(|c| c.model_usage.as_ref())
        .and_then(|mu| mu.keys().next().cloned())
        .or(model_for_execution);

    let execution = Execution {
        id: response.id.clone(),
        project: response.project.clone(),
        source,
        requester,
        agent,
        instruction: instruction_snapshot,
        user_message: original_user_message,
        user_context: user_context_snapshot,
        response: response.result.clone().unwrap_or_default(),
        model: actual_model,
        cost_usd: response
            .claude_response
            .as_ref()
            .and_then(|c| c.total_cost_usd),
        input_tokens: response
            .claude_response
            .as_ref()
            .and_then(|c| c.usage.as_ref())
            .and_then(|u| u.input_tokens.map(|v| v as i64)),
        output_tokens: response
            .claude_response
            .as_ref()
            .and_then(|c| c.usage.as_ref())
            .and_then(|u| u.output_tokens.map(|v| v as i64)),
        cache_read_tokens: response
            .claude_response
            .as_ref()
            .and_then(|c| c.usage.as_ref())
            .and_then(|u| u.cache_read_input_tokens.map(|v| v as i64)),
        cache_creation_tokens: response
            .claude_response
            .as_ref()
            .and_then(|c| c.usage.as_ref())
            .and_then(|u| u.cache_creation_input_tokens.map(|v| v as i64)),
        duration_ms: Some(response.duration_ms as i64),
        duration_api_ms: response
            .claude_response
            .as_ref()
            .and_then(|c| c.duration_api_ms.map(|v| v as i64)),
        session_id: response
            .claude_response
            .as_ref()
            .map(|c| c.session_id.clone()),
        metadata: metadata_str,
        created_at: response.created,
    };

    if let Err(e) = state.storage.save(&execution) {
        tracing::error!(execution_id = %response.id, error = %e, "Failed to save execution");
    }

    Ok(Json(response))
}

fn format_structured_message(
    instruction: Option<&str>,
    user_context: Option<&str>,
    user_message: &str,
) -> String {
    let has_instruction = instruction.is_some_and(|s| !s.is_empty());
    let has_context = user_context.is_some_and(|s| !s.is_empty());

    if !has_instruction && !has_context {
        return user_message.to_string();
    }

    let mut parts = Vec::new();

    if let Some(inst) = instruction.filter(|s| !s.is_empty()) {
        parts.push(format!("<task_instruction>\n{}\n</task_instruction>", inst));
    }

    if let Some(ctx) = user_context.filter(|s| !s.is_empty()) {
        parts.push(format!("<user_context>\n{}\n</user_context>", ctx));
    }

    parts.push(format!("<user_request>\n{}\n</user_request>", user_message));

    let mut guide = vec!["Process the structured request above:".to_string()];
    if has_instruction {
        guide.push("- <task_instruction>: Task guidelines.".to_string());
    }
    if has_context {
        guide.push("- <user_context>: User rules and recent activity. [Detail: URL] links can be fetched via WebFetch for full response details when context is needed.".to_string());
    }
    guide.push("- <user_request>: The request to fulfill.".to_string());
    parts.push(guide.join("\n"));

    parts.join("\n\n")
}

pub fn format_user_context(ctx: &crate::storage::UserContext, user_name: Option<&str>) -> String {
    let base_url = &Config::global().server.base_url;
    let mut parts = Vec::new();

    parts.push(format!("**Today**: {}", Utc::now().format("%Y-%m-%d")));
    if let Some(name) = user_name {
        parts.push(format!("**User**: {}", name));
    }

    if let Some(ref summary) = ctx.summary
        && !summary.is_empty()
    {
        parts.push(format!("## Summary\n{}", summary));
    }

    if !ctx.rules.is_empty() {
        let rules = ctx
            .rules
            .iter()
            .map(|r| format!("- {}", r))
            .collect::<Vec<_>>()
            .join("\n");
        parts.push(format!(
            "## Rules (overridden by Recent Requests below)\n{}",
            rules
        ));
    }

    if !ctx.recent_conversations.is_empty() {
        let recent: Vec<String> = ctx
            .recent_conversations
            .iter()
            .map(|c| {
                let ts = chrono::DateTime::from_timestamp(c.created_at, 0)
                    .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
                    .unwrap_or_else(|| c.created_at.to_string());
                let mut entry = format!(
                    "### {}\n{}\n[Detail: {}/v1/executions/{}]",
                    ts, c.user_message, base_url, c.id
                );
                if c.has_negative_feedback
                    && let Some(ref resp) = c.response
                {
                    entry.push_str(&format!(
                        "\n**[Negative feedback]**\n{}",
                        truncate(resp, 500)
                    ));
                }
                entry
            })
            .collect();
        parts.push(format!("## Recent Requests\n\n{}", recent.join("\n\n")));
    }

    parts.join("\n\n")
}

fn truncate(s: &str, max: usize) -> String {
    if max == 0 {
        return String::new();
    }
    if s.chars().count() <= max {
        return s.to_string();
    }
    let truncated: String = s.chars().take(max).collect();
    format!("{}...", truncated)
}
