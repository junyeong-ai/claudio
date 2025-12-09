use dashmap::DashMap;
use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::api::types::ChatCompletionRequest;
use crate::claude::ClaudeExecutor;
use crate::config::Config;
use crate::storage::{Agent, Project};

static REGEX_CACHE: Lazy<DashMap<String, Option<Regex>>> = Lazy::new(DashMap::new);

/// Project-level classify settings
#[derive(Debug, Clone)]
pub struct ClassifySettings {
    pub fallback_agent: String,
    pub model: String,
    pub timeout: u32,
}

impl Default for ClassifySettings {
    fn default() -> Self {
        Self {
            fallback_agent: "general".into(),
            model: "haiku".into(),
            timeout: 30,
        }
    }
}

impl From<&Project> for ClassifySettings {
    fn from(project: &Project) -> Self {
        Self {
            fallback_agent: project.fallback_agent.clone(),
            model: project.classify_model.clone(),
            timeout: project.classify_timeout as u32,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ClassifyResponse {
    /// Agent name
    pub agent: String,
    /// Agent instruction to execute (from agent body, e.g., "@code-researcher" or "/mr --review")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instruction: Option<String>,
    /// Model to use
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    /// Allowed tools for this agent
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allowed_tools: Option<Vec<String>>,
    /// Timeout in seconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<u32>,
    /// Static response (if staticResponse: true, instruction is returned here)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub static_response: Option<String>,
    /// Classification confidence (0.0 - 1.0)
    pub confidence: f64,
    /// Classification reasoning
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<String>,
    /// Classification method (keyword, semantic, llm, fallback)
    pub method: String,
    /// Matched keyword (if method is keyword)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub matched_keyword: Option<String>,
    /// Classification duration in milliseconds
    pub duration_ms: u64,
}

/// Build ClassifyResponse from Agent
fn build_response(
    agent: &Agent,
    confidence: f64,
    reasoning: Option<String>,
    method: &str,
    matched_keyword: Option<String>,
    duration_ms: u64,
) -> ClassifyResponse {
    let (instruction, static_response) = if agent.static_response {
        (None, agent.instruction.clone())
    } else {
        (agent.instruction.clone(), None)
    };

    ClassifyResponse {
        agent: agent.name.clone(),
        instruction,
        model: Some(agent.model.clone()),
        allowed_tools: agent.tools.clone(),
        timeout: Some(agent.timeout as u32),
        static_response,
        confidence,
        reasoning,
        method: method.into(),
        matched_keyword,
        duration_ms,
    }
}

/// Build fallback response when no agent matches
fn build_fallback_response(settings: &ClassifySettings, duration_ms: u64) -> ClassifyResponse {
    ClassifyResponse {
        agent: settings.fallback_agent.clone(),
        instruction: None,
        model: None,
        allowed_tools: None,
        timeout: None,
        static_response: None,
        confidence: 0.5,
        reasoning: Some("No match found".into()),
        method: "fallback".into(),
        matched_keyword: None,
        duration_ms,
    }
}

pub async fn classify_with_agents(
    text: &str,
    project_id: &str,
    agents: &[Agent],
    settings: &ClassifySettings,
) -> ClassifyResponse {
    let start = std::time::Instant::now();
    let text_lower = text.to_lowercase();

    // Sort agents by priority (highest first)
    let mut sorted_agents: Vec<_> = agents.iter().collect();
    sorted_agents.sort_by(|a, b| b.priority.cmp(&a.priority));

    // 1. Keyword matching (fastest) - supports /regex/ patterns
    for agent in &sorted_agents {
        for keyword in &agent.keywords {
            let matched = match_keyword(keyword, text, &text_lower);

            if matched {
                return build_response(
                    agent,
                    0.95,
                    Some(format!("Matched '{}' → {}", keyword, agent.name)),
                    "keyword",
                    Some(keyword.clone()),
                    start.elapsed().as_millis() as u64,
                );
            }
        }
    }

    // 2. Semantic routing with priority adjustment
    let global_config = Config::global();
    if global_config.semantic_search.enabled {
        let semantic_matches =
            crate::plugins::semantic::classify_for_project(text, Some(project_id));

        // Apply priority adjustment to each match and find the best one
        // Priority bonus: priority/1000 (e.g., priority 100 → +10%, priority 20 → +2%)
        let best_match = semantic_matches
            .into_iter()
            .filter_map(|m| {
                let agent = sorted_agents.iter().find(|a| a.id == m.agent)?;
                let priority_bonus = agent.priority.max(0) as f64 / 1000.0;
                let adjusted_score = m.score * (1.0 + priority_bonus);
                Some((agent, m, adjusted_score))
            })
            .max_by(|a, b| a.2.partial_cmp(&b.2).unwrap_or(std::cmp::Ordering::Equal));

        if let Some((agent, semantic_match, adjusted_score)) = best_match {
            return build_response(
                agent,
                adjusted_score.min(1.0), // Cap at 1.0
                Some(format!(
                    "Semantic match (raw: {:.2}, adjusted: {:.2}, priority: {}) → '{}'",
                    semantic_match.score,
                    adjusted_score,
                    agent.priority,
                    semantic_match.matched_example
                )),
                "semantic",
                None,
                start.elapsed().as_millis() as u64,
            );
        }
    }

    // 3. LLM classification fallback
    let agent_list = sorted_agents
        .iter()
        .filter(|a| !a.description.is_empty() && a.name != settings.fallback_agent)
        .map(|a| format!("- {}: {}", a.name, a.description))
        .collect::<Vec<_>>()
        .join("\n");

    let classification_prompt = format!(
        "Classify the request into the most appropriate agent.\n\n\
         Request: {}\n\n\
         Available agents:\n{}\n\
         - {}: General tasks not matching above categories\n\n\
         Respond ONLY with JSON: {{\"agent\": \"NAME\", \"reasoning\": \"brief reason\"}}",
        text, agent_list, settings.fallback_agent
    );

    let req = ChatCompletionRequest {
        user_message: classification_prompt,
        model: Some(settings.model.clone()),
        timeout: Some(settings.timeout as u64),
        working_dir: Some(global_config.defaults.isolated_dir.clone()),
        ..Default::default()
    };

    let response = ClaudeExecutor::execute(req).await;
    let duration_ms = start.elapsed().as_millis() as u64;

    if response.status.is_success()
        && let Some(result) = response.result
        && let Some((agent, reasoning)) = parse_classification_db(&result, &sorted_agents)
    {
        return build_response(agent, 0.80, reasoning, "llm", None, duration_ms);
    }

    build_fallback_response(settings, duration_ms)
}

fn match_keyword(keyword: &str, text: &str, text_lower: &str) -> bool {
    if keyword.starts_with('/') && keyword.ends_with('/') && keyword.len() > 2 {
        let pattern = &keyword[1..keyword.len() - 1];

        let entry = REGEX_CACHE
            .entry(keyword.to_string())
            .or_insert_with(|| Regex::new(&format!("(?i){}", pattern)).ok());

        entry.as_ref().is_some_and(|re| re.is_match(text))
    } else {
        text_lower.contains(&keyword.to_lowercase())
    }
}

fn parse_classification_db<'a>(
    text: &str,
    agents: &'a [&Agent],
) -> Option<(&'a Agent, Option<String>)> {
    let json_start = text.find('{')?;
    let json_end = text.rfind('}')?;

    if json_start >= json_end {
        return find_agent_by_name(text, agents);
    }

    let json_str = text.get(json_start..=json_end)?;

    #[derive(Deserialize)]
    struct ParsedResult {
        agent: String,
        reasoning: Option<String>,
    }

    if let Ok(parsed) = serde_json::from_str::<ParsedResult>(json_str)
        && let Some(agent) = agents.iter().find(|a| a.name == parsed.agent)
    {
        return Some((agent, parsed.reasoning));
    }

    find_agent_by_name(text, agents)
}

fn find_agent_by_name<'a>(text: &str, agents: &'a [&Agent]) -> Option<(&'a Agent, Option<String>)> {
    agents
        .iter()
        .find(|a| text.contains(&a.name))
        .map(|agent| (*agent, None))
}
