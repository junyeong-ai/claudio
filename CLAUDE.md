# Claudio - AI Agent Developer Guide

Slack → n8n → Claude Code orchestration. SQLite storage, multi-agent routing.

---

## Architecture

```
Slack ──Socket Mode──► claudio-api ──webhook──► n8n ──HTTP──► claudio-api/chat
       (app_mention)    (SlackBridge)           (workflows)   (ClaudeExecutor)
                              │                                      │
                              └─────────── SQLite ◄──────────────────┘
                                    (executions, agents, projects)
```

**Flow**: SlackBridge receives event → forwards to n8n webhook → n8n calls `/classify` → selects agent → calls `/chat` → ClaudeExecutor runs Claude Code subprocess → response to Slack thread

---

## Project Structure

```
claudio-api/src/
├── main.rs                 # Axum server, route mounting
├── config.rs               # .env loader (dotenvy)
├── api/
│   ├── routes.rs           # Router definition
│   ├── handlers/           # projects, agents, executions, users, stats
│   ├── classify.rs         # Agent routing: keyword → semantic → LLM
│   ├── rate_limit.rs       # Per-project RPM limiting
│   └── types.rs            # Request/Response structs
├── claude/
│   └── executor.rs         # Claude Code subprocess (--print, --output-format json)
├── plugins/
│   ├── slack/bridge.rs     # Socket Mode → n8n webhook forwarding
│   └── semantic/mod.rs     # ssearch client for agent routing
├── storage/
│   ├── core.rs             # r2d2 SQLite pool, migrations
│   ├── types.rs            # DB models
│   ├── projects.rs, executions.rs, feedback.rs, users.rs
└── utils/
    └── mrkdwn.rs           # Slack mrkdwn → plain text

dashboard/src/
├── app/                    # Next.js 15 app router
│   ├── page.tsx            # Home (stats overview)
│   ├── history/, agents/, feedback/, analytics/, users/
│   └── api/plugins/        # Proxy routes (slack, semantic)
├── components/
│   ├── dashboard/          # KPI cards, charts, modals
│   ├── agents/             # Agent editor, test console
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── api.ts              # Fetch wrapper
│   ├── content.tsx         # Content renderer (json/markdown/mrkdwn/plain)
│   └── mrkdwn.tsx          # Slack mrkdwn parser
└── plugins/                # Plugin pages (slack, semantic)

n8n-workflows/              # JSON workflow definitions
scripts/                    # Service management
```

---

## Scripts

```bash
./scripts/api-server.sh start|stop|restart|rebuild|status|logs [n]
./scripts/dashboard.sh start|stop|dev|rebuild|status|logs [n]
./scripts/n8n-workflows.sh init|config|credentials|list|pull|push|compare|inject
./scripts/sync-agents.sh [project_id]
```

---

## API Endpoints

```
# Projects
GET    /v1/projects
POST   /v1/projects
GET    /v1/projects/{id}
PUT    /v1/projects/{id}
DELETE /v1/projects/{id}
POST   /v1/projects/{project_id}/classify
POST   /v1/projects/{project_id}/chat

# Agents
GET    /v1/projects/{project_id}/agents
POST   /v1/projects/{project_id}/agents
GET    /v1/agents/{id}
PUT    /v1/agents/{id}
DELETE /v1/agents/{id}

# Executions
GET    /v1/executions
GET    /v1/executions/filters
GET    /v1/executions/lookup
GET    /v1/executions/recent
GET    /v1/executions/{id}
PATCH  /v1/executions/{id}
GET    /v1/executions/{id}/reactions
POST   /v1/executions/{id}/reactions
DELETE /v1/executions/{id}/reactions

# Stats
GET    /v1/stats
GET    /v1/stats/{project}
GET    /v1/stats/overview|timeseries|models|errors|sources|requesters

# Users
GET    /v1/users
GET    /v1/users/{user_id}/context
PUT    /v1/users/{user_id}/context
GET    /v1/users/{user_id}/rules
POST   /v1/users/{user_id}/rules
DELETE /v1/users/{user_id}/rules
DELETE /v1/users/{user_id}/context/lock

# Misc
GET    /v1/classify/stats|logs
GET    /v1/workflows/stats
POST   /v1/workflows/stats
POST   /v1/format/mrkdwn
GET    /health
GET    /v1/config
```

