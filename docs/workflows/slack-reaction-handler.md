# slack-reaction-handler

Slack 리액션을 감지하여 후속 작업을 트리거하는 워크플로우.

---

## 개요

| 항목 | 값 |
|------|-----|
| **트리거** | Webhook (`/webhook/slack-reaction`) |
| **소스 이벤트** | Slack `reaction_added` |
| **주요 기능** | Jira 티켓 생성, 수정 실행, 옵션 선택 |

---

## 리액션 유형

| 리액션 | 유형 | 동작 |
|--------|------|------|
| :jira: | Action | Jira 티켓 생성 |
| :wrench: | Action | AI 제안 수정 실행 |
| :one: ~ :nine: | Trigger | 옵션 선택 후 후속 작업 |
| :thumbsup: :thumbsdown: | Feedback | → [slack-feedback-handler](slack-feedback-handler.md)로 라우팅 |

---

## 플로우 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                        slack-reaction-handler                        │
└─────────────────────────────────────────────────────────────────────┘

  Webhook          Lookup Execution       Route by Type
    │                    │                     │
    ▼                    ▼                     ▼
┌───────┐           ┌─────────┐           ┌─────────┐
│Webhook│──────────►│ Lookup  │──────────►│  Route  │
│       │           │Execution│           │         │
└───────┘           └─────────┘           └────┬────┘
                                               │
                    ┌──────────────────────────┼──────────────────────┐
                    ▼                          ▼                      ▼
              ┌───────────┐             ┌───────────┐          ┌───────────┐
              │   :jira:  │             │ :wrench:  │          │  :one:    │
              │Create Jira│             │Execute Fix│          │Select Opt │
              └─────┬─────┘             └─────┬─────┘          └─────┬─────┘
                    │                         │                      │
                    ▼                         ▼                      ▼
              ┌───────────┐             ┌───────────┐          ┌───────────┐
              │Reply Jira │             │ Reply Fix │          │ Execute   │
              │   Link    │             │  Result   │          │ Selected  │
              └───────────┘             └───────────┘          └───────────┘
```

---

## 노드 상세

### 1. Webhook

**입력**:
```json
{
  "reaction": "jira",
  "user": "U0123456789",
  "item": {
    "channel": "C0123456789",
    "ts": "1234567890.123456"
  }
}
```

### 2. Lookup Execution

메시지 ts로 원본 실행 조회:

```
GET {N8N_API_URL}/v1/executions/lookup?channel={channel}&ts={ts}
```

**응답**:
```json
{
  "id": "exec_abc123",
  "user_message": "장애 분석해줘",
  "response": "분석 결과...",
  "agent": "Incident Analyzer",
  "metadata": {
    "service": "payment-service",
    "options": [
      {"id": 1, "action": "rollback", "label": "롤백"},
      {"id": 2, "action": "scale", "label": "스케일 아웃"}
    ]
  }
}
```

### 3. Route by Type

리액션 유형별 분기:

```javascript
const reaction = $json.reaction;

// 피드백 리액션은 별도 워크플로우로
if (['thumbsup', '+1', 'thumbsdown', '-1'].includes(reaction)) {
  return { route: 'feedback' };
}

// 숫자 리액션
if (/^(one|two|three|four|five|six|seven|eight|nine)$/.test(reaction)) {
  const num = { one: 1, two: 2, ... }[reaction];
  return { route: 'trigger', option: num };
}

// 액션 리액션
return { route: 'action', action: reaction };
```

---

## 액션: Jira 티켓 생성

### 플로우

```
:jira: 리액션
      │
      ▼
  실행 정보 조회
      │
      ▼
  Jira 티켓 생성
      │
      ▼
  Slack에 링크 응답
```

### Jira API 호출

```
POST https://{JIRA_HOST}/rest/api/3/issue
```

```json
{
  "fields": {
    "project": { "key": "OPS" },
    "issuetype": { "name": "Bug" },
    "summary": "[AI 분석] payment-service High Error Rate",
    "description": {
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "AI 분석 결과..." }]
        }
      ]
    },
    "labels": ["ai-generated", "incident"]
  }
}
```

### 응답 메시지

```
:jira: Jira 티켓이 생성되었습니다: OPS-1234
https://company.atlassian.net/browse/OPS-1234
```

---

## 액션: Fix 실행

### 플로우

```
:wrench: 리액션
      │
      ▼
  실행 정보에서 fix_command 추출
      │
      ▼
  Claude Code로 명령 실행
      │
      ▼
  결과 응답
```

### 안전 장치

```javascript
// 위험한 명령 필터링
const dangerousPatterns = [
  /rm\s+-rf/,
  /DROP\s+TABLE/i,
  /kubectl\s+delete/
];

if (dangerousPatterns.some(p => p.test(command))) {
  return { error: '위험한 명령은 실행할 수 없습니다.' };
}
```

### 응답 메시지

```
:wrench: 수정이 완료되었습니다.

*실행 명령*:
`kubectl rollout restart deployment/payment-service`

*결과*:
deployment.apps/payment-service restarted
```

---

## 트리거: 옵션 선택

### 플로우

```
:one: 리액션
      │
      ▼
  metadata.options에서 option[0] 조회
      │
      ▼
  선택된 액션 실행
      │
      ▼
  결과 응답
```

### 옵션 매핑

```javascript
const options = execution.metadata.options;
const selected = options.find(o => o.id === optionNumber);

if (!selected) {
  return { error: `옵션 ${optionNumber}이 없습니다.` };
}

// 선택된 옵션의 액션 실행
return {
  action: selected.action,
  params: selected.params
};
```

---

## 설정

### Placeholder

| Placeholder | 설명 |
|-------------|------|
| `__JIRA_HOST__` | Jira 호스트 |
| `__JIRA_CREDENTIAL_ID__` | Jira 인증 ID |

### n8n 환경변수

| 변수 | 설명 |
|------|------|
| `N8N_API_URL` | claudio-api URL |

---

## 에러 처리

### 실행 정보 없음

```
해당 메시지에 대한 실행 정보를 찾을 수 없습니다.
(피드백은 AI 응답 메시지에만 가능합니다)
```

### Jira 생성 실패

```
:warning: Jira 티켓 생성에 실패했습니다.
오류: Authentication failed
```

### 중복 트리거 방지

```javascript
// 이미 처리된 트리거인지 확인
const existing = await lookupReaction(execution_id, reaction);
if (existing?.triggered) {
  return { skip: true, reason: 'already_triggered' };
}
```

---

## 연관 워크플로우

- [slack-feedback-handler](slack-feedback-handler.md) — 피드백 리액션 처리
- [slack-message-handler](slack-message-handler.md) — 원본 장애 분석
