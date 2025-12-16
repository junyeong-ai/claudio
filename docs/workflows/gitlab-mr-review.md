# gitlab-mr-review

GitLab MR을 자동으로 코드 리뷰하는 스케줄 기반 워크플로우.

---

## 개요

| 항목 | 값 |
|------|-----|
| **트리거** | Schedule (1분 간격) |
| **주요 기능** | MR 자동 감지, 코드 리뷰, GitLab 코멘트, Slack 알림 |

---

## n8n Workflow

![gitlab-mr-review](../../assets/gitlab-mr-code%20-review.png)

---

## Structured Output

MR Reviewer 에이전트가 반환하는 `structured_output`:

```json
{
  "verdict": "approve",
  "gitlab_comment": "## 🔍 AI Code Review\n\n코드 품질이 우수합니다...",
  "slack_message": "*<!123>* Add payment retry\n✅ Clean implementation"
}
```

### 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `verdict` | string | `approve` / `changes` / `comment` |
| `gitlab_comment` | string | GitLab MR에 작성할 코멘트 (AI 마커 포함) |
| `slack_message` | string | Slack 채널에 게시할 메시지 |

### Verdict 의미

| Verdict | 의미 | 이모지 |
|---------|------|--------|
| `approve` | 머지 가능 | ✅ |
| `changes` | 수정 필요 | ⚠️ |
| `comment` | 코멘트/논의 필요 | 💬 |

---

## MR 필터링 로직

### 리뷰 대상 조건

```javascript
const toReview = mrs.filter(mr => {
  const labels = mr.labels || [];

  // 진행 중인 리뷰 제외
  const hasInProgress = labels.includes('ai-review::in-progress');

  // 이미 리뷰한 SHA 제외
  const reviewedSha = labels
    .find(l => l.startsWith('ai-review::sha:'))
    ?.replace('ai-review::sha:', '');

  return !hasInProgress && reviewedSha !== mr.sha;
});
```

### 라벨 상태 흐름

```
MR 생성/업데이트
      │
      ▼
[라벨 없음] ──────────► [ai-review::in-progress]
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
            [ai-review::done]    [ai-review::failed]
            [ai-review::sha:abc]
```

---

## 노드 상세

### 1. Get Open MRs

GitLab API로 열린 MR 조회:

```
GET https://{GITLAB_HOST}/api/v4/projects/{project}/merge_requests
    ?state=opened
    &per_page=20
    &order_by=updated_at
    &sort=desc
```

### 2. Filter

리뷰가 필요한 MR 선별:

```javascript
// 한 번에 1개만 처리 (rate limit 고려)
const mr = toReview[0];

return {
  mr_iid: mr.iid,
  mr_title: mr.title,
  mr_url: mr.web_url,
  source_branch: mr.source_branch,
  target_branch: mr.target_branch,
  author: mr.author?.username,
  sha: mr.sha,
  reviewers: mr.reviewers.map(r => r.username),
  labels: mr.labels
};
```

### 3. In Progress

리뷰 시작 표시:

```
PUT /api/v4/projects/{project}/merge_requests/{iid}
```

```json
{
  "add_labels": "ai-review::in-progress",
  "remove_labels": "<기존 ai-review:: 라벨들>"
}
```

### 4. Get Discussions

MR의 Discussion 스레드 조회:

```
GET https://{GITLAB_HOST}/api/v4/projects/{project}/merge_requests/{iid}/discussions
```

### 5. Process Notes

Discussion 처리 로직:

```javascript
const AI_MARKER = 'AI Code Review';

for (const d of discussions) {
  const notes = d.notes || [];

  // AI 노트 판별: 첫줄에 'AI Code Review' 포함
  const isAI = n => (n.body || '').split('\n')[0].includes(AI_MARKER);
  const isUser = n => !n.system && !isAI(n);

  // AI만 있는 discussion 제외, AI+사용자 답글은 전체 포함 (맥락 보존)
  if (notes.some(isAI) && !notes.some(isUser)) continue;

  // 스레드 데이터 수집 (inline position 포함)
  const thread = { notes: [], position: null };
  for (const note of notes) {
    if (note.system) continue;
    thread.notes.push({
      author: note.author?.username,
      body: (note.body || '').slice(0, 500),
      isAI: isAI(note)
    });
    if (note.type === 'DiffNote' && note.position && !thread.position) {
      thread.position = {
        file: note.position.new_path || note.position.old_path,
        line: note.position.new_line || note.position.old_line
      };
    }
  }
  if (thread.notes.length > 0) threads.push(thread);
}
```

### 6. Build Prompt

사용자 코멘트를 포함한 프롬프트 구성:

```markdown
Review MR !123: Add payment retry logic

**Branch**: `feature/payment` → `main`
**Author**: john.doe
**URL**: https://gitlab.example.com/.../merge_requests/123

## Discussion Threads

### `src/payment.ts:42`
- 🤖 AI: "에러 핸들링 추가 필요"
- @jane: "retry 로직에 exponential backoff 적용하면 어떨까요?"

### General Discussion
- @bob: "테스트 케이스 추가 부탁드립니다"
```

### 7. Execute

Claude Code 실행:

```
POST {N8N_API_URL}/v1/projects/system/chat
```

```json
{
  "user_message": "<Build Prompt 결과>",
  "agent": "MR Reviewer",
  "source": "gitlab",
  "requester": "gitlab-mr-workflow",
  "metadata": {
    "mr_iid": 123,
    "mr_url": "https://gitlab.example.com/.../merge_requests/123",
    "author": "john.doe",
    "source_branch": "feature/payment",
    "target_branch": "main",
    "workflow_execution_id": "<n8n execution id>"
  }
}
```

