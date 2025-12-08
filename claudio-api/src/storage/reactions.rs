use anyhow::Result;
use rusqlite::params;

use super::core::Storage;
use super::types::{ReactionCategory, ReactionResult, ReactionSummary, TriggerInfo};

impl Storage {
    pub fn upsert_reaction(
        &self,
        execution_id: &str,
        user_id: &str,
        reaction: &str,
    ) -> Result<ReactionResult> {
        let conn = self.conn()?;
        let category = ReactionCategory::from_reaction(reaction);
        let now = chrono::Utc::now().timestamp();

        match category {
            ReactionCategory::Feedback => {
                let existing: Option<String> = conn
                    .query_row(
                        "SELECT reaction FROM reactions WHERE execution_id = ?1 AND user_id = ?2 AND category = 'feedback'",
                        params![execution_id, user_id],
                        |row| row.get(0),
                    )
                    .ok();

                if existing.is_some() {
                    conn.execute(
                        "UPDATE reactions SET reaction = ?1, created_at = ?2 WHERE execution_id = ?3 AND user_id = ?4 AND category = 'feedback'",
                        params![reaction, now, execution_id, user_id],
                    )?;
                    Ok(ReactionResult::Updated)
                } else {
                    conn.execute(
                        "INSERT INTO reactions (execution_id, user_id, reaction, category, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                        params![execution_id, user_id, reaction, category.as_str(), now],
                    )?;
                    Ok(ReactionResult::Created)
                }
            }
            ReactionCategory::Trigger => {
                let exists: bool = conn
                    .query_row(
                        "SELECT 1 FROM reactions WHERE execution_id = ?1 AND reaction = ?2 AND category = 'trigger'",
                        params![execution_id, reaction],
                        |_| Ok(true),
                    )
                    .unwrap_or(false);

                if exists {
                    Ok(ReactionResult::AlreadyTriggered)
                } else {
                    conn.execute(
                        "INSERT INTO reactions (execution_id, user_id, reaction, category, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                        params![execution_id, user_id, reaction, category.as_str(), now],
                    )?;
                    Ok(ReactionResult::Created)
                }
            }
            ReactionCategory::Action => {
                conn.execute(
                    "INSERT INTO reactions (execution_id, user_id, reaction, category, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![execution_id, user_id, reaction, category.as_str(), now],
                )?;
                Ok(ReactionResult::Created)
            }
        }
    }

    pub fn delete_reaction(
        &self,
        execution_id: &str,
        user_id: &str,
        reaction: &str,
    ) -> Result<bool> {
        let conn = self.conn()?;
        let category = ReactionCategory::from_reaction(reaction);
        let deleted = conn.execute(
            "DELETE FROM reactions WHERE execution_id = ?1 AND user_id = ?2 AND reaction = ?3 AND category = ?4",
            params![execution_id, user_id, reaction, category.as_str()],
        )?;
        Ok(deleted > 0)
    }

    pub fn get_reaction_summary(&self, execution_id: &str) -> Result<ReactionSummary> {
        let conn = self.conn()?;

        let positive: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM reactions r
                 JOIN executions e ON r.execution_id = e.id
                 WHERE r.execution_id = ?1 AND r.category = 'feedback'
                 AND r.reaction IN ('thumbsup', '+1') AND r.user_id = e.requester",
                params![execution_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let negative: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM reactions r
                 JOIN executions e ON r.execution_id = e.id
                 WHERE r.execution_id = ?1 AND r.category = 'feedback'
                 AND r.reaction IN ('thumbsdown', '-1') AND r.user_id = e.requester",
                params![execution_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let mut stmt = conn.prepare(
            "SELECT reaction, user_id, created_at FROM reactions WHERE execution_id = ?1 AND category = 'trigger' ORDER BY created_at"
        )?;

        let triggers = stmt
            .query_map(params![execution_id], |row| {
                Ok(TriggerInfo {
                    reaction: row.get(0)?,
                    user_id: row.get(1)?,
                    created_at: row.get(2)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(ReactionSummary {
            positive,
            negative,
            triggers,
        })
    }

    pub fn get_feedback_stats(&self, execution_ids: Option<&[&str]>) -> Result<(i64, i64)> {
        let conn = self.conn()?;

        let (positive, negative) = if let Some(ids) = execution_ids {
            if ids.is_empty() {
                return Ok((0, 0));
            }
            let placeholders: String = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            let sql = format!(
                "SELECT
                    COALESCE(SUM(CASE WHEN r.reaction IN ('thumbsup', '+1') THEN 1 ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN r.reaction IN ('thumbsdown', '-1') THEN 1 ELSE 0 END), 0)
                FROM reactions r
                JOIN executions e ON r.execution_id = e.id
                WHERE r.category = 'feedback' AND r.user_id = e.requester AND r.execution_id IN ({})",
                placeholders
            );
            let mut stmt = conn.prepare(&sql)?;
            let params: Vec<&dyn rusqlite::ToSql> =
                ids.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
            stmt.query_row(params.as_slice(), |row| Ok((row.get(0)?, row.get(1)?)))?
        } else {
            conn.query_row(
                "SELECT
                    COALESCE(SUM(CASE WHEN r.reaction IN ('thumbsup', '+1') THEN 1 ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN r.reaction IN ('thumbsdown', '-1') THEN 1 ELSE 0 END), 0)
                FROM reactions r
                JOIN executions e ON r.execution_id = e.id
                WHERE r.category = 'feedback' AND r.user_id = e.requester",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )?
        };

        Ok((positive, negative))
    }
}
