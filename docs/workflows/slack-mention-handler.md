# slack-mention-handler

Slack @멘션을 처리하여 AI 에이전트 응답을 생성하는 핵심 워크플로우.

---

## 개요

| 항목 | 값 |
|------|-----|
| **트리거** | Webhook (`/webhook/slack-mention`) |
| **소스 이벤트** | Slack `app_mention` |
| **주요 기능** | 에이전트 라우팅, Claude Code 실행, 스레드 응답, 피드백 리액션 |

---

## 플로우 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                         slack-mention-handler                        │
└─────────────────────────────────────────────────────────────────────┘

  Webhook              OK            Get User Info         Parse
    │                   │                  │                 │
    ▼                   ▼                  ▼                 ▼
┌───────┐          ┌─────────┐       ┌──────────┐      ┌─────────┐
│Webhook│─────────►│   OK    │──────►│Get User  │─────►│  Parse  │
│       │          │         │       │  Info    │      │         │
└───────┘          └─────────┘       └──────────┘      └────┬────┘
                                                            │
                                                            ▼
                                                       ┌─────────┐
                                                       │Has Text?│
                                                       └────┬────┘
                                                            │
                              ┌─────────────────────────────┴────────────────────────┐
                              ▼                                                      ▼
                         (Has Text)                                             (No Text)
                              │                                                      │
                              ▼                                                   [Stop]
                         ┌─────────┐
                         │:loading:│◄── Native Slack Node
                         └────┬────┘
                              │
                              ▼
                         ┌─────────┐
                         │Classify │
                         └────┬────┘
                              │
                              ▼
                         ┌─────────┐
                         │ Static? │
                         └────┬────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
         (Static)                        (Dynamic)
              │                               │
              ▼                               ▼
         ┌─────────┐                    ┌───────────┐
         │ Format  │                    │  Build    │
         │ Static  │                    │  Prompt   │
         └────┬────┘                    └─────┬─────┘
              │                               │
              ▼                               ▼
         ┌─────────┐                    ┌───────────┐
         │  Done   │                    │  Execute  │
         │ Static  │                    │           │
         └────┬────┘                    └─────┬─────┘
              │                               │
              ▼                               ▼
         ┌─────────┐                    ┌───────────┐
         │    ✅   │                    │ Success?  │
         │ Static  │                    └─────┬─────┘
         └────┬────┘                          │
              │                    ┌──────────┴──────────┐
              ▼                    ▼                     ▼
         ┌─────────┐          (Success)            (Failure)
         │  Reply  │               │                     │
         │ Static  │               ▼                     ▼
         └────┬────┘          ┌─────────┐          ┌─────────┐
              │               │ Format  │          │Done Err │
              ▼               └────┬────┘          └────┬────┘
         ┌─────────┐               │                    │
         │  Stats  │               ▼                    ▼
         │ Static  │          ┌─────────┐          ┌─────────┐
         └─────────┘          │ Extract │          │   ❌    │
                              │ Result  │          └────┬────┘
                              └────┬────┘               │
                                   │                    ▼
                                   ▼               ┌─────────┐
                              ┌─────────┐          │ Err Msg │
                              │ Done OK │          └────┬────┘
                              └────┬────┘               │
                                   │                    ▼
                                   ▼               ┌─────────┐
                              ┌─────────┐          │Reply Err│
                              │    ✅   │          └────┬────┘
                              └────┬────┘               │
                                   │                    ▼
                                   ▼               ┌─────────┐
                              ┌─────────┐          │Stats Err│
                              │  Reply  │          └─────────┘
                              └────┬────┘
                                   │
                                   ▼
                              ┌─────────┐
                              │   Set   │
                              │ Context │
                              └────┬────┘
                                   │
                         ┌─────────┴─────────┐
                         ▼                   ▼
                    ┌─────────┐         ┌─────────┐
                    │   👍    │         │   👎    │
                    └────┬────┘         └─────────┘
                         │
                         ▼
                    ┌─────────┐
                    │Stats OK │
                    └────┬────┘
                         │
                         ▼
                    ┌─────────┐
                    │ Update  │
                    │ Context │
                    └─────────┘
