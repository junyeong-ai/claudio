# slack-reaction-handler

Slack 리액션을 감지하여 JIRA 티켓 생성 및 자동 수정을 트리거하는 워크플로우.

---

## 개요

| 항목 | 값 |
|------|-----|
| **트리거** | Webhook (`/webhook/slack-reaction`) |
| **소스 이벤트** | Slack `reaction_added` |
| **주요 기능** | JIRA 티켓 생성, 자동 수정 라벨 추가, 3-way 라우팅 |

---

## 리액션 유형

| 리액션 | 동작 |
|--------|------|
| `:one:` | JIRA 티켓만 생성 |
| `:two:` | JIRA 티켓 생성 + `ai:auto-fix` 라벨 추가 (can_auto_fix=true인 경우) |

---

## n8n Workflow

![slack-reaction-handler](../../assets/slack-reaction-handler.png)

---

## 3-Way 라우팅

Switch 노드에서 3가지 경로로 분기:

| 조건 | 라우팅 | 동작 |
|------|--------|------|
| `action = jira_only` | JIRA Only | JIRA 생성만 |
| `action = jira_autofix` AND `can_auto_fix = true` | JIRA + AutoFix | JIRA 생성 + `ai:auto-fix` 라벨 |
| `action = jira_autofix` AND `can_auto_fix = false` | AutoFix Not Allowed | JIRA 생성 + 자동수정 불가 안내 |

### Switch 노드 설정

```javascript
// Route 1: JIRA Only
{
  "leftValue": "={{ $('Extract').item.json.action }}",
  "operator": "equals",
  "rightValue": "jira_only"
}

// Route 2: JIRA + AutoFix
{
  "combinator": "and",
  "conditions": [
    { "leftValue": "={{ $('Extract').item.json.action }}", "operator": "equals", "rightValue": "jira_autofix" },
    { "leftValue": "={{ $('Extract').item.json.can_auto_fix }}", "operator": "equals", "rightValue": true }
  ]
}

// Route 3: AutoFix Not Allowed
{
  "combinator": "and",
  "conditions": [
    { "leftValue": "={{ $('Extract').item.json.action }}", "operator": "equals", "rightValue": "jira_autofix" },
    { "leftValue": "={{ $('Extract').item.json.can_auto_fix }}", "operator": "equals", "rightValue": false }
  ]
}
```

---

## 노드 상세

### 1. Parse

리액션 이벤트 파싱:

```javascript
const e = $('Webhook').item.json.body;

// reaction_added 이벤트만 처리
if (e.type !== 'reaction_added') return { json: { skip: true } };

// :one:, :two: 리액션만 처리
const r = e.reaction;
if (!['one', 'two'].includes(r)) return { json: { skip: true } };

const channel = e.item?.channel || e.channel;
const message_ts = e.item?.ts || e.message_ts;

return {
  json: {
    skip: false,
    action: r === 'one' ? 'jira_only' : 'jira_autofix',
    channel,
    message_ts,
    user: e.user
  }
};
```

### 2. Loading (Native Slack Node)

처리 시작 표시:

```json
{
  "resource": "reaction",
  "operation": "add",
  "channelId": "{{ $json.channel }}",
  "timestamp": "{{ $json.message_ts }}",
  "name": "loading"
}
```

**사용 노드**: `n8n-nodes-base.slack v2.2`

### 3. Fetch Context

실행 컨텍스트 조회:

```
GET {N8N_API_URL}/v1/executions/lookup?source=slack&ref_key=options_ts&ref_value={message_ts}
```

### 4. Extract

컨텍스트에서 정보 추출:

```javascript
const parse = $('Parse').item.json;
const res = $input.first().json;
const ctx = res.execution || {};

let jira_key = null, jira_title = '', jira_description = null;
let priority = 'Medium', alert = {}, can_auto_fix = false;

if (ctx.id && ctx.metadata) {
  const meta = typeof ctx.metadata === 'string' ? JSON.parse(ctx.metadata) : ctx.metadata;

  // 기존 JIRA 키 확인
  if (meta.jira_key) jira_key = meta.jira_key;

  // 컨텍스트에서 분석 결과 추출
  const context = meta.context ? JSON.parse(meta.context) : {};
  if (context.alert) alert = context.alert;
  if (context.can_auto_fix === true) can_auto_fix = true;

  if (context.analysis) {
    jira_title = context.analysis.jira_title || '';
    jira_description = context.analysis.jira_description || null;
    priority = context.analysis.priority || 'Medium';
    if (context.analysis.can_auto_fix === true) can_auto_fix = true;
  }
}

// 기본 JIRA 제목 생성
if (!jira_title) {
  jira_title = `[BUG] ${alert.service || 'Unknown'} - ${alert.alert_name || 'Incident'}`;
}

return {
  json: {
    ...parse,
    execution_id: ctx.id || null,
    jira_key,
    jira_title,
    jira_description,
    priority,
    alert,
    can_auto_fix
  }
};
```

