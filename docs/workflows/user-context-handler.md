# user-context-handler

사용자 컨텍스트를 관리하고 요약하는 워크플로우.

---

## 개요

| 항목 | 값 |
|------|-----|
| **트리거** | Webhook (`/webhook/user-context`) |
| **주요 기능** | 사용자 컨텍스트 조회, AI 요약, Lock 관리 |
| **호출 시점** | slack-mention-handler 완료 후 자동 호출 |

---

## 플로우 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                        user-context-handler                          │
└─────────────────────────────────────────────────────────────────────┘

  Webhook           Fetch Context      Should Summarize?
    │                     │                    │
    ▼                     ▼                    ▼
┌───────┐            ┌─────────┐          ┌─────────────┐
│Webhook│───────────►│  Fetch  │─────────►│   Should    │
│       │            │ Context │          │ Summarize?  │
└───────┘            └─────────┘          └──────┬──────┘
                                                 │
                          ┌──────────────────────┴──────────────────────┐
                          ▼                                             ▼
                     (Yes: needs_summary &&                        (No)
                      lock_acquired)                                    │
                          │                                             ▼
                          ▼                                        ┌─────────┐
                     ┌─────────┐                                   │ Result  │
                     │Summarize│◄── Context Summarizer Agent       │  Skip   │
                     └────┬────┘                                   └─────────┘
                          │
                          ▼
                     ┌─────────────┐
                     │ Summarize   │
                     │    OK?      │
                     └──────┬──────┘
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
          (Success)                 (Failure)
               │                         │
               ▼                         ▼
          ┌─────────┐               ┌─────────┐
          │  Parse  │               │ Release │
          │ Result  │               │  Lock   │
          └────┬────┘               └────┬────┘
               │                         │
               ▼                         ▼
          ┌─────────┐               ┌─────────┐
          │  Save   │               │ Result  │
          │ Context │               │  Error  │
          └────┬────┘               └─────────┘
               │
               ▼
          ┌─────────┐
          │ Result  │
          │   OK    │
          └─────────┘
```

---

## Lock 메커니즘

동시 요약 처리를 방지하기 위한 락 시스템:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Lock Flow                                │
└─────────────────────────────────────────────────────────────────┘

  Request 1 (t=0)                   Request 2 (t=1)
       │                                  │
       ▼                                  ▼
  acquire_lock=true                  acquire_lock=true
       │                                  │
       ▼                                  ▼
  lock_acquired=true ✅              lock_acquired=false ❌
       │                                  │
       ▼                                  │
  [Summarize...]                     [Skip - locked]
       │                                  │
       ▼                                  ▼
  Save Context                       Result: {summarized: false,
       │                                       reason: "locked"}
       ▼
  [Lock auto-released by Save]
```

---

## 노드 상세

### 1. Webhook

**경로**: POST `/webhook/user-context`
**응답 모드**: `lastNode` (마지막 노드 결과 반환)

**입력**:
```json
{
  "user_id": "U0123456789",
  "user_name": "John Doe"
}
```

### 2. Fetch Context

사용자 컨텍스트 조회 + Lock 획득 시도:

```
GET {N8N_API_URL}/v1/users/{user_id}/context
    ?format=markdown
    &user_name={user_name}
    &acquire_lock=true
    &lock_id={executionId}
```

**Timeout**: 5000ms

**응답**:
```json
{
  "user_id": "U0123456789",
  "user_name": "John Doe",
  "needs_summary": true,
  "lock_acquired": true,
  "lock_id": "n8n-exec-123",
  "summary_locked": false,
  "markdown": "## Recent Requests\n\n1. Python 정렬 알고리즘 설명\n2. TypeScript 타입 에러 해결\n..."
}
```

### 3. Should Summarize?

요약 필요 조건 확인:

```javascript
// 두 조건 모두 충족 시 요약 진행
$json.needs_summary === true && $json.lock_acquired === true
```

