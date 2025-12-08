# slack-mention-handler

Slack @멘션을 처리하여 AI 에이전트 응답을 생성하는 핵심 워크플로우.

---

## 개요

| 항목 | 값 |
|------|-----|
| **트리거** | Webhook (`/webhook/slack-mention`) |
| **소스 이벤트** | Slack `app_mention` |
| **주요 기능** | 에이전트 라우팅, Claude Code 실행, 스레드 응답 |

---

## 플로우 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                         slack-mention-handler                        │
└─────────────────────────────────────────────────────────────────────┘

  Webhook                Parse               Get User Info
    │                      │                      │
    │  {channel, user,     │  channel, user,      │  user_name,
    │   text, ts,          │  text, ts,           │  display_name
    │   thread_ts}         │  thread_ts           │
    ▼                      ▼                      ▼
┌───────┐             ┌───────┐             ┌───────────┐
│Webhook│────────────►│ Parse │────────────►│Get User   │
│       │             │       │             │Info       │
└───────┘             └───────┘             └─────┬─────┘
                                                  │
    ┌─────────────────────────────────────────────┘
    ▼
┌───────────┐         ┌───────────┐         ┌───────────┐
│ Classify  │────────►│   Chat    │────────►│Add React  │
│           │         │           │         │           │
└───────────┘         └─────┬─────┘         └───────────┘
                            │
                            ▼
                      ┌───────────┐
                      │   Reply   │
                      │           │
                      └───────────┘
```

---

## 노드 상세

### 1. Webhook

**입력** (claudio-api로부터):
```json
{
  "channel": "C0123456789",
  "user": "U0123456789",
  "text": "<@U_BOT> MR 리뷰해줘 !123",
  "ts": "1234567890.123456",
  "thread_ts": "1234567890.000000"
}
```

### 2. Parse

봇 멘션 제거 및 메타데이터 정리:
```javascript
const e = $('Webhook').item.json.body;
const u = $('Get User Info').item.json?.user || {};
return {
  channel: e.channel,
  user: e.user,
  user_name: u.display_name || u.real_name || null,
  text: e.text.replace(/<@[A-Z0-9]+>/g, '').trim(),
  ts: e.ts,
  thread_ts: e.thread_ts || e.ts,
  project: '__CLAUDIO_PROJECT__'
};
```

### 3. Get User Info

Dashboard API를 통해 Slack 사용자 정보 조회:
```
GET {N8N_DASHBOARD_URL}/api/plugins/slack/users/{user_id}
```

**응답**:
```json
{
  "user": {
    "id": "U0123456789",
    "name": "john.doe",
    "real_name": "John Doe",
    "display_name": "John"
  }
}
```

### 4. Classify

에이전트 라우팅:
```
POST {N8N_API_URL}/v1/projects/{project}/classify
```

**요청**:
```json
{
  "text": "MR 리뷰해줘 !123",
  "source": "slack",
  "requester": "U0123456789"
}
```

**응답**:
```json
{
  "agent": "MR Reviewer",
  "confidence": 0.95,
  "method": "keyword",
  "matched_keyword": "MR"
}
```

### 5. Chat

Claude Code 실행:
```
POST {N8N_API_URL}/v1/projects/{project}/chat
```

**요청**:
```json
{
  "user_message": "MR 리뷰해줘 !123",
  "agent": "MR Reviewer",
  "source": "slack",
  "requester": "U0123456789",
  "requester_name": "John",
  "metadata": {
    "channel": "C0123456789",
    "ts": "1234567890.123456",
    "thread_ts": "1234567890.000000"
  }
}
```

**응답**:
```json
{
  "id": "exec_abc123",
  "status": "completed",
  "result": "리뷰 결과...",
  "duration_ms": 45000,
  "model": "opus"
}
```

### 6. Reply

Slack 스레드에 응답:
```
POST https://slack.com/api/chat.postMessage
```

```json
{
  "channel": "C0123456789",
  "text": "리뷰 결과...",
  "thread_ts": "1234567890.000000"
}
```

### 7. Add Reactions

피드백 수집용 리액션 추가:
```javascript
const reactions = ['thumbsup', 'thumbsdown'];
// 옵션이 있는 경우 숫자 리액션도 추가
if (hasOptions) {
  reactions.push('one', 'two', 'three');
}
```

---

## 설정

### 환경변수 (n8n)

| 변수 | 설명 | 예시 |
|------|------|------|
| `N8N_API_URL` | claudio-api URL | `http://host.docker.internal:17280` |
| `N8N_DASHBOARD_URL` | Dashboard URL | `http://host.docker.internal:17281` |

### Placeholder

| Placeholder | 설명 |
|-------------|------|
| `__CLAUDIO_PROJECT__` | 프로젝트 ID |
| `__SLACK_CREDENTIAL_ID__` | Slack API 인증 ID |

---

## 에러 처리

### Chat 실패 시

```
status: "failed" | "timeout"
         │
         ▼
   Reply with Error
   "죄송합니다, 요청을 처리하는 중 오류가 발생했습니다."
```

### Rate Limit 초과 시

```
status: 429
         │
         ▼
   Reply with Retry Message
   "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
```

---

## 연관 워크플로우

- [slack-feedback-handler](slack-feedback-handler.md) — 응답에 대한 피드백 처리
- [slack-reaction-handler](slack-reaction-handler.md) — 숫자 리액션 옵션 처리
- [user-context-handler](user-context-handler.md) — 사용자 컨텍스트 조회
