# HRFCO MCP Server 로컬 QA 가이드

## 📋 목차
1. [로컬 환경 설정](#로컬-환경-설정)
2. [서버 실행](#서버-실행)
3. [QA 테스트 수행](#qa-테스트-수행)
4. [자동화된 QA 스크립트](#자동화된-qa-스크립트)
5. [결과 분석 및 보고](#결과-분석-및-보고)

---

## 🛠️ 로컬 환경 설정

### 필수 요구사항
- **Node.js**: 18.0 이상
- **npm**: 최신 버전
- **netlify-cli**: 전역 설치

### 1. 의존성 설치
```bash
# 프로젝트 의존성 설치
npm install

# Netlify CLI 설치 (전역)
npm install -g netlify-cli
```

### 2. 환경변수 설정
```bash
# .env 파일 생성
cp .env.example .env

# .env 파일에 API 키 설정
echo "HRFCO_API_KEY=your_api_key_here" >> .env
```

### 3. 빌드 확인
```bash
# TypeScript 컴파일
npm run build

# 빌드 결과 확인
ls -la dist/netlify/functions/
```

---

## 🚀 서버 실행

### 로컬 개발 서버 시작
```bash
# Netlify Functions 로컬 실행
npm run dev
```

**성공 표시:**
```
Netlify Dev server is listening on http://localhost:8888
┌─────────────────────────────────────────────────┐
│                                                 │
│   Functions:                                    │
│   • http://localhost:8888/.netlify/functions/health │
│   • http://localhost:8888/.netlify/functions/mcp    │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 서버 상태 확인
```bash
# 헬스체크
curl http://localhost:8888/.netlify/functions/health
```

**예상 응답:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-02T20:10:00.000Z",
  "version": "1.0.0",
  "runtime": "netlify-dev",
  "api_keys": {
    "hrfco": true
  }
}
```

---

## 🧪 QA 테스트 수행

### 테스트 환경 정보
- **로컬 서버 URL**: `http://localhost:8888/.netlify/functions/mcp`
- **테스트 도구**: curl (또는 Postman)
- **응답 검증**: 수동 확인 또는 자동화 스크립트

### 기본 테스트 명령어 템플릿
```bash
curl -X POST http://localhost:8888/.netlify/functions/mcp \
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

## 📋 상세 테스트 케이스

### TC_001: 도구 목록 조회
**우선순위**: 높음
```bash
curl -X POST http://localhost:8888/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}'
```

**성공 기준:**
- HTTP 200 응답
- 5개 도구 반환 (tools 배열)
- 각 도구에 name, description, inputSchema 포함

### TC_002: 통합 검색 (get_water_info)
**우선순위**: 높음
```bash
curl -X POST http://localhost:8888/.netlify/functions/mcp \
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

**성공 기준:**
- 'Invalid Date' 미표시
- 정상적인 날짜 형식 (예: "2025. 10. 2. 오후 12:57:54")
- 관련 관측소 정보 포함

### TC_003: 직접 수위 조회 (get_water_level)
**우선순위**: 높음
```bash
curl -X POST http://localhost:8888/.netlify/functions/mcp \
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

**성공 기준:**
- JSON 데이터 정상 반환
- obs_time, water_level, unit 필드 포함

### TC_004: 강우량 조회 (get_rainfall)
**우선순위**: 중간
```bash
curl -X POST http://localhost:8888/.netlify/functions/mcp \
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

### TC_005: 관측소 검색 (search_observatory)
**우선순위**: 중간
```bash
curl -X POST http://localhost:8888/.netlify/functions/mcp \
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

### TC_006: 관측소 목록 조회 (get_observatory_list)
**우선순위**: 낮음
```bash
curl -X POST http://localhost:8888/.netlify/functions/mcp \
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

### TC_007: 없는 관측소 검색
```bash
curl -X POST http://localhost:8888/.netlify/functions/mcp \
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

**기대 결과:** "찾을 수 없습니다" 에러 메시지

### TC_008: 잘못된 관측소 코드
```bash
curl -X POST http://localhost:8888/.netlify/functions/mcp \
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

### TC_009: 파라미터 누락 (개선사항 확인)
```bash
curl -X POST http://localhost:8888/.netlify/functions/mcp \
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

**개선사항 확인:** 명확한 에러 메시지 반환
```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "error": {
    "code": -32602,
    "message": "필수 파라미터 \"arguments\"가 누락되었습니다."
  }
}
```

### TC_010: 잘못된 JSON-RPC 형식
```bash
curl -X POST http://localhost:8888/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{"invalid": "jsonrpc format"}'
```

---

## 🤖 자동화된 QA 스크립트

### 자동 QA 실행 스크립트
```bash
#!/bin/bash
# run-qa.sh

echo "🧪 HRFCO MCP Server 로컬 QA 자동 실행"
echo "========================================"

BASE_URL="http://localhost:8888/.netlify/functions/mcp"

# TC_001: 도구 목록
echo "TC_001: 도구 목록 조회"
curl -s -X POST $BASE_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' \
  | jq '.result.tools | length'
echo ""

# TC_002: 통합 검색
echo "TC_002: 통합 검색 (대청댐)"
curl -s -X POST $BASE_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "get_water_info", "arguments": {"query": "대청댐"}}}' \
  | jq '.result.content[0].text' | grep -o "Invalid Date" || echo "✅ Invalid Date 없음"
echo ""

# TC_009: 파라미터 누락 에러
echo "TC_009: 파라미터 누락 에러"
curl -s -X POST $BASE_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 9, "method": "tools/call", "params": {"name": "get_water_info"}}' \
  | jq '.error.message'
echo ""

echo "🎉 QA 완료"
```

### 스크립트 실행
```bash
# 실행 권한 부여
chmod +x run-qa.sh

# QA 실행
./run-qa.sh
```

---

## 📊 결과 분석 및 보고

### 테스트 결과 템플릿
```markdown
# 로컬 QA 테스트 보고서

## 테스트 환경
- **날짜**: YYYY-MM-DD
- **서버**: 로컬 Netlify Dev (http://localhost:8888)
- **테스터**: [이름]

## 테스트 결과 요약
- **총 테스트 케이스**: 10개
- **통과**: X개 (XX%)
- **실패**: X개 (XX%)

## 상세 결과

### ✅ 통과 케이스
| TC_ID | 테스트명 | 결과 | 비고 |
|-------|----------|------|------|
| TC_001 | 도구 목록 | ✅ | 5개 도구 정상 반환 |
| TC_002 | 통합 검색 | ✅ | Invalid Date 문제 해결 |

### ❌ 실패 케이스
| TC_ID | 테스트명 | 결과 | 문제점 | 해결방안 |
|-------|----------|------|--------|----------|
| TC_XXX | 테스트명 | ❌ | 문제 설명 | 해결 계획 |

## 개선사항 검증
- [x] 날짜 파싱 로직 개선
- [x] 파라미터 유효성 검사 강화
- [ ] JSON 응답 형식 최적화 (향후 개선)

## 결론 및 권장사항
[테스트 결과를 바탕으로 한 결론과 다음 단계 권장사항]
```

### 성능 측정
```bash
# 응답 시간 측정
time curl -s -X POST http://localhost:8888/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' \
  > /dev/null
```

---

## 🔧 문제 해결

### 일반적인 문제들

#### 1. 서버 시작 실패
```bash
# 포트 충돌 확인
lsof -i :8888

# 포트 변경
npx netlify dev --port 9999
```

#### 2. API 키 미설정
```bash
# 환경변수 확인
echo $HRFCO_API_KEY

# .env 파일 재설정
echo "HRFCO_API_KEY=your_actual_key" > .env
```

#### 3. 빌드 실패
```bash
# 캐시 삭제 후 재빌드
rm -rf node_modules/.cache
npm run build
```

#### 4. 함수 호출 실패
```bash
# 로그 확인
npm run dev 2>&1 | grep -i error

# 함수 파일 확인
ls -la dist/netlify/functions/
```

---

## 📞 지원 및 문의

### 버그 리포트
버그 발견 시 다음 정보를 포함하여 보고해주세요:
1. 테스트 케이스 ID
2. 재현 단계 (명령어)
3. 요청/응답 데이터
4. 환경 정보 (Node.js 버전, OS 등)
5. 로그 출력 (가능한 경우)

### 로그 수집
```bash
# 서버 로그 확인
npm run dev 2>&1 | tee server.log

# API 호출 로그 확인
curl -v -X POST http://localhost:8888/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}'
```

---

*이 가이드는 로컬 환경에서 HRFCO MCP 서버의 QA를 체계적으로 수행할 수 있도록 작성되었습니다. 프로덕션 배포 전 반드시 로컬 QA를 완료해주세요.*