| needs_summary | lock_acquired | 결과 |
|---------------|---------------|------|
| true | true | Summarize |
| true | false | Skip (locked) |
| false | true | Skip (not_needed) |
| false | false | Skip (not_needed) |

### 4. Summarize

Context Summarizer 에이전트 실행:

```
POST {N8N_API_URL}/v1/projects/system/chat
```

**Body**:
```json
{
  "user_message": "<markdown 형식의 사용자 컨텍스트>",
  "agent": "Context Summarizer",
  "source": "n8n",
  "requester": "user-context-workflow",
  "metadata": {
    "target_user": "U0123456789",
    "user_name": "John Doe"
  }
}
```

**Timeout**: 90000ms (90초)

### 5. Summarize OK?

`status === 'completed'` 조건 확인.

### 6. Parse Result

Structured Output에서 summary와 rules 추출:

```javascript
const r = $input.first().json;
const ctx = $('Fetch Context').item.json;

const parsed = r.structured_output || {};
const summary = parsed.summary || '';
const rules = parsed.rules || [];

return { json: { user_id: ctx.user_id, summary, rules } };
```

### 7. Save Context

요약 결과 저장 (Lock 자동 해제):

```
PUT {N8N_API_URL}/v1/users/{user_id}/context
```

**Body**:
```json
{
  "summary": "Python/TypeScript 개발자. 알고리즘과 타입 시스템에 관심.",
  "rules": [
    "코드 예시 선호",
    "한국어 응답"
  ]
}
```

**Timeout**: 5000ms

### 8. Release Lock (실패 시)

요약 실패 시 명시적 Lock 해제:

```
DELETE {N8N_API_URL}/v1/users/{user_id}/context/lock
```

**Body**:
```json
{
  "lock_id": "n8n-exec-123"
}
```

### 9. Result OK

성공 응답:

```json
{
  "success": true,
  "user_id": "U0123456789",
  "summarized": true
}
```

### 10. Result Skip

Skip 응답:

```javascript
const ctx = $('Fetch Context').item.json;
const reason = ctx.summary_locked ? 'locked' : 'not_needed';

return {
  json: {
    success: true,
    user_id: ctx.user_id,
    summarized: false,
    reason
  }
};
```

### 11. Result Error

실패 응답:

```json
{
  "success": false,
  "user_id": "U0123456789",
  "error": "summarize_failed"
}
```

---

## Context Summarizer Agent

### Structured Output Schema

```json
{
  "type": "object",
  "properties": {
    "summary": {
      "type": "string",
      "description": "사용자 특성 요약 (1-2문장)"
    },
    "rules": {
      "type": "array",
      "items": { "type": "string" },
      "description": "사용자별 대응 규칙"
    }
  },
  "required": ["summary"]
}
```

---

## 설정

### n8n 환경변수

| 변수 | 설명 |
|------|------|
| `N8N_API_URL` | claudio-api URL |
| `N8N_WEBHOOK_URL` | n8n webhook base URL |

---

## API Endpoints

### 컨텍스트 조회

```bash
curl "http://localhost:17280/v1/users/U0123456789/context?format=markdown"
```

### 컨텍스트 저장

```bash
curl -X PUT http://localhost:17280/v1/users/U0123456789/context \
  -H "Content-Type: application/json" \
  -d '{"summary": "...", "rules": ["..."]}'
```

### 사용자 규칙 조회

```bash
curl http://localhost:17280/v1/users/U0123456789/rules
```

### 사용자 규칙 추가

```bash
curl -X POST http://localhost:17280/v1/users/U0123456789/rules \
  -H "Content-Type: application/json" \
  -d '{"content": "코드 예시 선호"}'
```

### Lock 해제

```bash
curl -X DELETE http://localhost:17280/v1/users/U0123456789/context/lock \
  -H "Content-Type: application/json" \
  -d '{"lock_id": "n8n-exec-123"}'
```

---

## 연관 워크플로우

- [slack-mention-handler](slack-mention-handler.md) — 완료 후 자동으로 user-context-handler 호출