```

---

## 노드 상세

### 1. Webhook

**경로**: POST `/webhook/slack-mention`
**응답 모드**: `responseNode`

### 2. OK

즉시 `ok` 응답 반환.

### 3. Get User Info

Dashboard API로 Slack 사용자 정보 조회:

```
GET {N8N_DASHBOARD_URL}/api/plugins/slack/users/{user_id}
```

**Timeout**: 10000ms

### 4. Parse

메시지 파싱 및 메타데이터 정리:

```javascript
const e = $('Webhook').item.json.body;
const u = $('Get User Info').item.json?.user || {};
const name = u.display_name || u.real_name || u.name || null;

return {
  json: {
    channel: e.channel,
    user: e.user,
    user_name: name,
    text: e.text,
    ts: e.ts,
    thread_ts: e.thread_ts || e.ts,
    project: '__CLAUDIO_PROJECT__'
  }
};
```

### 5. Has Text?

`text`가 비어있지 않은지 확인.

### 6. Loading (Native Slack Node)

처리 시작 표시:

```json
{
  "resource": "reaction",
  "operation": "add",
  "channelId": "{{ $json.channel }}",
  "timestamp": "{{ $json.ts }}",
  "name": "loading"
}
```

**사용 노드**: `n8n-nodes-base.slack v2.2`

### 7. Classify

에이전트 라우팅:

```
POST {N8N_API_URL}/v1/projects/{project}/classify
```

**Body**:
```json
{
  "text": "<사용자 메시지>"
}
```

**Timeout**: 30000ms

**응답**:
```json
{
  "agent": "MR Reviewer",
  "static_response": null,
  "prompt": null
}
```

### 8. Static?

`static_response`가 비어있지 않으면 Static 플로우로 분기.

---

## Static Response 플로우

에이전트의 `static_response` 설정이 있는 경우 Claude Code 실행 없이 즉시 응답.

### 9a. Format Static

```javascript
const cls = $input.first().json;
return { json: { text: cls.static_response } };
```

### 10a. Done Static (Native Slack Node)

`:loading:` 리액션 제거.

### 11a. ✅ Static (Native Slack Node)

`:white_check_mark:` 리액션 추가.

### 12a. Reply Static (Native Slack Node)

스레드에 static_response 응답.

### 13a. Stats Static

워크플로우 통계 기록:

```
POST {N8N_API_URL}/v1/workflows/stats
```

```json
{
  "workflow": "slack-mention-handler",
  "status": "success",
  "metadata": {
    "type": "static",
    "channel": "...",
    "user": "..."
  }
}
```

---

## Dynamic Response 플로우

Claude Code를 실행하여 응답을 생성.

### 9b. Build Prompt

instruction 및 user_message 구성:

```javascript
const req = $('Parse').item.json;
const cls = $('Static?').item.json;

const instruction = `[Slack Context]
• Channel: ${req.channel}
• Thread: ${req.thread_ts}
• Guide: 1) Execute immediately if request is clear 2) Check thread/channel if context needed 3) Focus only on request if context is unrelated`;

