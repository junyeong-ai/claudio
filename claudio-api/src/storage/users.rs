use anyhow::Result;
use rusqlite::params;

use super::core::Storage;
use super::types::{ConversationItem, UserContext, UserListItem};

const CONTEXT_CHAR_THRESHOLD: i64 = 8000;
const CONTEXT_COUNT_THRESHOLD: usize = 5;
const MIN_SUMMARY_INTERVAL_SECS: i64 = 300;
const MIN_CONVERSATIONS_FOR_SUMMARY: usize = 3;
const SUMMARY_LOCK_TTL_SECS: i64 = 300;

impl Storage {
    pub fn get_user_rules(&self, user_id: &str) -> Result<Vec<String>> {
        let conn = self.conn()?;
        let mut stmt =
            conn.prepare("SELECT rule FROM user_rules WHERE user_id = ?1 ORDER BY created_at")?;
        let rules = stmt
            .query_map([user_id], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(rules)
    }

    pub fn add_user_rule(&self, user_id: &str, rule: &str) -> Result<bool> {
        let conn = self.conn()?;
        let inserted = conn.execute(
            "INSERT OR IGNORE INTO user_rules (user_id, rule) VALUES (?1, ?2)",
            params![user_id, rule],
        )?;
        Ok(inserted > 0)
    }

    pub fn delete_user_rule(&self, user_id: &str, rule: &str) -> Result<bool> {
        let conn = self.conn()?;
        let deleted = conn.execute(
            "DELETE FROM user_rules WHERE user_id = ?1 AND rule = ?2",
            params![user_id, rule],
        )?;
        Ok(deleted > 0)
    }

    pub fn sync_user_rules(&self, user_id: &str, rules: &[String]) -> Result<()> {
        let conn = self.conn()?;
        conn.execute(
            "DELETE FROM user_rules WHERE user_id = ?1",
            params![user_id],
        )?;
        let now = chrono::Utc::now().timestamp();
        for rule in rules {
            conn.execute(
                "INSERT INTO user_rules (user_id, rule, created_at) VALUES (?1, ?2, ?3)",
                params![user_id, rule, now],
            )?;
        }
        Ok(())
    }

    pub fn get_user_context(&self, user_id: &str) -> Result<UserContext> {
        let conn = self.conn()?;
        let now = chrono::Utc::now().timestamp();

        let rules: Vec<String> = {
            let mut stmt =
                conn.prepare("SELECT rule FROM user_rules WHERE user_id = ?1 ORDER BY created_at")?;
            stmt.query_map([user_id], |row| row.get(0))?
                .filter_map(|r| r.ok())
                .collect()
        };

        let (summary, last_summarized_at, locked_at, lock_id) = conn
            .query_row(
                "SELECT summary, last_summarized_at, summary_locked_at, summary_lock_id
                 FROM user_contexts WHERE user_id = ?1",
                [user_id],
                |row| {
                    Ok((
                        row.get::<_, Option<String>>(0)?,
                        row.get::<_, Option<i64>>(1)?,
                        row.get::<_, Option<i64>>(2)?,
                        row.get::<_, Option<String>>(3)?,
                    ))
                },
            )
            .unwrap_or_default();

        let recent_conversations: Vec<ConversationItem> = {
            let mut stmt = conn.prepare(
                "SELECT e.id, e.user_message, e.response, e.created_at,
                        EXISTS(SELECT 1 FROM reactions r
                               WHERE r.execution_id = e.id
                               AND r.category = 'feedback'
                               AND r.user_id = e.requester
                               AND r.reaction IN ('thumbsdown', '-1')) as has_neg
                 FROM executions e
                 WHERE e.requester = ?1
                 AND (?2 IS NULL OR e.created_at > ?2)
                 ORDER BY e.created_at DESC",
            )?;

            stmt.query_map(params![user_id, last_summarized_at], |row| {
                let has_neg: bool = row.get::<_, i64>(4)? == 1;
                let response: String = row.get(2)?;
                Ok(ConversationItem {
                    id: row.get(0)?,
                    user_message: row.get(1)?,
                    response: if has_neg { Some(response) } else { None },
                    created_at: row.get(3)?,
                    has_negative_feedback: has_neg,
                })
            })?
            .filter_map(|r| r.ok())
            .collect()
        };

        let conversation_count = recent_conversations.len();
        let conversation_chars: i64 = recent_conversations
            .iter()
            .map(|c| c.user_message.len() as i64)
            .sum();
        let summary_chars = summary.as_ref().map(|s| s.len() as i64).unwrap_or(0);
        let total_context_chars = summary_chars + conversation_chars;

        let time_since_last = last_summarized_at.map(|t| now - t).unwrap_or(i64::MAX);
        let is_locked = locked_at.is_some_and(|t| now - t < SUMMARY_LOCK_TTL_SECS);

        let threshold_exceeded = total_context_chars > CONTEXT_CHAR_THRESHOLD
            || conversation_count >= CONTEXT_COUNT_THRESHOLD;
        let needs_summary = threshold_exceeded
            && time_since_last > MIN_SUMMARY_INTERVAL_SECS
            && conversation_count >= MIN_CONVERSATIONS_FOR_SUMMARY
            && !is_locked;

        Ok(UserContext {
            user_id: user_id.to_string(),
            rules,
            summary,
            last_summarized_at,
            recent_conversations,
            conversation_count,
            context_bytes: total_context_chars,
            needs_summary,
            summary_locked: is_locked,
            lock_id: if is_locked { lock_id } else { None },
        })
    }

    pub fn save_user_context(&self, user_id: &str, summary: &str, rules: &[String]) -> Result<()> {
        let conn = self.conn()?;
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "INSERT INTO user_contexts (user_id, summary, last_summarized_at, summary_locked_at, summary_lock_id)
             VALUES (?1, ?2, ?3, NULL, NULL)
             ON CONFLICT(user_id) DO UPDATE SET
                summary = excluded.summary,
                last_summarized_at = excluded.last_summarized_at,
                summary_locked_at = NULL,
                summary_lock_id = NULL",
            params![user_id, summary, now],
        )?;

        conn.execute(
            "DELETE FROM user_rules WHERE user_id = ?1",
            params![user_id],
        )?;
        for rule in rules {
            conn.execute(
                "INSERT INTO user_rules (user_id, rule, created_at) VALUES (?1, ?2, ?3)",
                params![user_id, rule, now],
            )?;
        }

        Ok(())
    }

