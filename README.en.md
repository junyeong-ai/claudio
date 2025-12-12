# Claudio

[![Rust](https://img.shields.io/badge/rust-1.91.1%2B-orange?style=flat-square&logo=rust)](https://www.rust-lang.org)
[![Next.js](https://img.shields.io/badge/next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/react-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![n8n](https://img.shields.io/badge/n8n-workflows-ea4b71?style=flat-square&logo=n8n)](https://n8n.io)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

> **English** | **[한국어](README.md)**

**Run AI agents from Slack.** One mention triggers code review, incident analysis, Q&A — Claude Code handles it automatically.

---

## Why Claudio?

- **Instant Response** — Slack mention → Claude Code execution → thread reply
- **Multi-Agent** — Automatic routing via keywords/semantic matching
- **Full Control** — Manage agents, history, feedback from dashboard
- **Plugin Integration** — Extend AI capabilities with slack-cli, ssearch

---

## Quick Start

```bash
# 1. Clone & configure
git clone https://github.com/your-org/claudio && cd claudio
cp .env.example .env  # Set tokens

# 2. Start services
docker compose up -d                    # n8n
./scripts/api-server.sh start           # API
./scripts/dashboard.sh start            # Dashboard

# 3. Deploy workflows
./scripts/n8n-workflows.sh init

# 4. Test in Slack
@claudio hello!
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                            Slack Events                              │
│  @mention  │  message  │  reaction  │  :thumbsup:/:thumbsdown:      │
└─────┬──────┴─────┬─────┴─────┬──────┴──────────────┬────────────────┘
      │            │           │                      │
      ▼            ▼           ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       claudio-api (Socket Mode)                      │
│                              │                                       │
│    ┌─────────────────────────┼─────────────────────────┐            │
│    │                    Webhooks                        │            │
│    └─────────────────────────┼─────────────────────────┘            │
└──────────────────────────────┼──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         n8n Workflows                                │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   mention    │  │   message    │  │   reaction   │               │
│  │   handler    │  │   handler    │  │   handler    │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                 │                 │                        │
│         ▼                 ▼                 ▼                        │
│  ┌─────────────────────────────────────────────────────┐            │
│  │              claudio-api (/classify, /chat)          │            │
│  └─────────────────────────────────────────────────────┘            │
│                              │                                       │
│         ┌────────────────────┼────────────────────┐                 │
│         ▼                    ▼                    ▼                 │
│  ┌────────────┐       ┌────────────┐       ┌────────────┐          │
│  │ slack-cli  │       │  ssearch   │       │   glab     │          │
│  │  (plugin)  │       │ (semantic) │       │  (GitLab)  │          │
│  └────────────┘       └────────────┘       └────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### Slack Integration
```
@claudio review MR !123              → MR Reviewer agent
@claudio analyze this incident       → Incident Analyzer agent
@claudio explain this code           → Default agent
```

### Dashboard
- **History** — Execution logs, token usage, cost tracking
- **Agents** — Create/edit/test, keyword/semantic routing config
- **Feedback** — User reaction collection and analysis
- **Analytics** — Usage patterns, per-model statistics

---

## Workflows

### Slack Event Processing

| Workflow | Trigger | Function | Details |
|----------|---------|----------|---------|
| **slack-mention-handler** | @mention | AI response generation, agent routing | [→](docs/workflows/slack-mention-handler.md) |
| **slack-message-handler** | Message | Incident channel monitoring, auto-analysis | [→](docs/workflows/slack-message-handler.md) |
| **slack-reaction-handler** | Reaction | Jira creation, fix execution, option selection | [→](docs/workflows/slack-reaction-handler.md) |
| **slack-feedback-handler** | Feedback reaction | Response quality measurement, stats collection | [→](docs/workflows/slack-feedback-handler.md) |

### Internal Services

| Workflow | Trigger | Function | Details |
|----------|---------|----------|---------|
| **user-context-handler** | Webhook | User rules/context management | [→](docs/workflows/user-context-handler.md) |
| **gitlab-mr-review** | Schedule (1min) | Auto MR code review | [→](docs/workflows/gitlab-mr-review.md) |
| **auto-fix-scheduler** | Schedule (1min) | JIRA ai:auto-fix label → Auto fix | [→](docs/workflows/auto-fix-scheduler.md) |
| **daily-report** | Schedule (weekdays 10am) | Daily scrum report generation | [→](docs/workflows/daily-report.md) |

### Core Features

#### Feedback Loop
Continuously improve AI response quality through user reactions:
```
AI Response → :thumbsup:/:thumbsdown: reaction → Feedback collection → Dashboard analysis → Agent improvement
```

#### User Context
Deliver personalized AI responses:
```
User rules: "Reply in Korean"
Conversation summary: "Backend developer, Spring expert"
         ↓
    Personalized response
```

#### Action Triggers
| Reaction | Action |
|----------|--------|
| :jira: | Auto-create Jira ticket |
| :wrench: | Execute AI-suggested fix |
| :one: ~ :nine: | Multi-option selection |

---

## Plugin Integration

### slack-cli
Full Slack API control — user search, message sending, reaction management
```bash
slack-cli users "john"              # User search
slack-cli send "#general" "Hello"   # Send message
slack-cli react "#ch" 1234 thumbsup # Add reaction
```

### ssearch (Semantic Search)
Semantic-based automatic agent routing
```
User: "check this MR" → Embedding comparison → MR Reviewer selected
```

### glab (GitLab CLI)
MR viewing, comment writing, approval handling
```bash
glab mr view 123
glab mr diff 123
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Plugins Guide](docs/PLUGINS.md) | slack-cli, ssearch, glab integration |
| [Slack Mention Handler](docs/workflows/slack-mention-handler.md) | @mention processing workflow |
| [Slack Message Handler](docs/workflows/slack-message-handler.md) | Message monitoring workflow |
| [Slack Reaction Handler](docs/workflows/slack-reaction-handler.md) | Reaction processing workflow |
| [Slack Feedback Handler](docs/workflows/slack-feedback-handler.md) | Feedback collection workflow |
| [User Context Handler](docs/workflows/user-context-handler.md) | User context management |
| [GitLab MR Review](docs/workflows/gitlab-mr-review.md) | Auto MR review |
| [Auto Fix Scheduler](docs/workflows/auto-fix-scheduler.md) | JIRA auto fix |
| [Daily Reporter](docs/workflows/daily-report.md) | Daily scrum report |

---

## Installation

### Requirements
- Docker & Docker Compose
- Rust 1.75+
- Node.js 20+
- Slack App (Socket Mode)

### Environment Setup

Required `.env` values:

```bash
# Slack (create at api.slack.com/apps)
SLACK_APP_TOKEN=xapp-...          # Socket Mode token
SLACK_BOT_TOKEN=xoxb-...          # Bot OAuth token

# n8n
N8N_API_KEY=your-n8n-api-key

# Project
CLAUDIO_DEFAULT_PROJECT=default   # Default project ID
```

Full configuration: see `.env.example`

---

## Scripts

```bash
./scripts/api-server.sh start|stop|restart|status|logs
./scripts/dashboard.sh start|stop|dev|status|logs
./scripts/n8n-workflows.sh init|push|pull|compare
./scripts/sync-agents.sh [project_id]
```

---

## Support

- [GitHub Issues](https://github.com/your-org/claudio/issues)

---

<div align="center">

**English** | **[한국어](README.md)**

Built with Rust + Next.js + n8n

</div>
