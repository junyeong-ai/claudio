use std::path::Path;
use std::process::Stdio;
use std::time::{Duration, Instant};
use tokio::process::Command;

use crate::Config;
use crate::api::types::{
    ChatCompletionRequest, ChatCompletionResponse, ClaudeCliOutput, ErrorInfo, ExecutionStatus,
};

pub struct ClaudeExecutor;

struct ResolvedProject {
    name: String,
    working_dir: String,
    allowed_tools: Option<Vec<String>>,
    disallowed_tools: Option<Vec<String>>,
    system_prompt: Option<String>,
}

impl ClaudeExecutor {
    pub async fn execute(req: ChatCompletionRequest) -> ChatCompletionResponse {
        let request_id = uuid::Uuid::new_v4().to_string();
        let created = chrono::Utc::now().timestamp();
        let start = Instant::now();

        let resolved = match Self::resolve_project(&req) {
            Some(r) => r,
            None => {
                return ChatCompletionResponse {
                    id: request_id,
                    status: ExecutionStatus::Failed,
                    created,
                    result: None,
                    claude_response: None,
                    error: Some(ErrorInfo {
                        code: "invalid_project".into(),
                        message: "No valid project configured".into(),
                    }),
                    project: req.project.unwrap_or_default(),
                    duration_ms: start.elapsed().as_millis() as u64,
                };
            }
        };

        let working_dir = Path::new(&resolved.working_dir);
        if !working_dir.exists() {
            return ChatCompletionResponse {
                id: request_id,
                status: ExecutionStatus::Failed,
                created,
                result: None,
                claude_response: None,
                error: Some(ErrorInfo {
                    code: "invalid_working_dir".into(),
                    message: format!("Working directory does not exist: {}", resolved.working_dir),
                }),
                project: resolved.name,
                duration_ms: start.elapsed().as_millis() as u64,
            };
        }

        let args = Self::build_args(&req, &resolved);
        let timeout = req.timeout.unwrap_or(300);

        tracing::info!(
            "Executing Claude CLI for project '{}' in {} (timeout: {}s, allowed_tools: {:?})",
            resolved.name,
            resolved.working_dir,
            timeout,
            req.allowed_tools
        );
        tracing::debug!("CLI args: {:?}", args);

        let result = tokio::time::timeout(
            Duration::from_secs(timeout),
            Command::new("claude")
                .current_dir(&resolved.working_dir)
                .args(&args)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output(),
        )
        .await;

        let duration_ms = start.elapsed().as_millis() as u64;

        match result {
            Ok(Ok(output)) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout);

                match serde_json::from_str::<ClaudeCliOutput>(&stdout) {
                    Ok(claude_output) => {
                        tracing::info!(
                            "Claude execution completed in {}ms (API: {}ms)",
                            duration_ms,
                            claude_output.duration_api_ms.unwrap_or(0)
                        );

                        let result = Some(claude_output.result.clone());
                        ChatCompletionResponse {
                            id: request_id,
                            status: ExecutionStatus::Completed,
                            created,
                            result,
                            claude_response: Some(claude_output),
                            error: None,
                            project: resolved.name,
                            duration_ms,
                        }
                    }
                    Err(e) => {
                        tracing::warn!("Failed to parse Claude output as JSON: {}", e);

                        ChatCompletionResponse {
                            id: request_id,
                            status: ExecutionStatus::Completed,
                            created,
                            result: Some(stdout.into_owned()),
                            claude_response: None,
                            error: None,
                            project: resolved.name,
                            duration_ms,
                        }
                    }
                }
            }
            Ok(Ok(output)) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let stdout = String::from_utf8_lossy(&output.stdout);

                tracing::error!("Claude execution failed: {}", stderr);

                let error_msg =
                    if let Ok(claude_output) = serde_json::from_str::<ClaudeCliOutput>(&stdout) {
                        if claude_output.is_error {
                            claude_output.result
                        } else {
                            stderr.into_owned()
                        }
                    } else {
                        stderr.into_owned()
                    };

