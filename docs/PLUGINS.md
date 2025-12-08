# Claudio Plugins

Claudio는 전문화된 CLI 도구들과 통합하여 AI 에이전트의 능력을 확장합니다.

---

## 개요

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code Agent                     │
│                           │                              │
│         ┌─────────────────┼─────────────────┐           │
│         ▼                 ▼                 ▼           │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐    │
│  │ slack-cli  │    │  ssearch   │    │    glab    │    │
│  │            │    │ (semantic) │    │  (GitLab)  │    │
│  └─────┬──────┘    └─────┬──────┘    └─────┬──────┘    │
│        │                 │                 │            │
│        ▼                 ▼                 ▼            │
│     Slack API      Vector DB         GitLab API        │
└─────────────────────────────────────────────────────────┘
```

| 플러그인 | 용도 | 에이전트 활용 |
|----------|------|---------------|
| **slack-cli** | Slack 완전 제어 | 사용자 검색, 메시지 전송, 리액션 |
| **ssearch** | 시맨틱 검색 | 에이전트 자동 라우팅, 코드 검색 |
| **glab** | GitLab CLI | MR 조회, 코멘트 작성 |

---

## slack-cli

> [github.com/junyeong-ai/slack-cli](https://github.com/junyeong-ai/slack-cli)

### 소개

Rust로 작성된 고성능 Slack CLI. SQLite FTS5 기반 밀리초 단위 검색, 21개 명령어로 Slack 전체 기능 커버.

### 설치

```bash
curl -fsSL https://raw.githubusercontent.com/junyeong-ai/slack-cli/main/scripts/install.sh | bash
slack-cli config init --bot-token $SLACK_BOT_TOKEN
slack-cli cache refresh
```

### 에이전트 통합

**Agent tools 설정**:
```json
{
  "tools": ["Bash(slack-cli:*)"]
}
```

**사용 예시**:
```bash
# 사용자 검색 (FTS5 기반 빠른 검색)
slack-cli users "john"
slack-cli users --id U123456789

# 메시지 전송
slack-cli send "#general" "배포 완료되었습니다"
slack-cli send "#general" "스레드 답변" --thread 1234567890.123456

# 리액션
slack-cli react "#channel" 1234567890.123456 white_check_mark
slack-cli unreact "#channel" 1234567890.123456 eyes

# 스레드 조회
slack-cli thread "#channel" 1234567890.123456

# 채널 정보
slack-cli channels "dev-team"
slack-cli members "#dev-team"
```

### 활용 사례

#### 1. 리뷰어 멘션
```bash
# MR Reviewer 에이전트가 GitLab 리뷰어를 Slack에서 찾아 멘션
reviewers=$(glab mr view 123 --json reviewers | jq -r '.reviewers[].username')
for reviewer in $reviewers; do
  user=$(slack-cli users "$reviewer" --json | jq -r '.[0].id')
  echo "<@$user>"
done
```

#### 2. 채널 컨텍스트 수집
```bash
# 최근 메시지로 채널 컨텍스트 파악
slack-cli messages "#incident-channel" --limit 20
```

#### 3. 핀/북마크 관리
```bash
slack-cli pin "#channel" 1234567890.123456
slack-cli bookmark "#channel" "Runbook" "https://..."
```

### 캐시 시스템

```bash
slack-cli cache stats    # 캐시 상태 확인
slack-cli cache refresh  # 캐시 새로고침 (users, channels)
```

- **TTL**: 기본 168시간 (1주일)
- **자동 갱신**: TTL의 10% 시점에 백그라운드 갱신
- **FTS5 검색**: 부분 일치, 한글 지원

---

## ssearch (Semantic Search)

> [github.com/junyeong-ai/semantic-search-cli](https://github.com/junyeong-ai/semantic-search-cli)

시맨틱 검색 기반 에이전트 라우팅 및 코드 검색

### 소개

벡터 임베딩 기반 시맨틱 검색 CLI. 에이전트 examples와 사용자 메시지를 비교하여 최적의 에이전트를 자동 선택합니다.

### 에이전트 라우팅

**분류 우선순위**:
```
1. 키워드 매칭     → agent.keywords에 정확히 포함
2. 시맨틱 검색     → agent.examples와 유사도 비교 ⭐
3. LLM 폴백       → Claude가 description 기반 선택
```

**시맨틱 검색 플로우**:
```
사용자: "MR 좀 봐줘"
         │
         ▼
    임베딩 생성
         │
         ▼
    agent.examples 벡터와 비교
         │
    ┌────┴────┐
    ▼         ▼
  0.85      0.45
