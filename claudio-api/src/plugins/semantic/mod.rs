use serde::{Deserialize, Serialize};
use std::io::Write;
use std::process::{Command, Stdio};
use tempfile::NamedTempFile;
use tracing::{debug, info, warn};

use crate::config::Config;
use crate::storage::Agent;

const ROUTING_TAG: &str = "type:agent-routing";
const INDEX_SOURCE: &str = "claudio";

#[derive(Debug, Clone)]
pub struct SemanticMatch {
    pub agent: String,
    pub score: f64,
    pub matched_example: String,
}

pub fn classify_for_project(text: &str, project_id: Option<&str>) -> Vec<SemanticMatch> {
    let config = Config::global();
    let semantic = &config.semantic_search;

    if !semantic.enabled {
        return vec![];
    }

    let tags = match project_id {
        Some(pid) => format!("{},project:{}", ROUTING_TAG, pid),
        None => ROUTING_TAG.to_string(),
    };

    let output = Command::new("ssearch")
        .args([
            "search",
            text,
            "--tags",
            &tags,
            "--format",
            "json",
            "--limit",
            &semantic.top_k.to_string(),
        ])
        .output();

    let output = match output {
        Ok(out) if out.status.success() => out,
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            debug!("ssearch failed: {}", stderr);
            return vec![];
        }
        Err(e) => {
            debug!("Failed to run ssearch: {}", e);
            return vec![];
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let result: SearchResult = match serde_json::from_str(&stdout) {
        Ok(r) => r,
        Err(e) => {
            debug!("Failed to parse ssearch output: {}", e);
            return vec![];
        }
    };

    result
        .results
        .into_iter()
        .filter_map(|hit| {
            let agent = hit.tags.iter().find(|t| t.key == "agent")?.value.clone();

            if hit.score < semantic.min_score {
                return None;
            }

            Some(SemanticMatch {
                agent,
                score: hit.score,
                matched_example: hit.content,
            })
        })
        .collect()
}

#[derive(Debug, Deserialize)]
struct SearchResult {
    results: Vec<SearchHit>,
}

#[derive(Debug, Deserialize)]
struct SearchHit {
    content: String,
    score: f64,
    tags: Vec<Tag>,
}

#[derive(Debug, Deserialize)]
struct Tag {
    key: String,
    value: String,
}

#[derive(Debug, Serialize)]
struct ImportDoc {
    content: String,
    url: String,
}

pub fn sync_agents(project_id: &str, agents: &[Agent]) -> anyhow::Result<usize> {
    let config = Config::global();
    if !config.semantic_search.enabled {
        debug!("Semantic search disabled, skipping agent sync");
        return Ok(0);
    }

    info!("Syncing agents for project: {}", project_id);

    let project_tag = format!("project:{}", project_id);
    let delete_result = Command::new("ssearch")
        .args(["tags", "delete", &project_tag, "-y"])
        .output();

    match delete_result {
        Ok(out) if out.status.success() => {
            info!("Deleted existing index for project: {}", project_id);
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            debug!("ssearch delete (may be empty): {}", stderr);
        }
        Err(e) => {
            warn!("Failed to delete existing index: {}", e);
        }
    }

    let mut total_indexed = 0;

    for agent in agents {
        if agent.priority < 0 || agent.examples.is_empty() {
            continue;
        }

        let examples = &agent.examples;

        let mut temp_file = match NamedTempFile::new() {
            Ok(f) => f,
            Err(e) => {
                warn!("Failed to create temp file: {}", e);
                continue;
            }
        };

        for (i, example) in examples.iter().enumerate() {
            let doc = ImportDoc {
                content: example.clone(),
                url: format!("agent://{}/{}", agent.id, i),
            };
            if let Ok(json) = serde_json::to_string(&doc) {
                let _ = writeln!(temp_file, "{}", json);
            }
        }

        let _ = temp_file.flush();
        let temp_path = temp_file.path();

        let tags = format!("{},agent:{},project:{}", ROUTING_TAG, agent.id, project_id);

        let import_result = Command::new("ssearch")
            .args([
                "import",
                temp_path.to_str().unwrap_or(""),
                "--tags",
                &tags,
                "--source",
                INDEX_SOURCE,
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();

        match import_result {
            Ok(status) if status.success() => {
                debug!(
                    "Indexed {} examples for agent: {}",
                    examples.len(),
                    agent.name
                );
                total_indexed += examples.len();
            }
            Ok(_) => {
                warn!("Failed to index agent: {}", agent.name);
            }
            Err(e) => {
                warn!("ssearch import error for {}: {}", agent.name, e);
            }
        }
    }

    info!(
        "Agent sync complete: {} examples indexed for project {}",
        total_indexed, project_id
    );

    Ok(total_indexed)
}