### 5. Has JIRA?

기존 JIRA 키 존재 여부 확인:

- **있으면**: Use Existing JIRA (기존 키 사용)
- **없으면**: Create JIRA (새로 생성)

### 6. Create JIRA (Native JIRA Node)

JIRA 티켓 생성:

```json
{
  "operation": "create",
  "project": "__JIRA_PROJECT__",
  "issueType": "Task",
  "summary": "{{ $json.jira_title }}",
  "additionalFields": {
    "description": "{{ $json.jira_description }}",
    "priority": "{{ $json.priority === 'High' ? 'P1 - High' : 'P2 - Medium' }}"
  }
}
```

**사용 노드**: `n8n-nodes-base.jira v1`

### 7. Save JIRA Key

실행 정보에 JIRA 키 저장:

```javascript
if (data.execution_id && data.jira_key) {
  await this.helpers.httpRequest({
    method: 'PATCH',
    url: `${process.env.N8N_API_URL}/v1/executions/${data.execution_id}`,
    body: { jira_key: data.jira_key },
    json: true,
    timeout: 5000
  });
}
```

### 8. Route (3-Way Switch)

3가지 경로로 분기:

#### 8a. JIRA Only

```javascript
// Reply JIRA Only (Native Slack Node)
text: `:jira-new: <${jira_url}|${jira_key}> ${jira_title}`

// Done JIRA Only (Native Slack Node)
{ "resource": "reaction", "operation": "remove", "name": "loading" }
```

#### 8b. JIRA + AutoFix

```javascript
// Add auto-fix Label (Native JIRA Node)
{
  "operation": "update",
  "issueKey": "{{ $json.jira_key }}",
  "updateFields": {
    "labels": ["ai:auto-fix"]
  }
}

// Reply AutoFix (Native Slack Node)
text: `:jira-new: <${jira_url}|${jira_key}> ${jira_title}\n:robot_face: \`ai:auto-fix\` 라벨 추가됨 - 자동 수정 대기 중`

// Done AutoFix (Native Slack Node)
{ "resource": "reaction", "operation": "remove", "name": "loading" }
```

#### 8c. AutoFix Not Allowed

```javascript
// Reply No AutoFix (Native Slack Node)
text: `:jira-new: <${jira_url}|${jira_key}> ${jira_title}\n:no_entry: 이 이슈는 자동 수정이 불가능합니다`

// Done No AutoFix (Native Slack Node)
{ "resource": "reaction", "operation": "remove", "name": "loading" }
```

---

## 에러 처리

### JIRA 생성 실패

```javascript
// Error Data
const d = $('JIRA OK?').item.json;
return {
  json: {
    channel: $('Extract').item.json.channel,
    message_ts: $('Extract').item.json.message_ts,
    error: d.error || 'JIRA creation failed'
  }
};

// Reply Error (Native Slack Node)
text: `:x: JIRA creation failed: ${$json.error}`

// Remove Loading Err + Add ❌ (Native Slack Node)
```

---

## 설정

### Placeholder

| Placeholder | 설명 |
|-------------|------|
| `__JIRA_PROJECT__` | JIRA 프로젝트 키 |
| `__JIRA_CREDENTIAL_ID__` | JIRA API 인증 ID |
| `__SLACK_CREDENTIAL_ID__` | Slack API 인증 ID |

### n8n 환경변수

| 변수 | 설명 |
|------|------|
| `N8N_API_URL` | claudio-api URL |

### Credentials

| Credential | 용도 |
|------------|------|
| `jiraSoftwareCloudApi` | JIRA API 인증 |
| `slackApi` | Slack API 인증 |

---

## Slack 메시지 예시

### JIRA Only

```
:jira-new: <https://{JIRA_HOST}/browse/PRJ-123|PRJ-123> [BUG] service-name - High Error Rate
```

### JIRA + AutoFix

```
:jira-new: <https://{JIRA_HOST}/browse/PRJ-123|PRJ-123> [BUG] service-name - High Error Rate
:robot_face: `ai:auto-fix` 라벨 추가됨 - 자동 수정 대기 중
```

### AutoFix Not Allowed

```
:jira-new: <https://{JIRA_HOST}/browse/PRJ-123|PRJ-123> [BUG] service-name - High Error Rate
:no_entry: 이 이슈는 자동 수정이 불가능합니다
```

### 에러

```
:x: JIRA creation failed: Authentication failed
```

---

## 연관 워크플로우

- [slack-message-handler](slack-message-handler.md) — 장애 분석 및 `can_auto_fix` 판단
- [auto-fix-scheduler](auto-fix-scheduler.md) — `ai:auto-fix` 라벨 티켓 자동 수정
- [slack-feedback-handler](slack-feedback-handler.md) — 피드백 리액션 처리