MR Reviewer  General
    │
    ▼
  선택!
```

### 설정

**.env**:
```bash
SEMANTIC_SEARCH_ENABLED=true
SEMANTIC_SEARCH_MIN_SCORE=0.5   # 최소 유사도 임계값
SEMANTIC_SEARCH_TOP_K=5         # 검색 결과 수
```

### 인덱스 관리

**에이전트 동기화**:
```bash
# 모든 프로젝트의 에이전트 인덱싱
./scripts/sync-agents.sh

# 특정 프로젝트만
./scripts/sync-agents.sh my-project
```

**인덱싱 대상**:
- `agent.name`
- `agent.description`
- `agent.examples[]`

### Agent examples 작성 가이드

```json
{
  "name": "MR Reviewer",
  "description": "GitLab MR 코드 리뷰",
  "examples": [
    "MR 리뷰해줘",
    "!123 봐줘",
    "https://gitlab.example.com/group/repo/-/merge_requests/456 리뷰",
    "코드 리뷰 부탁해",
    "PR 체크해줘"
  ]
}
```

**팁**:
- 다양한 표현 방식 포함 (MR, PR, 머지리퀘스트)
- 실제 사용자 요청 패턴 반영
- 5-15개의 예시가 적당

### API

```bash
# 분류 테스트
curl -X POST http://localhost:17280/v1/projects/default/classify \
  -H "Content-Type: application/json" \
  -d '{"text": "MR 리뷰해줘", "include_semantic": true}'

# 분류 로그 조회
curl http://localhost:17280/v1/classify/logs?limit=10
```

**응답 예시**:
```json
{
  "agent": "MR Reviewer",
  "confidence": 0.87,
  "method": "semantic",
  "reasoning": "Matched example: 'MR 리뷰해줘'"
}
```

### 코드 검색 (에이전트 내부)

에이전트가 코드베이스를 검색할 때도 시맨틱 검색 활용:

```bash
# 에이전트 tools 설정
{
  "tools": ["mcp__serena__*", "mcp__context7__*"]
}
```

---

## glab (GitLab CLI)

> GitLab 공식 CLI

### 설치

```bash
brew install glab
glab auth login
```

### 에이전트 통합

**Agent tools 설정**:
```json
{
  "tools": ["Bash(glab:*)"]
}
```

**MR Reviewer가 사용하는 명령어**:
```bash
# MR 정보 조회
glab mr view 123
glab mr view 123 --json

# 변경사항 확인
glab mr diff 123

# 코멘트 작성
glab mr note 123 -m "LGTM! :white_check_mark:"

# 승인
glab mr approve 123
```

---

## 플러그인 조합 예시

### MR 리뷰 + Slack 알림

```bash
# 1. MR 리뷰 수행
glab mr diff 123 > /tmp/diff.txt
# ... AI 분석 ...

# 2. 리뷰어에게 Slack 알림
reviewers=$(glab mr view 123 --json | jq -r '.reviewers[].username')
for r in $reviewers; do
  slack_id=$(slack-cli users "$r" --json | jq -r '.[0].id // empty')
  if [ -n "$slack_id" ]; then
    echo "<@$slack_id> MR !123 리뷰가 완료되었습니다"
  fi
done
```

### 장애 분석 + 컨텍스트 수집

```bash
# 1. Slack 스레드에서 장애 정보 수집
slack-cli thread "#incident" 1234567890.123456

# 2. 관련 코드 검색 (semantic)
ssearch "payment timeout error handling"

# 3. 분석 결과 전송
slack-cli send "#incident" "분석 결과: ..." --thread 1234567890.123456
```

---

## 문제 해결

### slack-cli 캐시 오류
```bash
rm -rf ~/.config/slack-cli/cache
slack-cli cache refresh
```

### 시맨틱 검색 정확도 낮음
1. `agent.examples` 다양화
2. `SEMANTIC_SEARCH_MIN_SCORE` 조정 (0.3~0.7)
3. `./scripts/sync-agents.sh` 재실행

### glab 인증 만료
```bash
glab auth status
glab auth login --hostname gitlab.example.com
```

---

## 관련 문서

- [README](../README.md) — 프로젝트 개요
