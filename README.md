# Claudio

[![Rust](https://img.shields.io/badge/rust-1.91.1%2B-orange?style=flat-square&logo=rust)](https://www.rust-lang.org)
[![Next.js](https://img.shields.io/badge/next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/react-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![n8n](https://img.shields.io/badge/n8n-workflows-ea4b71?style=flat-square&logo=n8n)](https://n8n.io)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

> **[English](README.en.md)** | **한국어**

**Slack에서 AI 에이전트를 운영하세요.** 멘션 한 번으로 코드 리뷰, 장애 분석, 질의응답까지 — Claude Code가 자동으로 처리합니다.

---

## 왜 Claudio인가?

- **즉시 응답** — Slack 멘션 → Claude Code 실행 → 스레드 답변
- **멀티 에이전트** — 키워드/시맨틱 기반 자동 라우팅
- **완전한 제어** — 대시보드에서 에이전트, 히스토리, 피드백 관리
- **플러그인 통합** — slack-cli, ssearch로 AI 능력 확장

---

## 빠른 시작

```bash
# 1. 클론 & 환경 설정
git clone https://github.com/your-org/claudio && cd claudio
cp .env.example .env  # 토큰 설정

# 2. 서비스 시작
docker compose up -d                    # n8n
./scripts/api-server.sh start           # API
./scripts/dashboard.sh start            # Dashboard

# 3. 워크플로우 배포
./scripts/n8n-workflows.sh init

# 4. Slack에서 테스트
@claudio 안녕!
```

---

## 아키텍처

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

## 주요 기능

### Slack 통합
```
@claudio MR 리뷰해줘 !123        → MR Reviewer 에이전트
@claudio 장애 원인 분석해줘      → Incident Analyzer 에이전트
@claudio 이 코드 설명해줘        → Default 에이전트
```

### 대시보드
- **히스토리** — 실행 로그, 토큰 사용량, 비용 추적
- **에이전트** — 생성/수정/테스트, 키워드/시맨틱 라우팅 설정
- **피드백** — 사용자 반응 수집 및 분석
- **분석** — 사용 패턴, 모델별 통계

---

## 워크플로우

### Slack 이벤트 처리

| 워크플로우 | 트리거 | 기능 | 상세 |
|------------|--------|------|------|
| **slack-mention-handler** | @멘션 | AI 응답 생성, 에이전트 라우팅 | [→](docs/workflows/slack-mention-handler.md) |
| **slack-message-handler** | 메시지 | 장애 채널 모니터링, 자동 분석 | [→](docs/workflows/slack-message-handler.md) |
| **slack-reaction-handler** | 리액션 | Jira 생성, Fix 실행, 옵션 선택 | [→](docs/workflows/slack-reaction-handler.md) |
| **slack-feedback-handler** | 피드백 리액션 | 응답 품질 측정, 통계 수집 | [→](docs/workflows/slack-feedback-handler.md) |

### 내부 서비스

| 워크플로우 | 트리거 | 기능 | 상세 |
|------------|--------|------|------|
| **user-context-handler** | Webhook | 사용자 규칙/컨텍스트 관리 | [→](docs/workflows/user-context-handler.md) |
| **gitlab-mr-review** | 스케줄 (1분) | MR 자동 코드 리뷰 | [→](docs/workflows/gitlab-mr-review.md) |

### 핵심 기능

#### 피드백 루프
사용자 반응으로 AI 응답 품질을 지속적으로 개선:
```
AI 응답 → :thumbsup:/:thumbsdown: 리액션 → 피드백 수집 → 대시보드 분석 → 에이전트 개선
```

#### 사용자 컨텍스트
개인화된 AI 응답 제공:
```
사용자 규칙: "한국어로 답변해줘"
대화 요약: "Backend 개발자, Spring 전문"
         ↓
    맞춤형 응답 생성
```

#### 액션 트리거
| 리액션 | 동작 |
|--------|------|
| :jira: | Jira 티켓 자동 생성 |
| :wrench: | AI 제안 수정 실행 |
| :one: ~ :nine: | 다중 옵션 선택 |

---

## 플러그인 통합

### slack-cli
Slack API 완전 제어 — 사용자 검색, 메시지 전송, 리액션 관리
```bash
slack-cli users "john"              # 사용자 검색
slack-cli send "#general" "Hello"   # 메시지 전송
slack-cli react "#ch" 1234 thumbsup # 리액션 추가
```

### ssearch (Semantic Search)
시맨틱 기반 에이전트 자동 라우팅
```
사용자: "MR 좀 봐줘" → 임베딩 비교 → MR Reviewer 선택
```

### glab (GitLab CLI)
MR 조회, 코멘트 작성, 승인 처리
```bash
glab mr view 123
glab mr diff 123
```

---

## 문서

| 문서 | 설명 |
|------|------|
| [플러그인 가이드](docs/PLUGINS.md) | slack-cli, ssearch, glab 통합 |
| [Slack Mention Handler](docs/workflows/slack-mention-handler.md) | @멘션 처리 워크플로우 |
| [Slack Message Handler](docs/workflows/slack-message-handler.md) | 메시지 모니터링 워크플로우 |
| [Slack Reaction Handler](docs/workflows/slack-reaction-handler.md) | 리액션 처리 워크플로우 |
| [Slack Feedback Handler](docs/workflows/slack-feedback-handler.md) | 피드백 수집 워크플로우 |
| [User Context Handler](docs/workflows/user-context-handler.md) | 사용자 컨텍스트 관리 |
| [GitLab MR Review](docs/workflows/gitlab-mr-review.md) | MR 자동 리뷰 |

---

## 설치

### 요구사항
- Docker & Docker Compose
- Rust 1.75+
- Node.js 20+
- Slack App (Socket Mode)

### 환경 설정

`.env` 파일 필수 값:

```bash
# Slack (api.slack.com/apps에서 생성)
SLACK_APP_TOKEN=xapp-...          # Socket Mode 토큰
SLACK_BOT_TOKEN=xoxb-...          # Bot OAuth 토큰

# n8n
N8N_API_KEY=your-n8n-api-key

# 프로젝트
CLAUDIO_DEFAULT_PROJECT=default   # 기본 프로젝트 ID
```

전체 설정: `.env.example` 참조

---

## 스크립트

```bash
./scripts/api-server.sh start|stop|restart|status|logs
./scripts/dashboard.sh start|stop|dev|status|logs
./scripts/n8n-workflows.sh init|push|pull|compare
./scripts/sync-agents.sh [project_id]
```

---

## 지원

- [GitHub Issues](https://github.com/your-org/claudio/issues)

---

<div align="center">

**[English](README.en.md)** | **한국어**

Built with Rust + Next.js + n8n

</div>