                ChatCompletionResponse {
                    id: request_id,
                    status: ExecutionStatus::Failed,
                    created,
                    result: None,
                    claude_response: None,
                    error: Some(ErrorInfo {
                        code: "execution_failed".into(),
                        message: error_msg,
                    }),
                    project: resolved.name,
                    duration_ms,
                }
            }
            Ok(Err(e)) => {
                tracing::error!("Failed to spawn Claude CLI: {}", e);

                ChatCompletionResponse {
                    id: request_id,
                    status: ExecutionStatus::Failed,
                    created,
                    result: None,
                    claude_response: None,
                    error: Some(ErrorInfo {
                        code: "spawn_failed".into(),
                        message: format!("Failed to spawn Claude CLI: {}", e),
                    }),
                    project: resolved.name,
                    duration_ms,
                }
            }
            Err(_) => {
                tracing::error!("Claude execution timed out after {}s", timeout);

                ChatCompletionResponse {
                    id: request_id,
                    status: ExecutionStatus::Timeout,
                    created,
                    result: None,
                    claude_response: None,
                    error: Some(ErrorInfo {
                        code: "timeout".into(),
                        message: format!("Execution timed out after {}s", timeout),
                    }),
                    project: resolved.name,
                    duration_ms,
                }
            }
        }
    }

    fn resolve_project(req: &ChatCompletionRequest) -> Option<ResolvedProject> {
        let config = Config::global();
        let project_name = req.project.as_deref().unwrap_or("default");

        let disallowed_tools = req.disallowed_tools.clone().or_else(|| {
            let defaults = &config.defaults.disallowed_tools;
            if defaults.is_empty() {
                None
            } else {
                Some(defaults.clone())
            }
        });

        let working_dir = req.working_dir.clone().unwrap_or_else(|| ".".to_string());

        Some(ResolvedProject {
            name: project_name.to_string(),
            working_dir,
            allowed_tools: req.allowed_tools.clone(),
            disallowed_tools,
            system_prompt: req.system_prompt.clone(),
        })
    }

    fn build_args(req: &ChatCompletionRequest, resolved: &ResolvedProject) -> Vec<String> {
        let mut args = vec!["--print".into(), "--output-format".into(), "json".into()];

        if let Some(ref model) = req.model {
            args.push("--model".into());
            args.push(model.clone());
        }

        if let Some(ref fallback) = req.fallback_model {
            args.push("--fallback-model".into());
            args.push(fallback.clone());
        }

        if let Some(ref allowed) = resolved.allowed_tools
            && !allowed.is_empty()
        {
            args.push("--allowed-tools".into());
            args.push(allowed.join(" "));
        }

        if let Some(ref disallowed) = resolved.disallowed_tools
            && !disallowed.is_empty()
        {
            args.push("--disallowed-tools".into());
            args.push(disallowed.join(" "));
        }

        args.push("--permission-mode".into());
        args.push("dontAsk".into());

        let system_prompt = req
            .system_prompt
            .as_ref()
            .or(resolved.system_prompt.as_ref());

        if let Some(prompt) = system_prompt {
            args.push("--append-system-prompt".into());
            args.push(prompt.clone());
        }

        if let Some(ref id) = req.session_id {
            args.push("--session-id".into());
            args.push(id.clone());
        }

        if req.continue_session == Some(true) {
            args.push("--continue".into());
        }

        if let Some(ref id) = req.resume_session_id {
            args.push("--resume".into());
            args.push(id.clone());
        }

        if let Some(ref dirs) = req.add_dirs {
            for dir in dirs {
                args.push("--add-dir".into());
                args.push(dir.clone());
            }
        }

        if let Some(ref config) = req.mcp_config {
            args.push("--mcp-config".into());
            args.push(config.to_string());
        }

        if let Some(ref agents) = req.agents {
            args.push("--agents".into());
            args.push(agents.to_string());
        }

        args.push(req.user_message.clone());
        args
    }
}