---

## Data Models

### Project
```rust
id, name, working_dir, system_prompt?,
allowed_tools?, disallowed_tools?,    // JSON arrays
is_default, fallback_agent, classify_model, classify_timeout,
rate_limit_rpm, created_at, updated_at
```

### Agent
```rust
id, project_id, name, description, model,
priority,         // Higher = checked first
keywords,         // JSON array, exact match
examples,         // JSON array, for semantic/LLM
instruction?,     // System prompt
tools?,           // JSON array, override project tools
timeout,          // Seconds (default 300)
isolated,         // Run in isolated dir
static_response,  // Return instruction as-is
created_at, updated_at
```

### Execution
```rust
id, project, source?, requester?, agent?, instruction?,
user_message, user_context?, response, model?,
cost_usd?, input_tokens?, output_tokens?,
cache_read_tokens?, cache_creation_tokens?,
duration_ms?, duration_api_ms?, session_id?, metadata?,
created_at
// feedback: via reactions table (1=positive, -1=negative)
```

---

## Classification Priority

```
1. Keyword match     → agent.keywords contains word
2. Semantic search   → ssearch similarity > threshold
3. LLM fallback      → Claude selects from descriptions
```

---

## n8n Workflows

| Workflow | Trigger | Function |
|----------|---------|----------|
| slack-mention-handler | Webhook | @mention → classify → chat → reply |
| slack-message-handler | Webhook | Incident channel → auto-analysis |
| slack-reaction-handler | Webhook | Reaction → Jira/fix actions |
| slack-feedback-handler | Webhook | Feedback collection |
| user-context-handler | Webhook | User context CRUD |
| gitlab-mr-review | Schedule (1min) | Auto MR code review |

### Workflow Placeholders

Config via `.n8n-config.json` (gitignored):

| Placeholder | Config Key |
|-------------|------------|
| `__SLACK_CREDENTIAL_ID/NAME__` | credentials.slackApi.id/name |
| `__GITLAB_CREDENTIAL_ID/NAME__` | credentials.httpHeaderAuth.id/name |
| `__JIRA_CREDENTIAL_ID/NAME__` | credentials.jiraSoftwareCloudApi.id/name |
| `__CLAUDIO_PROJECT__` | project |
| `__GITLAB_HOST/PROJECT__` | gitlab.host/project |
| `__JIRA_HOST__` | jira.host |

n8n env vars: `N8N_API_URL`, `N8N_DASHBOARD_URL`, `N8N_WEBHOOK_URL`, `MR_REVIEW_CHANNEL`

---

## Key Defaults

| Location | Field | Default |
|----------|-------|---------|
| types.rs | model | "haiku" |
| types.rs | priority | 50 |
| types.rs | timeout | 300s |
| types.rs | classify_timeout | 30s |
| config.rs | rate_limit_rpm | 0 (unlimited) |

---

## Common Tasks

### Add New API Endpoint
1. `api/handlers/{module}.rs`: Add handler
2. `api/routes.rs`: Add route
3. `api/types.rs`: Add request/response structs

### Add New Agent Field
1. `storage/types.rs`: Add to Agent struct
2. `storage/core.rs`: Update migration
3. `api/handlers/agents.rs`: Update CRUD
4. `dashboard/src/components/agents/agent-editor.tsx`: Add form field

### Debug
```bash
RUST_LOG=debug ./scripts/api-server.sh start
sqlite3 ./data/claudio.db ".schema"
```
