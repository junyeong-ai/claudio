# gitlab-mr-review

GitLab MR을 자동으로 코드 리뷰하는 스케줄 기반 워크플로우.

---

## 개요

| 항목 | 값 |
|------|-----|
| **트리거** | Schedule (1분 간격) |
| **주요 기능** | MR 자동 감지, 코드 리뷰, Slack 알림 |

---

## 플로우 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                          gitlab-mr-review                            │
└─────────────────────────────────────────────────────────────────────┘

  Schedule           Get Open MRs            Filter
    │                     │                    │
    ▼                     ▼                    ▼
┌───────┐            ┌─────────┐          ┌─────────┐
│ Every │───────────►│Get Open │─────────►│ Filter  │
│1 Minute│           │   MRs   │          │         │
└───────┘            └─────────┘          └────┬────┘
                                               │
                         ┌─────────────────────┘
                         ▼
                    ┌─────────┐
                    │Label    │
                    │In-Prog  │
                    └────┬────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        MR Reviewer Agent                             │
│                                                                      │
│  glab mr view/diff → 분석 → JSON 결과                                │
│                                                                      │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
              ┌───────────┐                   ┌───────────┐
              │  Success  │                   │  Failure  │
              └─────┬─────┘                   └─────┬─────┘
                    │                               │
        ┌───────────┴───────────┐                   │
        ▼                       ▼                   ▼
  ┌───────────┐          ┌───────────┐       ┌───────────┐
  │Parse JSON │          │Label Done │       │Label Failed│
  │Build Msg  │          │           │       │Notify Err  │
  └─────┬─────┘          └───────────┘       └───────────┘
        │
        ▼
  ┌───────────┐
  │Post Slack │
  └───────────┘
```

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
  reviewers: mr.reviewers.map(r => r.name || r.username),
  labels: mr.labels
};
```

### 3. Label In-Progress

리뷰 시작 표시:

```
PUT /api/v4/projects/{project}/merge_requests/{iid}
```

```json
{
  "add_labels": "ai-review::in-progress",
  "remove_labels": "ai-review::done,ai-review::failed,ai-review::sha:*"
}
```

### 4. Execute MR Reviewer

Claude Code 실행:

```
POST {N8N_API_URL}/v1/projects/system/chat
```

```json
{
  "user_message": "Review MR !123: Add payment retry logic\n\n**Branch**: `feature/payment` → `main`\n**Author**: john.doe",
  "agent": "MR Reviewer",
  "source": "gitlab",
  "requester": "john.doe",
  "metadata": {
    "mr_iid": 123,
    "mr_url": "https://gitlab.example.com/.../merge_requests/123"
  }
}
```

### 5. Parse Review

JSON 응답 파싱:

```javascript
const result = JSON.parse(executeResult.result);

// 예상 포맷
{
  "verdict": "approve",           // approve | changes | comment
  "emoji": ":white_check_mark:",  // Slack emoji
  "summary": "Clean implementation with good test coverage",
  "points": [
    "Well-structured error handling",
    "Good use of retry pattern"
  ]
}
```

### 6. Build Message

Slack 메시지 구성:

```javascript
const message = `:mag: *<${mr.mr_url}|!${mr.mr_iid}>* ${mr.mr_title}
${review.emoji} ${review.summary}
${review.points.map(p => `• ${p}`).join('\n')}
${reviewerMentions}`;
```

### 7. Post Slack

리뷰 결과 알림:

```
POST https://slack.com/api/chat.postMessage
```

```json
{
  "channel": "{MR_REVIEW_CHANNEL}",
  "text": ":mag: *<!123>* Add payment retry logic\n:white_check_mark: Clean implementation..."
}
```

### 8. Label Done

완료 상태 표시:

```json
{
  "add_labels": "ai-review::done,ai-review::sha:abc123def",
  "remove_labels": "ai-review::in-progress"
}
```

---

## MR Reviewer Agent

### Instruction

```markdown
# MR Reviewer

## Task
1. Execute: /mr --review {mr_iid}
2. Return JSON result

## Review Focus
- Bugs, security, performance, maintainability
- Consistency with codebase (naming, patterns, structure)
- Code duplication (check similar existing implementations)
- Error handling patterns

## Issue Classification
- 🔴 Blocking: Must fix
- 🟡 Advisory: Recommended
- 💬 Learning: Educational

## Output Format
Return ONLY this JSON (no markdown, no explanation):

{"verdict":"approve|changes|comment","emoji":":white_check_mark:|:warning:|:x:","summary":"<one-line reason>","points":["<finding>","<finding>"]}

- verdict: approve (mergeable) | changes (fix required) | comment (discuss)
- points: 2-4 findings
```

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

## 설정

### Placeholder

| Placeholder | 설명 | 예시 |
|-------------|------|------|
| `__GITLAB_HOST__` | GitLab 호스트 | `gitlab.example.com` |
| `__GITLAB_PROJECT__` | 프로젝트 경로 | `team/backend-api` |
| `__GITLAB_CREDENTIAL_ID__` | GitLab 인증 ID | |

### n8n 환경변수

| 변수 | 설명 |
|------|------|
| `N8N_API_URL` | claudio-api URL |
| `N8N_DASHBOARD_URL` | Dashboard URL |
| `MR_REVIEW_CHANNEL` | Slack 알림 채널 |

---

## Slack 메시지 예시

### 승인

```
:mag: *<!123>* Add payment retry logic
:white_check_mark: Clean implementation with good test coverage
• Well-structured error handling
• Good use of retry pattern with exponential backoff
• Comprehensive test cases for edge scenarios
@john.doe @jane.smith
```

### 수정 필요

```
:mag: *<!456>* Refactor user authentication
:warning: Several issues need addressing before merge
• 🔴 SQL injection vulnerability in login query
• 🟡 Missing input validation for email field
• 💬 Consider using prepared statements pattern
@bob.wilson
```

### 실패

```
:x: *MR Review Failed*
<!789> Update dependencies
:hourglass: Timeout
```

---

## 에러 처리

### 타임아웃

```javascript
if (status === 'timeout') {
  // 라벨: ai-review::failed
  // Slack: 타임아웃 알림
  // 다음 주기에 재시도
}
```

### JSON 파싱 실패

```javascript
try {
  review = JSON.parse(result);
} catch (e) {
  review = {
    verdict: 'error',
    emoji: ':warning:',
    summary: 'Failed to parse review result',
    points: []
  };
}
```

### GitLab API 오류

```javascript
if (gitlabResponse.status === 401) {
  // 인증 만료 → 알림
}
if (gitlabResponse.status === 404) {
  // MR 삭제됨 → 스킵
}
```

---

## 연관 워크플로우

- [slack-mention-handler](slack-mention-handler.md) — 수동 MR 리뷰 요청
- [slack-reaction-handler](slack-reaction-handler.md) — 리뷰 결과에 대한 후속 작업