return {
  json: {
    ...req,
    agent: cls.agent || 'general',
    instruction,
    user_message: cls.prompt ? `${cls.prompt}\n\n${req.text}` : req.text
  }
};
```

### 10b. Execute

Claude Code 실행:

```
POST {N8N_API_URL}/v1/projects/{project}/chat
```

**Body**:
```json
{
  "user_message": "<user_message>",
  "source": "slack",
  "requester": "<user_id>",
  "agent": "<agent>",
  "instruction": "<instruction>",
  "metadata": {
    "channel": "C0123456789",
    "thread_ts": "1234567890.000000",
    "user_name": "John Doe",
    "workflow_execution_id": "<n8n execution id>"
  }
}
```

**Timeout**: 660000ms (11분)

### 11b. Success?

`status === 'completed'` 조건 확인.

### 12b. Format

mrkdwn 포맷 변환:

```
POST {N8N_API_URL}/v1/format/mrkdwn
```

**Body**:
```json
{
  "text": "<result>"
}
```

### 13b. Extract Result

```javascript
return {
  json: {
    text: $json.text,
    execution_id: $('Success?').item.json.id
  }
};
```

### 14b. Done OK (Native Slack Node)

`:loading:` 리액션 제거.

### 15b. ✅ (Native Slack Node)

`:white_check_mark:` 리액션 추가.

### 16b. Reply (Native Slack Node)

스레드에 응답.

### 17b. Set Context

실행 정보 업데이트:

```
PATCH {N8N_API_URL}/v1/executions/{execution_id}
```

```json
{
  "reply_channel": "<channel>",
  "reply_ts": "<응답 메시지 ts>"
}
```

### 18b. 👍 / 👎 (Native Slack Node)

피드백 리액션 추가:

```json
{
  "resource": "reaction",
  "operation": "add",
  "name": "+1"  // 또는 "-1"
}
```

### 19b. Stats OK

워크플로우 통계 기록:

```json
{
  "workflow": "slack-mention-handler",
  "execution_id": "<claudio execution id>",
  "status": "success",
  "duration_ms": 45000,
  "metadata": {
    "agent": "MR Reviewer",
    "channel": "...",
    "user": "..."
  }
}
```

### 20b. Update Context

user-context-handler 호출:

```
POST {N8N_WEBHOOK_URL}/webhook/user-context
```

```json
{
  "user_id": "<user_id>",
  "user_name": "<user_name>"
}
```

---

## 에러 처리

### Done Err (Native Slack Node)

`:loading:` 리액션 제거.

### ❌ (Native Slack Node)

`:x:` 리액션 추가.

### Err Msg

에러 메시지 생성:

```javascript
const r = $('Success?').item.json;
const p = $('Build Prompt').item.json;

const msg = r.status === 'timeout'
  ? `:hourglass: Timeout (${p.agent})`
  : `:x: Error: ${r.error?.message || 'Unknown'}`;

return { json: { text: msg, execution_id: r.id } };
```

### Reply Err (Native Slack Node)

스레드에 에러 메시지 응답.

### Stats Err

에러 통계 기록:

```json
{
  "workflow": "slack-mention-handler",
  "execution_id": "<claudio execution id>",
  "status": "timeout",  // 또는 "error"
  "duration_ms": 660000,
  "metadata": {
    "agent": "MR Reviewer",
    "error": "Timeout"
  }
}
```

---

## 설정

### n8n 환경변수

| 변수 | 설명 |
|------|------|
| `N8N_API_URL` | claudio-api URL |
| `N8N_DASHBOARD_URL` | Dashboard URL |
| `N8N_WEBHOOK_URL` | n8n webhook base URL |

### Placeholder

| Placeholder | 설명 |
|-------------|------|
| `__CLAUDIO_PROJECT__` | 프로젝트 ID |
| `__SLACK_CREDENTIAL_ID__` | Slack API 인증 ID |

---

## Slack 메시지 예시

### 성공

```
@claudio MR 리뷰해줘 !123

┌────────────────────────────────────┐
│ 🔍 AI Code Review                  │
│                                    │
│ ✅ 코드 품질이 우수합니다.          │
│ - 변수명 명확함                    │
│ - 에러 핸들링 적절함               │
└────────────────────────────────────┘
```

### 타임아웃

```
:hourglass: Timeout (MR Reviewer)
```

### 에러

```
:x: Error: API connection failed
```

---

## 연관 워크플로우

- [slack-feedback-handler](slack-feedback-handler.md) — 👍/👎 피드백 처리
- [slack-reaction-handler](slack-reaction-handler.md) — :one:/:two: 리액션 처리
- [user-context-handler](user-context-handler.md) — 사용자 컨텍스트 요약