**Timeout**: 660초 (11분)

### 8. Parse Review

Structured Output 파싱:

```javascript
const mr = $('Build Prompt').item.json;
const result = $('Execute').item.json;
const output = result.structured_output || {};

const review = {
  verdict: output.verdict || 'comment',
  gitlab_comment: output.gitlab_comment || '## 🔍 AI Code Review\n\nReview completed.',
  slack_message: output.slack_message || `*<${mr.mr_url}|!${mr.mr_iid}>* ${mr.mr_title}\n💬 리뷰 완료`
};

return { json: { mr, review, reviewers: mr.reviewers || [] } };
```

### 9. Post GitLab Comment

GitLab MR에 코멘트 작성:

```
POST /api/v4/projects/{project}/merge_requests/{iid}/notes
```

```json
{
  "body": "<review.gitlab_comment>"
}
```

### 10. Build Message

Slack 메시지 구성 (리뷰어 멘션 추가):

```javascript
const mentions = [];
for (const username of reviewers) {
  // GitLab 사용자명 → Slack 사용자 ID 조회
  const res = await this.helpers.httpRequest({
    method: 'GET',
    url: `${dashboardUrl}/api/plugins/slack/users`,
    qs: { q: username, limit: 1 }
  });
  if (res.users?.[0]) mentions.push(`<@${res.users[0].id}>`);
}

const message = review.slack_message + (mentions.length > 0 ? '\n' + mentions.join(' ') : '');
```

### 11. Post Slack (Native Slack Node)

리뷰 결과 알림:

```json
{
  "select": "channel",
  "channelId": "__MR_REVIEW_CHANNEL__",
  "text": "{{ $json.message }}"
}
```

**사용 노드**: `n8n-nodes-base.slack v2.2`

### 12. Done

완료 상태 표시:

```json
{
  "add_labels": "ai-review::done,ai-review::sha:abc123def",
  "remove_labels": "ai-review::in-progress"
}
```

### 13. Stats OK / Stats Err

워크플로우 통계 기록:

```
POST {N8N_API_URL}/v1/workflows/stats
```

```json
{
  "workflow": "gitlab-mr-review",
  "execution_id": "<claudio execution id>",
  "status": "success",
  "duration_ms": 45000,
  "metadata": {
    "mr_iid": 123,
    "mr_title": "Add payment retry logic"
  }
}
```

---

## MR Reviewer Agent

### AI 마커 정책

GitLab 코멘트 추적을 위해 AI가 작성하는 모든 MR 코멘트는 다음으로 시작:

```markdown
## 🔍 AI Code Review
```

**필터링 로직** (Process Notes):
```javascript
const firstLine = (note.body || '').split('\n')[0];
const isAI = firstLine.includes('AI Code Review');
```

이를 통해:
- AI 코멘트와 사용자 코멘트 구분
- AI만 있는 discussion은 다음 리뷰에서 제외
- AI + 사용자 답글 있는 discussion은 맥락 포함

### Tools

```json
{
  "tools": [
    "Skill",
    "Read", "Glob", "Grep",
    "Bash(glab:*)",
    "Bash(slack-cli:*)",
    "Bash(git:*)",
    "mcp__serena__*",
    "mcp__context7__*",
    "Bash(codecontext:*)"
  ]
}
```

---

## 실패 처리

### Failed 라벨 설정

```json
{
  "add_labels": "ai-review::failed",
  "remove_labels": "ai-review::in-progress"
}
```

### Notify Failure (Native Slack Node)

```javascript
text: $('Success?').item.json.status === 'timeout'
  ? `:x: *MR Review Failed*\n<${mr_url}|!${mr_iid}> ${mr_title}\n:hourglass: Timeout`
  : `:x: *MR Review Failed*\n<${mr_url}|!${mr_iid}> ${mr_title}\n:warning: ${error.message}`
```

---

## 설정

### Placeholder

| Placeholder | 설명 |
|-------------|------|
| `__GITLAB_HOST__` | GitLab 호스트 |
| `__GITLAB_PROJECT__` | 프로젝트 경로 (URL 인코딩) |
| `__MR_REVIEW_CHANNEL__` | Slack 알림 채널 ID |
| `__GITLAB_CREDENTIAL_ID__` | GitLab API 인증 ID |
| `__SLACK_CREDENTIAL_ID__` | Slack API 인증 ID |

### n8n 환경변수

| 변수 | 설명 |
|------|------|
| `N8N_API_URL` | claudio-api URL |
| `N8N_DASHBOARD_URL` | Dashboard URL |
| `MR_REVIEW_CHANNEL` | Slack 알림 채널 |

### Credentials

| Credential | 용도 |
|------------|------|
| `httpHeaderAuth` | GitLab API 인증 |
| `slackApi` | Slack API 인증 |

---

## Slack 메시지 예시

### 승인

```
*<!123>* Add payment retry logic
✅ Clean implementation with good test coverage
@john.doe @jane.smith
```

### 수정 필요

```
*<!456>* Refactor user authentication
⚠️ Several issues need addressing before merge
@bob.wilson
```

### 실패

```
:x: *MR Review Failed*
<!789> Update dependencies
:hourglass: Timeout
```

---

## 연관 워크플로우

- [slack-mention-handler](slack-mention-handler.md) — 수동 MR 리뷰 요청
- [slack-reaction-handler](slack-reaction-handler.md) — 리뷰 결과에 대한 후속 작업
