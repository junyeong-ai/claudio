use anyhow::Result;
use rusqlite::params;

use super::core::{Storage, slugify};
use super::types::{Agent, CreateAgent, CreateProject, Project, UpdateAgent, UpdateProject};

fn map_project_row(row: &rusqlite::Row) -> rusqlite::Result<Project> {
    let allowed: Option<String> = row.get(4)?;
    let disallowed: Option<String> = row.get(5)?;
    Ok(Project {
        id: row.get(0)?,
        name: row.get(1)?,
        working_dir: row.get(2)?,
        system_prompt: row.get(3)?,
        allowed_tools: allowed.and_then(|s| serde_json::from_str(&s).ok()),
        disallowed_tools: disallowed.and_then(|s| serde_json::from_str(&s).ok()),
        is_default: row.get::<_, i32>(6)? == 1,
        fallback_agent: row.get(7)?,
        classify_model: row.get(8)?,
        classify_timeout: row.get(9)?,
        rate_limit_rpm: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

fn map_agent_row(row: &rusqlite::Row) -> rusqlite::Result<Agent> {
    let keywords: String = row.get(6)?;
    let examples: String = row.get(7)?;
    let tools: Option<String> = row.get(9)?;
    Ok(Agent {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        description: row.get(3)?,
        model: row.get(4)?,
        priority: row.get(5)?,
        keywords: serde_json::from_str(&keywords).unwrap_or_default(),
        examples: serde_json::from_str(&examples).unwrap_or_default(),
        instruction: row.get(8)?,
        tools: tools.and_then(|s| serde_json::from_str(&s).ok()),
        timeout: row.get(10)?,
        static_response: row.get::<_, i32>(11)? == 1,
        isolated: row.get::<_, i32>(12)? == 1,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}

impl Storage {
    pub fn list_projects(&self) -> Result<Vec<Project>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, working_dir, system_prompt, allowed_tools, disallowed_tools, is_default,
                    fallback_agent, classify_model, classify_timeout, rate_limit_rpm, created_at, updated_at
             FROM projects ORDER BY is_default DESC, name",
        )?;
        let projects = stmt
            .query_map([], map_project_row)?
            .filter_map(|r| r.ok())
            .collect();
        Ok(projects)
    }

    pub fn get_project(&self, id: &str) -> Result<Option<Project>> {
        let conn = self.conn()?;
        let result = conn
            .query_row(
                "SELECT id, name, working_dir, system_prompt, allowed_tools, disallowed_tools, is_default,
                        fallback_agent, classify_model, classify_timeout, rate_limit_rpm, created_at, updated_at
                 FROM projects WHERE id = ?1",
                [id],
                map_project_row,
            )
            .ok();
        Ok(result)
    }

    pub fn get_default_project(&self) -> Result<Option<Project>> {
        let conn = self.conn()?;
        let result = conn
            .query_row(
                "SELECT id, name, working_dir, system_prompt, allowed_tools, disallowed_tools, is_default,
                        fallback_agent, classify_model, classify_timeout, rate_limit_rpm, created_at, updated_at
                 FROM projects WHERE is_default = 1 LIMIT 1",
                [],
                map_project_row,
            )
            .ok();
        Ok(result)
    }

    pub fn create_project(&self, input: CreateProject) -> Result<Project> {
        let conn = self.conn()?;
        let now = chrono::Utc::now().timestamp();

        let id = slugify(&input.name);
        if id.is_empty() {
            return Err(anyhow::anyhow!(
                "Project name must contain alphanumeric characters"
            ));
        }

        conn.execute("BEGIN IMMEDIATE", [])?;

        let result = (|| -> Result<Project> {
            let exists: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM projects WHERE id = ?1)",
                [&id],
                |row| row.get(0),
            )?;
            if exists {
                return Err(anyhow::anyhow!("Project with ID '{}' already exists", id));
            }

            if input.is_default {
                conn.execute(
                    "UPDATE projects SET is_default = 0 WHERE is_default = 1",
                    [],
                )?;
            }

            let allowed = input
                .allowed_tools
                .as_ref()
                .map(serde_json::to_string)
                .transpose()?;
            let disallowed = input
                .disallowed_tools
                .as_ref()
                .map(serde_json::to_string)
                .transpose()?;

            conn.execute(
                "INSERT INTO projects (id, name, working_dir, system_prompt, allowed_tools, disallowed_tools, is_default,
                                       fallback_agent, classify_model, classify_timeout, rate_limit_rpm, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                params![id, input.name, input.working_dir, input.system_prompt, allowed, disallowed,
                        input.is_default as i32, input.fallback_agent, input.classify_model, input.classify_timeout,
                        input.rate_limit_rpm, now, now],
            )?;

            Ok(Project {
                id,
                name: input.name,
                working_dir: input.working_dir,
                system_prompt: input.system_prompt,
                allowed_tools: input.allowed_tools,
                disallowed_tools: input.disallowed_tools,
                is_default: input.is_default,
                fallback_agent: input.fallback_agent,
                classify_model: input.classify_model,
                classify_timeout: input.classify_timeout,
                rate_limit_rpm: input.rate_limit_rpm,
                created_at: now,
                updated_at: now,
            })
        })();

        match result {
            Ok(project) => {
                conn.execute("COMMIT", [])?;
                Ok(project)
            }
            Err(e) => {
                if let Err(rollback_err) = conn.execute("ROLLBACK", []) {
                    tracing::error!(error = %rollback_err, "Failed to rollback transaction");
                }
                Err(e)
            }
        }
    }

    pub fn update_project(&self, id: &str, input: &UpdateProject) -> Result<Option<Project>> {
        let conn = self.conn()?;
        let now = chrono::Utc::now().timestamp();

        conn.execute("BEGIN IMMEDIATE", [])?;

        let result = (|| -> Result<()> {
            if input.is_default == Some(true) {
                conn.execute(
                    "UPDATE projects SET is_default = 0 WHERE is_default = 1 AND id != ?1",
                    [id],
                )?;
            }

            let mut updates = vec!["updated_at = ?1"];
            let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now)];

            macro_rules! add_field {
                ($field:expr, $value:expr) => {
                    if let Some(ref v) = $value {
                        updates.push($field);
                        params.push(Box::new(v.clone()));
                    }
                };
                ($field:expr, $value:expr, json) => {
                    if let Some(ref v) = $value {
                        updates.push($field);
                        params.push(Box::new(serde_json::to_string(v)?));
                    }
                };
                ($field:expr, $value:expr, bool) => {
                    if let Some(v) = $value {
                        updates.push($field);
                        params.push(Box::new(v as i32));
                    }
                };
            }

            add_field!("name = ?", input.name);
            add_field!("working_dir = ?", input.working_dir);
            add_field!("system_prompt = ?", input.system_prompt);
            add_field!("allowed_tools = ?", input.allowed_tools, json);
            add_field!("disallowed_tools = ?", input.disallowed_tools, json);
            add_field!("is_default = ?", input.is_default, bool);
            add_field!("fallback_agent = ?", input.fallback_agent);
            add_field!("classify_model = ?", input.classify_model);
            add_field!("classify_timeout = ?", input.classify_timeout);
            add_field!("rate_limit_rpm = ?", input.rate_limit_rpm);

            let placeholders: Vec<String> = updates
                .iter()
                .enumerate()
                .map(|(i, u)| {
                    if i == 0 {
                        u.to_string()
                    } else {
                        u.replace('?', &format!("?{}", i + 1))
                    }
                })
                .collect();

            params.push(Box::new(id.to_string()));
            let sql = format!(
                "UPDATE projects SET {} WHERE id = ?{}",
                placeholders.join(", "),
                params.len()
            );

            let params_ref: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
            conn.execute(&sql, params_ref.as_slice())?;
            Ok(())
        })();

        match result {
            Ok(()) => {
                conn.execute("COMMIT", [])?;
            }
            Err(e) => {
                if let Err(rollback_err) = conn.execute("ROLLBACK", []) {
                    tracing::error!(error = %rollback_err, "Failed to rollback transaction");
                }
                return Err(e);
            }
        }

        drop(conn);
        self.get_project(id)
    }

    pub fn delete_project(&self, id: &str) -> Result<bool> {
        let conn = self.conn()?;

        let is_default: bool = conn
            .query_row(
                "SELECT is_default FROM projects WHERE id = ?1",
                [id],
                |row| Ok(row.get::<_, i32>(0)? == 1),
            )
            .unwrap_or(false);

        if is_default {
            return Err(anyhow::anyhow!("Cannot delete the default project"));
        }

        let deleted = conn.execute("DELETE FROM projects WHERE id = ?1", [id])?;
        Ok(deleted > 0)
    }

    pub fn list_agents(&self, project_id: &str) -> Result<Vec<Agent>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, description, model, priority, keywords, examples, instruction, tools, timeout, static_response, isolated, created_at, updated_at
             FROM agents WHERE project_id = ?1 ORDER BY priority DESC, name",
        )?;
        let agents = stmt
            .query_map([project_id], map_agent_row)?
            .filter_map(|r| r.ok())
            .collect();
        Ok(agents)
    }

    pub fn get_agent(&self, id: &str) -> Result<Option<Agent>> {
        let conn = self.conn()?;
        let result = conn
            .query_row(
                "SELECT id, project_id, name, description, model, priority, keywords, examples, instruction, tools, timeout, static_response, isolated, created_at, updated_at
                 FROM agents WHERE id = ?1",
                [id],
                map_agent_row,
            )
            .ok();
        Ok(result)
    }

    pub fn get_agent_by_name(&self, project_id: &str, name: &str) -> Result<Option<Agent>> {
        let conn = self.conn()?;
        let result = conn
            .query_row(
                "SELECT id, project_id, name, description, model, priority, keywords, examples, instruction, tools, timeout, static_response, isolated, created_at, updated_at
                 FROM agents WHERE project_id = ?1 AND name = ?2",
                params![project_id, name],
                map_agent_row,
            )
            .ok();
        Ok(result)
    }

    pub fn create_agent(&self, project_id: &str, input: CreateAgent) -> Result<Agent> {
        let conn = self.conn()?;
        let now = chrono::Utc::now().timestamp();

        let name_slug = slugify(&input.name);
        if name_slug.is_empty() {
            return Err(anyhow::anyhow!(
                "Agent name must contain alphanumeric characters"
            ));
        }
        let id = format!("{}-{}", project_id, name_slug);

        let exists: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM agents WHERE id = ?1)",
            [&id],
            |row| row.get(0),
        )?;
        if exists {
            return Err(anyhow::anyhow!("Agent with ID '{}' already exists", id));
        }

        let keywords = serde_json::to_string(&input.keywords)?;
        let examples = serde_json::to_string(&input.examples)?;
        let tools = input
            .tools
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;

        conn.execute(
            "INSERT INTO agents (id, project_id, name, description, model, priority, keywords, examples, instruction, tools, timeout, static_response, isolated, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![id, project_id, input.name, input.description, input.model, input.priority, keywords, examples, input.instruction, tools, input.timeout, input.static_response as i32, input.isolated as i32, now, now],
        )?;

        Ok(Agent {
            id,
            project_id: project_id.to_string(),
            name: input.name,
            description: input.description,
            model: input.model,
            priority: input.priority,
            keywords: input.keywords,
            examples: input.examples,
            instruction: input.instruction,
            tools: input.tools,
            timeout: input.timeout,
            static_response: input.static_response,
            isolated: input.isolated,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn update_agent(&self, id: &str, input: &UpdateAgent) -> Result<Option<Agent>> {
        let conn = self.conn()?;
        let now = chrono::Utc::now().timestamp();

        let mut sets = vec!["updated_at = ?1".to_string()];
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now)];
        let mut idx = 2;

        macro_rules! add_field {
            ($field:expr, $value:expr) => {
                if let Some(ref v) = $value {
                    sets.push(format!("{} = ?{}", $field, idx));
                    params.push(Box::new(v.clone()));
                    idx += 1;
                }
            };
            ($field:expr, $value:expr, json) => {
                if let Some(ref v) = $value {
                    sets.push(format!("{} = ?{}", $field, idx));
                    params.push(Box::new(serde_json::to_string(v)?));
                    idx += 1;
                }
            };
            ($field:expr, $value:expr, bool) => {
                if let Some(v) = $value {
                    sets.push(format!("{} = ?{}", $field, idx));
                    params.push(Box::new(v as i32));
                    idx += 1;
                }
            };
        }

        add_field!("name", input.name);
        add_field!("description", input.description);
        add_field!("model", input.model);
        add_field!("priority", input.priority);
        add_field!("instruction", input.instruction);
        add_field!("timeout", input.timeout);
        add_field!("keywords", input.keywords, json);
        add_field!("examples", input.examples, json);
        add_field!("tools", input.tools, json);
        add_field!("static_response", input.static_response, bool);
        add_field!("isolated", input.isolated, bool);

        params.push(Box::new(id.to_string()));
        let sql = format!("UPDATE agents SET {} WHERE id = ?{}", sets.join(", "), idx);

        let params_ref: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        conn.execute(&sql, params_ref.as_slice())?;

        drop(conn);
        self.get_agent(id)
    }

    pub fn delete_agent(&self, id: &str) -> Result<bool> {
        let conn = self.conn()?;
        let deleted = conn.execute("DELETE FROM agents WHERE id = ?1", [id])?;
        Ok(deleted > 0)
    }
}
