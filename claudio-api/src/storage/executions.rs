use anyhow::Result;
use rusqlite::params;

use super::core::Storage;
use super::feedback::calculate_score;
use super::types::{
    ClassificationLog, Execution, ExecutionDetail, ExecutionFilter, ExecutionListItem,
    ExecutionListResponse, FilterOptions, RecentExecution, Stats,
};

fn calculate_feedback(positive: i64, negative: i64) -> Option<i32> {
    calculate_score(positive, negative)
}

impl Storage {
    pub fn save(&self, execution: &Execution) -> Result<()> {
        let conn = self.conn()?;
        conn.execute(
            "INSERT INTO executions (
                id, project, source, requester, agent, instruction, user_message, user_context,
                response, structured_output, model, cost_usd, input_tokens, output_tokens,
                cache_read_tokens, cache_creation_tokens, duration_ms, duration_api_ms,
                session_id, metadata, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)",
            params![
                execution.id,
                execution.project,
                execution.source,
                execution.requester,
                execution.agent,
                execution.instruction,
                execution.user_message,
                execution.user_context,
                execution.response,
                execution.structured_output,
                execution.model,
                execution.cost_usd,
                execution.input_tokens,
                execution.output_tokens,
                execution.cache_read_tokens,
                execution.cache_creation_tokens,
                execution.duration_ms,
                execution.duration_api_ms,
                execution.session_id,
                execution.metadata,
                execution.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn save_classification(&self, log: &ClassificationLog) -> Result<i64> {
        let conn = self.conn()?;
        conn.execute(
            "INSERT INTO classification_logs (
                text, agent, model, confidence, method, matched_keyword,
                reasoning, duration_ms, project, source, requester
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                log.text,
                log.agent,
                log.model,
                log.confidence,
                log.method,
                log.matched_keyword,
                log.reasoning,
                log.duration_ms,
                log.project,
                log.source,
                log.requester,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update_metadata(&self, id: &str, updates: &serde_json::Value) -> Result<bool> {
        let conn = self.conn()?;

        let current: Option<String> = conn
            .query_row(
                "SELECT metadata FROM executions WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .ok();

        let mut merged: serde_json::Value = current
            .as_ref()
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_else(|| serde_json::json!({}));

        if let (Some(base), Some(new)) = (merged.as_object_mut(), updates.as_object()) {
            for (k, v) in new {
                base.insert(k.clone(), v.clone());
            }
        }

        let new_metadata = serde_json::to_string(&merged)?;
        let updated = conn.execute(
            "UPDATE executions SET metadata = ?1 WHERE id = ?2",
            params![new_metadata, id],
        )?;
        Ok(updated > 0)
    }

    pub fn find_by_metadata_ref(
        &self,
        source: &str,
        ref_key: &str,
        ref_value: &str,
    ) -> Result<Option<Execution>> {
        let conn = self.conn()?;
        let pattern = format!("%\"{}\":\"{}%", ref_key, ref_value);
        let mut stmt = conn.prepare(
            "SELECT id, project, source, requester, agent, instruction, user_message, user_context,
                    response, structured_output, model, cost_usd, input_tokens, output_tokens,
                    cache_read_tokens, cache_creation_tokens, duration_ms, duration_api_ms,
                    session_id, metadata, created_at
             FROM executions WHERE source = ?1 AND metadata LIKE ?2
             ORDER BY created_at DESC LIMIT 1",
        )?;

        let result = stmt
            .query_row(params![source, pattern], |row| {
                Ok(Execution {
                    id: row.get(0)?,
                    project: row.get(1)?,
                    source: row.get(2)?,
                    requester: row.get(3)?,
                    agent: row.get(4)?,
                    instruction: row.get(5)?,
                    user_message: row.get(6)?,
                    user_context: row.get(7)?,
                    response: row.get(8)?,
                    structured_output: row.get(9)?,
                    model: row.get(10)?,
                    cost_usd: row.get(11)?,
                    input_tokens: row.get(12)?,
                    output_tokens: row.get(13)?,
                    cache_read_tokens: row.get(14)?,
                    cache_creation_tokens: row.get(15)?,
                    duration_ms: row.get(16)?,
                    duration_api_ms: row.get(17)?,
                    session_id: row.get(18)?,
                    metadata: row.get(19)?,
                    created_at: row.get(20)?,
                })
            })
            .ok();

        Ok(result)
    }

    pub fn get_stats(&self, project: Option<&str>) -> Result<Stats> {
        let conn = self.conn()?;

        let (exec_query, fb_query, param): (&str, &str, Option<&str>) = match project {
            Some(p) => (
                "SELECT COUNT(*), COALESCE(SUM(CASE WHEN response != '' THEN 1 ELSE 0 END), 0),
                        COALESCE(SUM(cost_usd), 0), COALESCE(SUM(input_tokens), 0),
                        COALESCE(SUM(output_tokens), 0), COALESCE(AVG(duration_ms), 0)
                 FROM executions WHERE project = ?1",
                "SELECT COALESCE(SUM(CASE WHEN reaction IN ('thumbsup', '+1') THEN 1 ELSE 0 END), 0),
                        COALESCE(SUM(CASE WHEN reaction IN ('thumbsdown', '-1') THEN 1 ELSE 0 END), 0)
                 FROM reactions r JOIN executions e ON r.execution_id = e.id
                 WHERE r.category = 'feedback' AND r.user_id = e.requester AND e.project = ?1",
                Some(p),
            ),
            None => (
                "SELECT COUNT(*), COALESCE(SUM(CASE WHEN response != '' THEN 1 ELSE 0 END), 0),
                        COALESCE(SUM(cost_usd), 0), COALESCE(SUM(input_tokens), 0),
                        COALESCE(SUM(output_tokens), 0), COALESCE(AVG(duration_ms), 0)
                 FROM executions",
                "SELECT COALESCE(SUM(CASE WHEN reaction IN ('thumbsup', '+1') THEN 1 ELSE 0 END), 0),
                        COALESCE(SUM(CASE WHEN reaction IN ('thumbsdown', '-1') THEN 1 ELSE 0 END), 0)
                 FROM reactions r JOIN executions e ON r.execution_id = e.id
                 WHERE r.category = 'feedback' AND r.user_id = e.requester",
                None,
            ),
        };

        let (total, successful, cost, input, output, avg_dur): (i64, i64, f64, i64, i64, f64) = {
            let mut stmt = conn.prepare(exec_query)?;
            if let Some(p) = param {
                stmt.query_row([p], |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                    ))
                })?
            } else {
                stmt.query_row([], |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                    ))
                })?
            }
        };

