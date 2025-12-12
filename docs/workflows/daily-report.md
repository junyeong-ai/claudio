# daily-report

매일 08:30 (월~금) TMS 팀 데일리 스크럼 리포트를 자동 생성하는 워크플로우.

---

## 개요

| 항목 | 값 |
|------|-----|
| **트리거** | Schedule Cron `30 8 * * 1-5` |
| **Agent** | Daily Report (`capora-daily-report`) |
| **채널** | `#team-tms-tech` |
| **출력** | Summary 메시지 + 담당자별 스레드 답글 |

---

## 플로우 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                           daily-report                               │
└─────────────────────────────────────────────────────────────────────┘

  Schedule          Get Commits       Aggregate        Execute
     │                   │               │                │
     ▼                   ▼               ▼                ▼
┌──────────┐       ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 08:30    │──┬───►│ Commits  │───►│ Aggregate│───►│ Execute  │
│ Weekdays │  │    └──────────┘    │ GitLab   │    │          │
└──────────┘  │                    └──────────┘    └────┬─────┘
              │    ┌──────────┐         ▲               │
              └───►│   MRs    │─────────┘               ▼
                   └──────────┘                    ┌──────────┐
                                                   │ Success? │
                                                   └────┬─────┘
                                                        │
                                        ┌───────────────┴───────────────┐
                                        ▼                               ▼
                                   (Success)                       (Failure)
                                        │                               │
                                        ▼                               ▼
                                  ┌──────────┐                    ┌──────────┐
                                  │ Format   │                    │ Notify   │
                                  │ Summary  │                    │ Failure  │
                                  └────┬─────┘                    └────┬─────┘
                                       │                               │
                                       ▼                               ▼
                                  ┌──────────┐                    ┌──────────┐
                                  │ Post     │                    │ Stats    │
                                  │ Summary  │                    │ Err      │
                                  └────┬─────┘                    └──────────┘
                                       │
                                       ▼
                                  ┌──────────┐
                                  │ Format   │
                                  │ Threads  │
                                  └────┬─────┘
                                       │
                                       ▼
                                  ┌──────────┐
                                  │ Post     │◄── Loop (per_person)
                                  │ Threads  │
                                  └────┬─────┘
                                       │
                                       ▼
                                  ┌──────────┐
                                  │ Stats OK │
                                  └──────────┘
```

---

## 노드 상세

### 1. 08:30 Weekdays

스케줄 트리거: 월~금 08:30 KST 실행.

```json
{
  "rule": {
    "interval": [{ "field": "cronExpression", "expression": "30 8 * * 1-5" }]
  }
}
```

### 2. Get Commits / Get MRs (Parallel)

GitLab API에서 어제~오늘 커밋/MR 수집.

```
GET /projects/{id}/repository/commits?since=yesterday
GET /projects/{id}/merge_requests?updated_after=yesterday&state=all
```

### 3. Aggregate GitLab

커밋/MR 데이터를 담당자별로 집계.

```javascript
{
  commits_by_author: { "홍길동": 5, "김철수": 3 },
  total_commits: 8,
  mrs_merged: [{ iid: 89, title: "...", author: "..." }],
  mrs_opened: [{ iid: 94, title: "...", author: "..." }]
}
```

### 4. Execute

claudio `/chat` 호출.

```
POST /v1/projects/{project}/chat
```

**Body**:
```json
{
  "user_message": "Generate daily scrum report for TMS team. Date: 2025-12-12 (Thu)",
  "agent": "Daily Report",
  "source": "n8n-scheduler",
  "requester": "daily-report-workflow",
  "metadata": {
    "gitlab_data": { ... },
    "workflow_execution_id": "..."
  }
}
```

**Timeout**: 660000ms (11분)

### 5. Success?

`status === 'completed'` 확인.

### 6. Format Summary

structured_output을 Slack mrkdwn으로 변환.

### 7. Post Summary

메인 채널에 Summary 메시지 발송. `ts` 값 저장.

### 8. Format Threads

`per_person` 배열을 개별 스레드 메시지로 변환.

### 9. Post Threads

Summary의 `thread_ts`를 사용하여 담당자별 스레드 답글 발송.

### 10. Stats OK / Stats Err

워크플로우 실행 통계 기록.

---

## Structured Output

Agent가 반환하는 JSON 스키마:

```json
{
  "summary": {
    "key_points": ["핵심 사항 1", "핵심 사항 2"],
    "completed_count": 5,
    "new_count": 3,
    "in_progress_count": 12
  },
  "urgent_items": [{
    "category": "p1",
    "issue_key": "TMS-456",
    "title": "API 응답 지연",
    "assignee": "박지민"
  }],
  "per_person": [{
    "assignee": "박지민",
    "slack_mention": "<@U123>",
    "todo": [{ "issue_key": "TMS-456", "title": "...", "priority": "P1" }],
    "done": [{ "issue_key": "TMS-345", "title": "..." }],
    "code_activity": { "commits": 5, "mr_created": ["!94"] },
    "remarks": ["진행중 이슈 12건"]
  }]
}
```

---

## 설정

### Placeholders

| Placeholder | 설명 |
|-------------|------|
| `__CLAUDIO_PROJECT__` | 프로젝트 ID |
| `__GITLAB_HOST__` | GitLab 호스트 |
| `__GITLAB_PROJECT__` | GitLab 프로젝트 경로 |
| `__GITLAB_CREDENTIAL_ID/NAME__` | GitLab 인증 |
| `__SLACK_CHANNEL__` | 발송 채널 ID |
| `__SLACK_CREDENTIAL_ID/NAME__` | Slack 인증 |

### 배포

```bash
./scripts/n8n-workflows.sh inject
./scripts/n8n-workflows.sh push daily-report
```

---

## 에러 처리

### Timeout

- Execute 노드 타임아웃: 660초
- 타임아웃 시 Slack에 `:hourglass: Timeout` 메시지 발송

### API 오류

- Execute 실패 시 에러 메시지 발송
- 통계에 `status: error` 기록

---

## 연관 문서

- [daily-report-plan.md](../daily-report-plan.md) — 전체 설계 문서
- [slack-mention-handler.md](slack-mention-handler.md) — Slack 멘션 처리 패턴 참고