    pub fn acquire_summary_lock(&self, user_id: &str, lock_id: &str) -> Result<bool> {
        let conn = self.conn()?;
        let now = chrono::Utc::now().timestamp();
        let stale_threshold = now - SUMMARY_LOCK_TTL_SECS;

        let updated = conn.execute(
            "INSERT INTO user_contexts (user_id, summary_locked_at, summary_lock_id)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(user_id) DO UPDATE SET
                summary_locked_at = ?2,
                summary_lock_id = ?3
             WHERE summary_locked_at IS NULL OR summary_locked_at < ?4",
            params![user_id, now, lock_id, stale_threshold],
        )?;

        Ok(updated > 0)
    }

    pub fn release_summary_lock(&self, user_id: &str, lock_id: &str) -> Result<bool> {
        let conn = self.conn()?;
        let updated = conn.execute(
            "UPDATE user_contexts SET summary_locked_at = NULL, summary_lock_id = NULL
             WHERE user_id = ?1 AND summary_lock_id = ?2",
            params![user_id, lock_id],
        )?;
        Ok(updated > 0)
    }

    pub fn list_users_with_context(&self) -> Result<Vec<UserListItem>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "WITH all_users AS (
                SELECT DISTINCT requester as user_id FROM executions WHERE requester IS NOT NULL
                UNION
                SELECT user_id FROM user_rules
                UNION
                SELECT user_id FROM user_contexts
            ),
            user_sources AS (
                SELECT requester, source, COUNT(*) as cnt,
                       ROW_NUMBER() OVER (PARTITION BY requester ORDER BY COUNT(*) DESC) as rn
                FROM executions
                WHERE requester IS NOT NULL AND source IS NOT NULL
                GROUP BY requester, source
            )
            SELECT
                u.user_id,
                COALESCE(r.rule_count, 0),
                CASE WHEN c.summary IS NOT NULL THEN 1 ELSE 0 END,
                e.last_activity,
                COALESCE(e.request_count, 0),
                COALESCE(e.total_cost_usd, 0.0),
                s.source
            FROM all_users u
            LEFT JOIN (SELECT user_id, COUNT(*) as rule_count FROM user_rules GROUP BY user_id) r
                ON u.user_id = r.user_id
            LEFT JOIN user_contexts c ON u.user_id = c.user_id
            LEFT JOIN (
                SELECT requester, MAX(created_at) as last_activity,
                       COUNT(*) as request_count, COALESCE(SUM(cost_usd), 0) as total_cost_usd
                FROM executions WHERE requester IS NOT NULL GROUP BY requester
            ) e ON u.user_id = e.requester
            LEFT JOIN user_sources s ON u.user_id = s.requester AND s.rn = 1
            ORDER BY e.last_activity DESC NULLS LAST",
        )?;

        let users = stmt
            .query_map([], |row| {
                Ok(UserListItem {
                    user_id: row.get(0)?,
                    rule_count: row.get(1)?,
                    has_summary: row.get::<_, i64>(2)? == 1,
                    last_activity: row.get(3)?,
                    request_count: row.get(4)?,
                    total_cost_usd: row.get(5)?,
                    primary_source: row.get(6)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(users)
    }
}
