use anyhow::Result;
use r2d2::{Pool, PooledConnection};
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;
use std::path::Path;

pub type DbPool = Pool<SqliteConnectionManager>;

#[derive(Clone)]
pub struct Storage {
    pub(crate) pool: DbPool,
}

impl Storage {
    pub(crate) fn conn(&self) -> Result<PooledConnection<SqliteConnectionManager>> {
        self.pool
            .get()
            .map_err(|e| anyhow::anyhow!("Failed to get DB connection: {}", e))
    }

    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path = path.as_ref();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let manager = SqliteConnectionManager::file(path);
        let pool = Pool::builder().max_size(10).build(manager)?;

        {
            let conn = pool.get()?;
            conn.execute_batch(
                "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;",
            )?;
        }

        let conn = pool.get()?;
        Self::init_schema(&conn)?;

        Ok(Self { pool })
    }

    fn init_schema(conn: &Connection) -> Result<()> {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS executions (
                id TEXT PRIMARY KEY,
                project TEXT NOT NULL,
                source TEXT,
                requester TEXT,
                agent TEXT,
                instruction TEXT,
                user_message TEXT NOT NULL,
                user_context TEXT,
                response TEXT NOT NULL,
                structured_output TEXT,
                model TEXT,
                cost_usd REAL,
                input_tokens INTEGER,
                output_tokens INTEGER,
                cache_read_tokens INTEGER,
                cache_creation_tokens INTEGER,
                duration_ms INTEGER,
                duration_api_ms INTEGER,
                session_id TEXT,
                metadata TEXT,
                created_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_executions_project ON executions(project);
            CREATE INDEX IF NOT EXISTS idx_executions_source ON executions(source);
            CREATE INDEX IF NOT EXISTS idx_executions_requester ON executions(requester);
            CREATE INDEX IF NOT EXISTS idx_executions_created ON executions(created_at);
            CREATE INDEX IF NOT EXISTS idx_executions_model ON executions(model);
            CREATE INDEX IF NOT EXISTS idx_executions_project_created ON executions(project, created_at);
            CREATE INDEX IF NOT EXISTS idx_executions_source_created ON executions(source, created_at);
            CREATE INDEX IF NOT EXISTS idx_executions_agent ON executions(agent);

            CREATE TABLE IF NOT EXISTS reactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                execution_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                reaction TEXT NOT NULL,
                category TEXT NOT NULL CHECK(category IN ('feedback', 'trigger', 'action')),
                created_at INTEGER NOT NULL,
                FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_reactions_execution ON reactions(execution_id);
            CREATE INDEX IF NOT EXISTS idx_reactions_category ON reactions(category);
            CREATE INDEX IF NOT EXISTS idx_reactions_created ON reactions(created_at);

            CREATE TABLE IF NOT EXISTS classification_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                agent TEXT NOT NULL,
                model TEXT,
                confidence REAL NOT NULL,
                method TEXT NOT NULL,
                matched_keyword TEXT,
                reasoning TEXT,
                duration_ms INTEGER NOT NULL,
                project TEXT,
                source TEXT,
                requester TEXT,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            );

            CREATE INDEX IF NOT EXISTS idx_classification_agent ON classification_logs(agent, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_classification_method ON classification_logs(method, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_classification_created ON classification_logs(created_at DESC);

            CREATE TABLE IF NOT EXISTS workflow_executions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workflow_name TEXT NOT NULL,
                execution_id TEXT,
                status TEXT NOT NULL CHECK(status IN ('success', 'error', 'timeout')),
                duration_ms INTEGER,
                metadata TEXT,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            );

            CREATE INDEX IF NOT EXISTS idx_workflow_name ON workflow_executions(workflow_name, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_workflow_created ON workflow_executions(created_at DESC);

            CREATE TABLE IF NOT EXISTS user_contexts (
                user_id TEXT PRIMARY KEY,
                summary TEXT,
                last_summarized_at INTEGER,
                summary_locked_at INTEGER,
                summary_lock_id TEXT
            );

            CREATE TABLE IF NOT EXISTS user_rules (
                user_id TEXT NOT NULL,
                rule TEXT NOT NULL,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                PRIMARY KEY (user_id, rule)
            );

            CREATE INDEX IF NOT EXISTS idx_user_rules_user ON user_rules(user_id);

            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                system_prompt TEXT,
                allowed_tools TEXT,
                disallowed_tools TEXT,
                is_default INTEGER NOT NULL DEFAULT 0,
                enable_user_context INTEGER NOT NULL DEFAULT 1,
                fallback_agent TEXT NOT NULL DEFAULT 'general',
                classify_model TEXT NOT NULL DEFAULT 'haiku',
                classify_timeout INTEGER NOT NULL DEFAULT 30,
                rate_limit_rpm INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            );

            CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                model TEXT NOT NULL DEFAULT 'haiku',
                priority INTEGER NOT NULL DEFAULT 50,
                keywords TEXT NOT NULL DEFAULT '[]',
                examples TEXT NOT NULL DEFAULT '[]',
                instruction TEXT,
                tools TEXT,
                output_schema TEXT,
                timeout INTEGER NOT NULL DEFAULT 300,
                static_response INTEGER NOT NULL DEFAULT 0,
                working_dir TEXT,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                UNIQUE(project_id, name)
            );

            CREATE INDEX IF NOT EXISTS idx_agents_project ON agents(project_id);
            CREATE INDEX IF NOT EXISTS idx_agents_priority ON agents(project_id, priority DESC);
            ",
        )?;
        Ok(())
    }

    pub fn with_connection<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&Connection) -> Result<T>,
    {
        let conn = self.conn()?;
        f(&conn)
    }
}

pub fn slugify(name: &str) -> String {
    name.to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join("-")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-')
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}
