# slack-feedback-handler

사용자의 피드백 리액션을 수집하여 AI 응답 품질을 측정하는 워크플로우.

---

## 개요

| 항목 | 값 |
|------|-----|
| **트리거** | Webhook (`/webhook/slack-feedback`) |
| **소스 이벤트** | Slack `reaction_added`, `reaction_removed` |
| **주요 기능** | 피드백 Upsert/Delete, 실행 Lookup |

---

## 플로우 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                        slack-feedback-handler                        │
└─────────────────────────────────────────────────────────────────────┘

  Webhook              OK               Parse
    │                   │                 │
    ▼                   ▼                 ▼
┌───────┐          ┌─────────┐       ┌─────────┐
│Webhook│─────────►│   OK    │──────►│  Parse  │
│       │          │         │       │         │
└───────┘          └─────────┘       └────┬────┘
                                          │
                                          ▼
                                     ┌─────────┐
                                     │ Valid?  │
                                     └────┬────┘
                                          │
                         ┌────────────────┴────────────────┐
                         ▼                                 ▼
                    (Valid)                           (Invalid)
                         │                                 │
                         ▼                               [Stop]
                    ┌─────────────┐
                    │   Lookup    │
                    │  Execution  │
                    └──────┬──────┘
                           │
                           ▼
                      ┌─────────┐
                      │ Found?  │
                      └────┬────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
         (Found)                   (Not Found)
              │                         │
              ▼                       [Stop]
         ┌─────────┐
         │ Prepare │
         └────┬────┘
              │
              ▼
         ┌─────────┐
         │ Action? │
         └────┬────┘
              │
     ┌────────┴────────┐
     ▼                 ▼
 (upsert)          (delete)
     │                 │
     ▼                 ▼
┌─────────┐       ┌─────────┐
│ Upsert  │       │ Delete  │
└─────────┘       └─────────┘
```

---

## 노드 상세

### 1. Webhook

**경로**: POST `/webhook/slack-feedback`
**응답 모드**: `responseNode`

**입력**:
```json
{
  "type": "reaction_added",
  "reaction": "+1",
  "user": "U0123456789",
  "item": {
    "channel": "C0123456789",
    "ts": "1234567890.123456"
  }
}
```

또는:

```json
{
  "type": "reaction_removed",
  "reaction": "-1",
  "user": "U0123456789",
  "channel": "C0123456789",
  "message_ts": "1234567890.123456"
}
```

### 2. OK

즉시 `ok` 응답 반환.

### 3. Parse

이벤트 파싱 및 action 결정:

```javascript
const e = $input.first().json.body;

// reaction_added/removed 이벤트만 처리
if (!['reaction_added', 'reaction_removed'].includes(e.type)) {
  return { json: { skip: true } };
}

const reaction = e.reaction;
const userId = e.user;
// Slack API 형식과 bridge 형식 모두 지원
const channel = e.item?.channel || e.channel;
const messageTs = e.item?.ts || e.message_ts;

if (!reaction || !userId || !messageTs) {
  return { json: { skip: true } };
}

return {
  json: {
    skip: false,
    action: e.type === 'reaction_added' ? 'upsert' : 'delete',
    reaction,
    user_id: userId,
    channel,
    message_ts: messageTs
  }
};
```

### 4. Valid?

`skip === false` 조건 확인.

### 5. Lookup Execution

메시지 ts로 실행 정보 조회:

```
GET {N8N_API_URL}/v1/executions/lookup
    ?source=slack
    &ref_key=reply_ts
    &ref_value={message_ts}
```

**Timeout**: 5000ms

### 6. Found?

`execution.id`가 존재하는지 확인.

### 7. Prepare

실행 ID와 피드백 정보 결합:

```javascript
const lookup = $input.first().json;
const parse = $('Parse').item.json;

return {
  json: {
    execution_id: lookup.execution.id,
    user_id: parse.user_id,
    reaction: parse.reaction,
    action: parse.action
  }
};
```

### 8. Action?

`action === 'upsert'` 조건으로 분기.

### 9. Upsert

피드백 추가/업데이트:

```
POST {N8N_API_URL}/v1/executions/{execution_id}/reactions
```

**Body**:
```json
{
  "user_id": "U0123456789",
  "reaction": "+1"
}
```

### 10. Delete

피드백 삭제:

```
DELETE {N8N_API_URL}/v1/executions/{execution_id}/reactions
    ?user_id={user_id}
    &reaction={reaction}
```

---

## 피드백 리액션 매핑

| 리액션 | 의미 |
|--------|------|
| `:+1:` (`+1`) | 긍정적 피드백 |
| `:-1:` (`-1`) | 부정적 피드백 |

---

## 설정

### n8n 환경변수

| 변수 | 설명 |
|------|------|
| `N8N_API_URL` | claudio-api URL |

---

## API Endpoints

### 피드백 추가

```bash
curl -X POST http://localhost:17280/v1/executions/{id}/reactions \
  -H "Content-Type: application/json" \
  -d '{"user_id": "U0123456789", "reaction": "+1"}'
```

### 피드백 삭제

```bash
curl -X DELETE "http://localhost:17280/v1/executions/{id}/reactions?user_id=U0123456789&reaction=+1"
```

### 실행별 피드백 조회

```bash
curl http://localhost:17280/v1/executions/{id}/reactions
```

---

## 연관 워크플로우

- [slack-mention-handler](slack-mention-handler.md) — 응답 생성 + 피드백 리액션 추가
- [slack-reaction-handler](slack-reaction-handler.md) — 비피드백 리액션 처리 (`:one:`, `:two:`)