        let (positive, negative): (i64, i64) = {
            let mut stmt = conn.prepare(fb_query)?;
            if let Some(p) = param {
                stmt.query_row([p], |row| Ok((row.get(0)?, row.get(1)?)))?
            } else {
                stmt.query_row([], |row| Ok((row.get(0)?, row.get(1)?)))?
            }
        };

        Ok(Stats {
            total_requests: total,
            successful_requests: successful,
            total_cost_usd: cost,
            total_input_tokens: input,
            total_output_tokens: output,
            avg_duration_ms: avg_dur,
            positive_feedback: positive,
            negative_feedback: negative,
        })
    }

    pub fn get_recent_executions(&self, limit: i64) -> Result<Vec<RecentExecution>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT e.id, e.project, e.agent, e.requester, substr(e.user_message, 1, 100),
                    CASE WHEN e.response != '' THEN 'completed' ELSE 'error' END,
                    e.cost_usd, e.duration_ms, e.created_at,
                    COALESCE(SUM(CASE WHEN r.reaction IN ('thumbsup', '+1') AND r.user_id = e.requester THEN 1 ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN r.reaction IN ('thumbsdown', '-1') AND r.user_id = e.requester THEN 1 ELSE 0 END), 0)
             FROM executions e
             LEFT JOIN reactions r ON e.id = r.execution_id AND r.category = 'feedback'
             GROUP BY e.id ORDER BY e.created_at DESC LIMIT ?1",
        )?;

        let results = stmt
            .query_map([limit], |row| {
                let pos: i64 = row.get(9)?;
                let neg: i64 = row.get(10)?;
                Ok(RecentExecution {
                    id: row.get(0)?,
                    project: row.get(1)?,
                    agent: row.get(2)?,
                    requester: row.get(3)?,
                    user_message_preview: row.get(4)?,
                    status: row.get(5)?,
                    cost_usd: row.get(6)?,
                    duration_ms: row.get(7)?,
                    feedback: calculate_feedback(pos, neg),
                    created_at: row.get(8)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(results)
    }

    pub fn get_executions(
        &self,
        filter: &ExecutionFilter,
        page: i64,
        limit: i64,
    ) -> Result<ExecutionListResponse> {
        let conn = self.conn()?;
        let offset = (page - 1) * limit;

        let mut conditions = Vec::new();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        let mut having_clause = String::new();

        macro_rules! add_filter {
            ($field:expr, $value:expr) => {
                if let Some(ref v) = $value {
                    conditions.push(format!("{} = ?{}", $field, params.len() + 1));
                    params.push(Box::new(v.clone()));
                }
            };
        }

        add_filter!("e.project", filter.project);
        add_filter!("e.source", filter.source);
        add_filter!("e.model", filter.model);
        add_filter!("e.agent", filter.agent);
        add_filter!("e.requester", filter.requester);

        if let Some(ref ch) = filter.channel {
            conditions.push(format!("e.metadata LIKE ?{}", params.len() + 1));
            params.push(Box::new(format!("%\"channel\":\"{}%", ch)));
        }

        if let Some(from) = filter.from {
            conditions.push(format!("e.created_at >= ?{}", params.len() + 1));
            params.push(Box::new(from));
        }

        if let Some(to) = filter.to {
            conditions.push(format!("e.created_at <= ?{}", params.len() + 1));
            params.push(Box::new(to));
        }

        if let Some(ref search) = filter.search {
            conditions.push(format!(
                "(e.user_message LIKE ?{} OR e.instruction LIKE ?{} OR e.response LIKE ?{})",
                params.len() + 1,
                params.len() + 2,
                params.len() + 3
            ));
            let pattern = format!("%{}%", search);
            params.push(Box::new(pattern.clone()));
            params.push(Box::new(pattern.clone()));
            params.push(Box::new(pattern));
        }

        if filter.failed_only == Some(true) {
            conditions.push("e.response = ''".to_string());
        }

        if let Some(fb) = filter.feedback {
            having_clause = if fb == 0 {
                "HAVING pos = 0 AND neg = 0".to_string()
            } else if fb == 1 {
                "HAVING pos > neg".to_string()
            } else {
                "HAVING neg > pos".to_string()
            };
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let count_sql = format!(
            "SELECT COUNT(*) FROM (
                SELECT e.id, SUM(CASE WHEN r.reaction IN ('thumbsup', '+1') AND r.user_id = e.requester THEN 1 ELSE 0 END) as pos,
                       SUM(CASE WHEN r.reaction IN ('thumbsdown', '-1') AND r.user_id = e.requester THEN 1 ELSE 0 END) as neg
                FROM executions e LEFT JOIN reactions r ON e.id = r.execution_id AND r.category = 'feedback'
                {} GROUP BY e.id {}
            )", where_clause, having_clause
        );

        let total: i64 = {
            let mut stmt = conn.prepare(&count_sql)?;
            let params_ref: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
            stmt.query_row(params_ref.as_slice(), |row| row.get(0))?
        };

        let query_sql = format!(
            "SELECT e.id, e.project, e.agent, e.source, e.requester, substr(e.user_message, 1, 150), substr(e.instruction, 1, 100),
                    substr(e.response, 1, 200), e.model, e.cost_usd, e.duration_ms, e.metadata, e.created_at,
                    COALESCE(SUM(CASE WHEN r.reaction IN ('thumbsup', '+1') AND r.user_id = e.requester THEN 1 ELSE 0 END), 0) as pos,
                    COALESCE(SUM(CASE WHEN r.reaction IN ('thumbsdown', '-1') AND r.user_id = e.requester THEN 1 ELSE 0 END), 0) as neg
             FROM executions e LEFT JOIN reactions r ON e.id = r.execution_id AND r.category = 'feedback'
             {} GROUP BY e.id {} ORDER BY e.created_at DESC LIMIT ?{} OFFSET ?{}",
            where_clause, having_clause, params.len() + 1, params.len() + 2
        );

        params.push(Box::new(limit));
        params.push(Box::new(offset));

        let mut stmt = conn.prepare(&query_sql)?;
        let params_ref: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

        let executions = stmt
            .query_map(params_ref.as_slice(), |row| {
                let metadata: Option<String> = row.get(11)?;
                let channel = metadata.as_ref().and_then(|m| {
                    serde_json::from_str::<serde_json::Value>(m)
                        .ok()
                        .and_then(|v| v.get("channel").and_then(|c| c.as_str()).map(String::from))
                });
                let pos: i64 = row.get(13)?;
                let neg: i64 = row.get(14)?;

                Ok(ExecutionListItem {
                    id: row.get(0)?,
                    project: row.get(1)?,
                    agent: row.get(2)?,
                    source: row.get(3)?,
                    requester: row.get(4)?,
                    user_message_preview: row.get(5)?,
                    instruction_preview: row.get(6)?,
                    response_preview: row.get(7)?,
                    model: row.get(8)?,
                    cost_usd: row.get(9)?,
                    duration_ms: row.get(10)?,
                    feedback: calculate_feedback(pos, neg),
                    channel,
                    created_at: row.get(12)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        let total_pages = (total + limit - 1) / limit;

        Ok(ExecutionListResponse {
            executions,
            total,
            page,
            limit,
            total_pages,
        })
    }

    pub fn get_execution_by_id(&self, id: &str) -> Result<Option<ExecutionDetail>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT e.id, e.project, e.agent, e.source, e.requester, e.session_id, e.instruction,
                    e.user_message, e.user_context, e.response, e.structured_output, e.model,
                    e.cost_usd, e.input_tokens, e.output_tokens, e.cache_read_tokens,
                    e.cache_creation_tokens, e.duration_ms, e.duration_api_ms, e.metadata, e.created_at,
                    COALESCE(SUM(CASE WHEN r.reaction IN ('thumbsup', '+1') AND r.user_id = e.requester THEN 1 ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN r.reaction IN ('thumbsdown', '-1') AND r.user_id = e.requester THEN 1 ELSE 0 END), 0)
             FROM executions e LEFT JOIN reactions r ON e.id = r.execution_id AND r.category = 'feedback'
             WHERE e.id = ?1 GROUP BY e.id"
        )?;

        let result = stmt
            .query_row([id], |row| {
                let pos: i64 = row.get(21)?;
                let neg: i64 = row.get(22)?;
                Ok(ExecutionDetail {
                    id: row.get(0)?,
                    project: row.get(1)?,
                    agent: row.get(2)?,
                    source: row.get(3)?,
                    requester: row.get(4)?,
                    session_id: row.get(5)?,
                    instruction: row.get(6)?,
                    user_message: row.get(7)?,
                    user_context: row.get(8)?,
                    response: row.get(9)?,
                    structured_output: row.get(10)?,
                    model: row.get(11)?,
                    cost_usd: row.get(12)?,
                    input_tokens: row.get(13)?,
                    output_tokens: row.get(14)?,
                    cache_read_tokens: row.get(15)?,
                    cache_creation_tokens: row.get(16)?,
                    duration_ms: row.get(17)?,
                    duration_api_ms: row.get(18)?,
                    feedback: calculate_feedback(pos, neg),
                    metadata: row.get(19)?,
                    created_at: row.get(20)?,
                })
            })
            .ok();

        Ok(result)
    }

    pub fn get_filter_options(&self) -> Result<FilterOptions> {
        let conn = self.conn()?;

        macro_rules! get_distinct {
            ($query:expr) => {{
                let mut stmt = conn.prepare($query)?;
                stmt.query_map([], |row| row.get(0))?
                    .filter_map(|r| r.ok())
                    .collect()
            }};
        }

        Ok(FilterOptions {
            projects: get_distinct!("SELECT DISTINCT project FROM executions WHERE project IS NOT NULL ORDER BY project"),
            sources: get_distinct!("SELECT DISTINCT source FROM executions WHERE source IS NOT NULL AND source != '' ORDER BY source"),
            models: get_distinct!("SELECT DISTINCT model FROM executions WHERE model IS NOT NULL ORDER BY model"),
            agents: get_distinct!("SELECT DISTINCT agent FROM executions WHERE agent IS NOT NULL ORDER BY agent"),
            requesters: get_distinct!("SELECT DISTINCT requester FROM executions WHERE requester IS NOT NULL ORDER BY requester"),
            channels: get_distinct!(
                "SELECT DISTINCT json_extract(metadata, '$.channel') as ch
                 FROM executions WHERE metadata IS NOT NULL AND json_extract(metadata, '$.channel') IS NOT NULL
                 ORDER BY ch"
            ),
        })
    }
}
