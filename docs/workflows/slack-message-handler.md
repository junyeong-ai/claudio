# slack-message-handler

특정 채널의 메시지를 감지하여 자동으로 장애 분석을 수행하는 워크플로우.

---

## 개요

| 항목 | 값 |
|------|-----|
| **트리거** | Webhook (`/webhook/slack-message`) |
| **소스 이벤트** | Slack `message.channels` |
| **주요 기능** | 장애 알림 감지, 자동 분석, 권장 조치 제안 |

---

## 플로우 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                         slack-message-handler                        │
└─────────────────────────────────────────────────────────────────────┘

  Webhook            Filter Channel         Parse Alert
    │                      │                     │
    ▼                      ▼                     ▼
┌───────┐             ┌─────────┐           ┌─────────┐
│Webhook│────────────►│ Filter  │──(pass)──►│ Parse   │
│       │             │ Channel │           │ Alert   │
└───────┘             └────┬────┘           └────┬────┘
                           │                     │
                      (not match)                ▼
                           │              ┌───────────┐
                           ▼              │ Enrich    │
                        [Stop]            │ Context   │
                                          └─────┬─────┘
                                                │
    ┌───────────────────────────────────────────┘
    ▼
┌───────────┐         ┌───────────┐         ┌───────────┐
│ Classify  │────────►│   Chat    │────────►│   Reply   │
│           │         │           │         │           │
└───────────┘         └───────────┘         └───────────┘
```

---

## 사용 사례

### 장애 채널 모니터링

PagerDuty, Datadog 등의 알림이 오는 채널을 모니터링:

```
#incident-alerts 채널
    │
    ▼
[ALERT] payment-service: High Error Rate (>5%)
    │
    ▼
자동 분석 트리거
    │
    ▼
"payment-service의 에러율이 급증했습니다.
 최근 배포: v2.3.1 (10분 전)
 영향 범위: /api/checkout 엔드포인트
 권장 조치: 롤백 고려"
```

---

## 노드 상세

### 1. Filter Channel

설정된 인시던트 채널만 처리:

```javascript
const incidentChannels = '__INCIDENT_CHANNELS__'.split(',');
const channel = $json.body.channel;

if (!incidentChannels.includes(channel)) {
  return []; // 처리 중단
}
return $json;
```

### 2. Parse Alert

알림 메타데이터 추출:

```javascript
const text = $json.body.text;
const servicePrefix = '__SERVICE_PREFIX__';

// [ALERT] myapp.payment-service: High Error Rate
const match = text.match(/\[(\w+)\]\s*([^:]+):\s*(.+)/);
if (!match) return { type: 'unknown', raw: text };

return {
  severity: match[1],                              // ALERT
  service: match[2].replace(servicePrefix, ''),    // payment-service
  message: match[3],                               // High Error Rate
  raw: text
};
```

### 3. Enrich Context

외부 소스에서 추가 컨텍스트 수집:

```javascript
// Datadog 메트릭 조회 (예시)
const service = $json.service;
const metrics = await fetch(`${DATADOG_API}/metrics?service=${service}`);

// 최근 배포 정보
const deploys = await fetch(`${DEPLOY_API}/recent?service=${service}`);

return {
  ...$json,
  metrics: metrics,
  recent_deploy: deploys[0],
  related_logs: `datadog-cli logs "${service}" --since 10m`
};
```

### 4. Classify → Chat

Incident Analyzer 에이전트로 라우팅:

```json
{
  "text": "[ALERT] payment-service: High Error Rate",
  "agent": "Incident Analyzer",
  "metadata": {
    "service": "payment-service",
    "severity": "ALERT",
    "recent_deploy": "v2.3.1"
  }
}
```

### 5. Reply

분석 결과를 스레드로 응답:

```
🔍 *장애 분석 결과*

*서비스*: payment-service
*심각도*: ALERT
*증상*: High Error Rate (>5%)

*분석*:
- 10분 전 v2.3.1 배포 후 에러율 급증
- /api/checkout 엔드포인트에서 TimeoutException 발생
- 외부 PG사 API 응답 지연 확인

*권장 조치*:
1. 🔴 즉시: PG사 상태 페이지 확인
2. 🟡 고려: 타임아웃 임계값 상향 (3s → 5s)
3. 💬 장기: 서킷브레이커 패턴 도입 검토

:jira: 리액션으로 Jira 티켓 생성
:wrench: 리액션으로 롤백 실행
```

---

## 설정

### Placeholder

| Placeholder | 설명 | 예시 |
|-------------|------|------|
| `__INCIDENT_CHANNELS__` | 모니터링 채널 ID | `C123,C456,C789` |
| `__SERVICE_PREFIX__` | 제거할 서비스 접두사 | `myapp.` |

### 인시던트 채널 찾기

```bash
# slack-cli로 채널 ID 조회
slack-cli channels "incident"
```

---

## 에러 처리

### 알림 파싱 실패

알 수 없는 형식의 메시지는 무시:
```javascript
if (!parsed.service) {
  // 로깅만 하고 응답하지 않음
  console.log('Unparseable alert:', text);
  return [];
}
```

### 분석 타임아웃

장시간 분석이 필요한 경우:
```
"분석 중입니다... (예상 소요: 2분)"
// 완료 후 별도 메시지
```

---

## 연관 워크플로우

- [slack-reaction-handler](slack-reaction-handler.md) — :jira:, :wrench: 리액션 처리
- [slack-mention-handler](slack-mention-handler.md) — 추가 질문 처리
