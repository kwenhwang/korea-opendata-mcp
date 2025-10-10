# HRFCO MCP Server QA 테스트 가이드

## 📋 목차
1. [서버 정보](#서버-정보)
2. [MCP 도구 개요](#mcp-도구-개요)
3. [테스트 환경 설정](#테스트-환경-설정)
4. [기본 테스트 케이스](#기본-테스트-케이스)
5. [정상 케이스 테스트](#정상-케이스-테스트)
6. [에러 케이스 테스트](#에러-케이스-테스트)
7. [성능 테스트](#성능-테스트)
8. [테스트 결과 보고 양식](#테스트-결과-보고-양식)

---

## 🚀 서버 정보

### 엔드포인트
- **MCP 서버 URL**: `https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp`
- **헬스체크 URL**: `https://hrfco-mcp-functions.netlify.app/.netlify/functions/health`
- **프로토콜**: JSON-RPC 2.0 over HTTP POST

### 서버 상태 확인
```bash
# 헬스체크
curl -s https://hrfco-mcp-functions.netlify.app/.netlify/functions/health | jq .
```

**예상 응답:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-02T20:10:00.000Z",
  "version": "1.0.0",
  "runtime": "netlify",
  "api_keys": {
    "hrfco": true
  }
}
```

---

## 🛠️ MCP 도구 개요

### 사용 가능한 도구 목록

| 도구 이름 | 설명 | 권장 우선순위 |
|-----------|------|---------------|
| `get_water_info` | 한국 댐 종합정보 조회 (방류량, 유입량, 저수율, 수위, 저수량, 관련 댐) | ⭐⭐⭐⭐⭐ |
| `get_water_level` | 특정 관측소 수위 데이터 조회 | ⭐⭐⭐⭐ |
| `get_rainfall` | 특정 관측소 강우량 데이터 조회 | ⭐⭐⭐⭐ |
| `search_observatory` | 관측소 검색 (이름/위치 기반) | ⭐⭐⭐ |
| `get_observatory_list` | 관측소 목록 조회 (타입별) | ⭐⭐ |

### 도구 상세 스펙

#### 1. `get_water_info` - 한국 댐 종합정보 통합 조회
**설명**: 팔당댐·대청댐 등 댐의 방류량/유입량/저수율/저수량과 한강 수위, 전국 강수량, 수계별 관련 댐 정보를 한국시간 기준으로 실시간 제공

**입력 파라미터:**
```json
{
  "query": "댐명/하천명/지역명+키워드 (예: 대청댐 방류량, 안동댐 저수율, 한강 수위, 서울 비)"
}
```

**출력 형식:**
```json
{
  "status": "success|error",
  "summary": "요약 텍스트",
  "direct_answer": "직접 답변 텍스트",
  "detailed_data": {
    "primary_station": {
      "name": "관측소명",
      "code": "관측소코드",
      "current_level": "현재 수위",
      "storage_rate": "저수율",
      "status": "상태",
      "trend": "추세",
      "last_updated": "최종 업데이트"
    },
    "related_stations": [
      {
        "name": "관련 관측소명",
        "code": "관측소코드"
      }
    ]
  },
  "timestamp": "응답 시간"
}
```

#### 2. `get_water_level` - 수위 데이터 조회
**설명**: 특정 관측소의 실시간 수위 데이터를 조회

**입력 파라미터:**
```json
{
  "obs_code": "관측소코드",
  "time_type": "1H"  // 선택적
}
```

#### 3. `get_rainfall` - 강우량 데이터 조회
**설명**: 특정 관측소의 실시간 강우량 데이터를 조회

**입력 파라미터:**
```json
{
  "obs_code": "관측소코드",
  "time_type": "1H"  // 선택적
}
```

#### 4. `search_observatory` - 관측소 검색
**설명**: 이름이나 위치로 관측소를 검색

**입력 파라미터:**
```json
{
  "query": "검색어",
  "hydro_type": "waterlevel|rainfall|dam"  // 선택적
}
```

#### 5. `get_observatory_list` - 관측소 목록 조회
**설명**: 특정 타입의 관측소 목록을 조회

**입력 파라미터:**
```json
{
  "hydro_type": "waterlevel|rainfall|dam"
}
```

---

## 🧪 테스트 환경 설정

### 1. 필수 도구
- **curl** 또는 **Postman** (HTTP 요청용)
- **jq** (JSON 파싱용, 선택적)

### 2. MCP 클라이언트 설정
ChatGPT에서 MCP를 사용하려면 다음 설정 파일을 사용:

```json
{
  "mcpServers": {
    "hrfco": {
      "command": "node",
      "args": ["-e", "console.log('MCP server not directly executable')"],
      "env": {
        "HRFCO_API_ENDPOINT": "https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp"
      }
    }
  }
}
```

### 3. 테스트 데이터 준비
**실제 작동하는 관측소 코드들:**
- 수위: `1001602` (평창군 송정교)
- 강우량: `10014010` (서울관측소)
- 댐: `1001210` (대청댐)

---

## 📋 기본 테스트 케이스

### MCP 요청 기본 형식
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "도구이름",
    "arguments": {
      "파라미터": "값"
    }
  }
}
```

### 테스트 명령어 템플릿
```bash
curl -X POST https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "도구이름",
      "arguments": {
        "파라미터": "값"
      }
    }
  }'
```

---

## ✅ 정상 케이스 테스트

### 1. 도구 목록 조회
**우선순위**: 높음
**목적**: MCP 서버가 정상적으로 작동하는지 확인

```bash
curl -X POST https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}'
```

**성공 기준**:
- HTTP 200 응답
- 5개 도구(tool) 반환
- 각 도구에 name, description, inputSchema 포함

### 2. 통합 검색 테스트 (get_water_info)
**우선순위**: 높음
**목적**: 가장 중요한 기능인 통합 검색 테스트

```bash
# 대청댐 검색
curl -X POST https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "get_water_info",
      "arguments": {"query": "대청댐"}
    }
  }'
```

**성공 기준**:
- 실제 관측소 데이터 반환
- 수위, 저수율, 상태 정보 포함
- 관련 관측소 정보 포함

### 3. 직접 수위 조회 테스트
**우선순위**: 높음

```bash
curl -X POST https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_water_level",
      "arguments": {"obs_code": "1001602"}
    }
  }'
```

**성공 기준**:
- 실시간 수위 데이터 반환 (1.73m 등)
- 시간 정보 포함
- 단위 정보 포함

### 4. 강우량 조회 테스트
**우선순위**: 중간

```bash
curl -X POST https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "get_rainfall",
      "arguments": {"obs_code": "10014010"}
    }
  }'
```

### 5. 관측소 검색 테스트
**우선순위**: 중간

```bash
# 이름으로 검색
curl -X POST https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "search_observatory",
      "arguments": {"query": "평창"}
    }
  }'
```

### 6. 관측소 목록 조회 테스트
**우선순위**: 낮음

```bash
# 수위 관측소 목록
curl -X POST https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 6,
    "method": "tools/call",
    "params": {
      "name": "get_observatory_list",
      "arguments": {"hydro_type": "waterlevel"}
    }
  }'
```

---

## ❌ 에러 케이스 테스트

### 1. 없는 관측소 검색
```bash
curl -X POST https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 7,
    "method": "tools/call",
    "params": {
      "name": "get_water_info",
      "arguments": {"query": "존재하지않는관측소"}
    }
  }'
```

**기대 결과**: "찾을 수 없습니다" 에러 메시지

### 2. 잘못된 관측소 코드
```bash
curl -X POST https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 8,
    "method": "tools/call",
    "params": {
      "name": "get_water_level",
      "arguments": {"obs_code": "9999999"}
    }
  }'
```

**기대 결과**: 데이터 찾을 수 없음 에러

### 3. 잘못된 파라미터
```bash
# 파라미터 누락
curl -X POST https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 9,
    "method": "tools/call",
    "params": {
      "name": "get_water_info"
    }
  }'
```

**기대 결과**: 유효성 검사 에러

### 4. 잘못된 JSON-RPC 형식
```bash
curl -X POST https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{"invalid": "jsonrpc format"}'
```

**기대 결과**: JSON-RPC 형식 에러

---

## ⚡ 성능 테스트

### 1. 응답 시간 측정
```bash
# 여러 번 실행해서 평균 응답 시간 측정
time curl -s -X POST https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 10, "method": "tools/list", "params": {}}' > /dev/null
```

**성공 기준**:
- 평균 응답 시간: 2-3초 이내
- 타임아웃: 없음

### 2. 동시 요청 테스트
```bash
# 여러 요청 동시에 실행
for i in {1..5}; do
  curl -s -X POST https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\": \"2.0\", \"id\": $i, \"method\": \"tools/list\", \"params\": {}}" &
done
wait
```

### 3. 대량 데이터 처리 테스트
```bash
# 많은 관측소 목록 조회
curl -X POST https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 11,
    "method": "tools/call",
    "params": {
      "name": "get_observatory_list",
      "arguments": {"hydro_type": "waterlevel"}
    }
  }'
```

---

## 📊 테스트 결과 보고 양식

### 테스트 케이스 결과 템플릿

```markdown
## 테스트 케이스: [테스트 케이스명]

### 테스트 정보
- **테스트 ID**: TC_001
- **도구명**: get_water_info
- **우선순위**: 높음
- **테스터**: [이름]
- **테스트 일시**: YYYY-MM-DD HH:MM

### 테스트 조건
- 요청 파라미터: `{"query": "대청댐"}`
- 예상 결과: 실시간 수위 데이터 반환

### 테스트 결과
- [ ] 통과
- [ ] 실패

### 실제 응답
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "실제 응답 내용"
      }
    ]
  }
}
```

### 결과 분석
- 응답 시간: X초
- 데이터 정확성: 양호/보통/불량
- 에러 발생: 있음/없음

### 버그 리포트 (실패 시)
- **심각도**: 높음/중간/낮음
- **재현 단계**: [단계별 설명]
- **예상 결과**: [기대했던 결과]
- **실제 결과**: [실제 발생한 결과]
- **스크린샷/로그**: [필요시 첨부]
```

### 종합 보고서 템플릿

```markdown
# HRFCO MCP Server QA 테스트 보고서

## 테스트 개요
- **테스트 기간**: YYYY-MM-DD ~ YYYY-MM-DD
- **테스터**: [이름들]
- **테스트 환경**: [환경 정보]

## 테스트 커버리지
- **총 테스트 케이스**: X개
- **통과**: X개 (XX%)
- **실패**: X개 (XX%)

## 주요 발견사항

### ✅ 강점
- [발견된 강점들]

### ⚠️ 개선 필요사항
- [발견된 문제점들]

### 📈 성능 지표
- 평균 응답 시간: X초
- 최대 응답 시간: X초
- 에러율: X%

## 권장사항
- [QA 팀의 권장사항들]
```

---

## 🔍 추가 테스트 시나리오

### 1. 다양한 검색어 테스트
- 지역명: "서울", "부산", "대구"
- 관측소명: "한강대교", "청담대교", "평림댐"
- 조합: "강원도 댐", "한강 수위"

### 2. 데이터 타입별 테스트
- 수위 관측소: 강, 하천 수위
- 강우량 관측소: 지역별 강우량
- 댐 관측소: 저수량, 유입량 등 추가 데이터

### 3. 시간대별 테스트
- 정상 업무시간
- 야간/새벽 시간
- 피크 타임

### 4. 네트워크 조건 테스트
- 정상 네트워크
- 느린 네트워크
- 불안정한 네트워크

---

## 📞 지원 및 문의

### 버그 리포트
버그 발견 시 다음 정보를 포함하여 보고해주세요:
1. 테스트 케이스 ID
2. 재현 단계
3. 요청/응답 데이터
4. 환경 정보
5. 스크린샷/로그 (가능한 경우)

### 문의처
- **개발팀**: [연락처]
- **프로젝트 리드**: [연락처]
- **문서 버전**: v1.0 (2025-10-02)

---

*이 가이드는 QA 팀이 HRFCO MCP 서버를 체계적으로 테스트할 수 있도록 작성되었습니다. 테스트 진행 중 발견되는 이슈나 개선사항은 즉시 보고해주세요.*
