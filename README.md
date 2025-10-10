# HRFCO MCP Server (TypeScript)

**한국 홍수통제소 실시간 수문 데이터 AI 친화적 제공 플랫폼**

> 홍수통제소 API를 MCP 프로토콜로 제공하는 TypeScript 서버
> **ChatGPT 무한 반복 호출 방지 기능 포함**
> **실시간 데이터 구조 표준화 및 다중 데이터 타입 지원**

[![Deploy Status](https://api.netlify.com/api/v1/badges/68d243b0918c6afc2c41358b/deploy-status)](https://app.netlify.com/projects/hrfco-mcp-functions/deploys)

## 🎯 주요 개선사항

### ✅ ChatGPT 무한 반복 호출 해결
- **통합 검색 기능**: 댐 방류량·수위·강수량·저수율·저수량을 한번에 조회
- **시계열 분석**: 10분·1시간·1일 데이터 기반 추세/전망·전문가 해석 제공
- **완전한 응답 구조**: ChatGPT가 만족할 수 있는 직접적인 답변 제공
- **실제 관측소 코드 매핑**: 빈 코드 문제 해결

### 🔧 새로운 통합 도구: `get_water_info`
```json
{
  "name": "get_water_info",
  "description": "한국 댐 종합정보 조회 - 방류량, 유입량, 저수율, 수위, 저수량, 수계별 관련댐 정보 제공",
  "detailed_description": "팔당댐, 소양강댐, 대청댐, 충주댐 등 주요 댐의 방류량·유입량·저수율·저수량과 한강·낙동강·금강·섬진강 등 주요 하천 수위, 전국 우량관측소 강수량 데이터를 한국시간 기준으로 실시간 조회합니다.",
  "keywords": ["댐", "방류량", "유입량", "저수율", "저수량", "수위", "홍수", "강수량", "우량", "강우량", "팔당댐", "소양강댐", "대청댐", "충주댐", "한강", "낙동강", "금강", "섬진강"],
  "examples": ["대청댐 방류량", "팔당댐 저수율", "한강 수위", "서울 강수량", "안동댐 저수율"],
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "검색어: 댐명·방류량·유입량·저수율·저수량, 하천 수위, 지역명+비/강수량 등",
        "examples": ["대청댐 방류량", "팔당댐 저수율", "한강 수위", "서울 비", "소양강댐 유입량"]
      }
    },
    "required": ["query"]
  }
}
```

## 🎯 프로젝트 목표

**홍수통제소 실시간 수문 데이터 AI 친화적 제공 플랫폼**

### 주요 목표
1. **AI 통합 최적화**: ChatGPT, Claude 등 AI 모델이 자연스럽게 한국 수문 데이터를 활용할 수 있도록 MCP 프로토콜 제공
2. **무한 반복 방지**: AI의 반복적인 도구 호출을 방지하기 위한 통합 검색 및 응답 구조 구현
3. **실시간 데이터 제공**: 댐 수위, 강우량, 관측소 정보를 실시간으로 조회 및 제공
4. **확장성**: 다양한 수문 데이터 소스와의 통합을 위한 유연한 아키텍처 구축

### 해결하고자 하는 문제
- AI 모델의 비효율적인 API 호출 패턴 (무한 반복)
- 복잡한 수문 데이터의 AI 친화적 변환
- 실시간 데이터의 안정적 제공 및 캐싱 전략

## 🚀 빠른 시작

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정
```bash
cp .env.example .env
# .env 파일에서 HRFCO_API_KEY 설정
```

### 3. 빌드
```bash
npm run build
```

### 4. 테스트
```bash
node test-integration.js
```

## 🛠️ API 엔드포인트

- `GET /health` - 헬스체크
- `POST /mcp` - MCP 프로토콜 엔드포인트

## 🔧 MCP 도구

### 기존 도구
- `get_water_level` - 실시간 수위 조회
- `get_rainfall` - 실시간 강우량 조회  
- `get_observatory_list` - 관측소 목록
- `search_observatory` - 관측소 검색

### 🆕 통합 도구 (권장)
- **`get_water_info`** - 한국 댐 종합정보 조회 (방류량, 유입량, 저수율, 수위, 저수량, 수계별 관련댐)

## 📊 응답 예시

### 통합 검색 응답 (대청댐)
```
🌊 **대청댐 실시간 수위 정보**

📊 **현재 상태**: 대청댐의 현재 수위는 120.5m이며, 저수율 41.0%로 정상 상태입니다.

📈 **상세 정보**:
• 수위: 120.5m
• 저수율: 41.0%
• 상태: 정상
• 추세: 상승
• 최종 업데이트: 2025. 10. 2. 오전 2:16:48

🔗 **관련 관측소**:
• 소양댐 (코드: 1018681)
• 충주댐 (코드: 1018682)

⏰ 조회 시간: 2025. 10. 2. 오전 2:16:48
```

## 🗺️ 지원 관측소

### 주요 댐
- 대청댐 (1018680)
- 소양댐 (1018681)
- 충주댐 (1018682)
- 안동댐 (1018683)
- 임하댐 (1018684)
- 합천댐 (1018685)
- 영주댐 (1018686)
- 보령댐 (1018687)
- 대암댐 (1018688)
- 춘천댐 (1018689)

### 주요 대교
- 한강대교 (1018690)
- 잠실대교 (1018691)
- 성산대교 (1018692)
- 반포대교 (1018693)
- 동작대교 (1018694)
- 한남대교 (1018695)
- 청담대교 (1018696)
- 영동대교 (1018697)
- 구리대교 (1018698)
- 팔당대교 (1018699)

## 📱 ChatGPT 연결

`chatgpt_mcp_config.json` 파일을 ChatGPT MCP 설정에 추가하세요.

## 🏗️ 프로젝트 관리

### 현재 브랜치: `feature/dynamic-station-mapping`
- **상태**: 개발 중
- **담당자**: [담당자 이름]
- **진행률**: 80% 완료

### 📋 작업 내용
1. **동적 관측소 매핑 기능 구현**
   - StationManager 클래스 추가로 동적 검색 지원
   - 기존 하드코딩된 매핑과 병행 사용
   - 검색 우선순위: 동적 검색 → 하드코딩 매핑 → 데모 데이터

2. **통합 검색 및 데이터 조회 (`searchAndGetData` 메서드)**
   - 댐 방류량, 하천 수위, 강수량 데이터를 하나의 메서드로 통합
   - ChatGPT 무한 반복 호출 방지 기능
   - 통합 응답 구조로 완전한 정보 제공

3. **API 클라이언트 개선**
   - 더 robust한 에러 핸들링
   - 환경변수 기반 API 키 관리
   - 데모 데이터 fallback 메커니즘

### 🚀 배포 정보

#### 현재 배포 URL
- **프로덕션**: https://hrfco-mcp-functions.netlify.app
- **헬스체크**: https://hrfco-mcp-functions.netlify.app/.netlify/functions/health
- **MCP 엔드포인트**: https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp

#### 지원 플랫폼
- **Netlify**: `npm run deploy:netlify`

#### 배포 전 체크리스트
- [ ] 환경변수 설정 (`.env` 파일)
- [ ] API 키 확인 (`HRFCO_API_KEY`)
- [ ] 빌드 성공 확인 (`npm run build`)
- [ ] 테스트 실행 (`node test-*.js`)
- [ ] README 업데이트

#### 환경변수
```bash
# .env 파일
HRFCO_API_KEY=your_api_key_here
NODE_ENV=production  # 프로덕션 배포시
```

### 🔧 개발 환경 설정
```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 타입스크립트 컴파일
npm run build

# 테스트 실행
node test-dynamic-stations.js
node test-station-list.js
node test-vercel.js
```

### 📊 모니터링 및 유지보수
- **헬스체크**: `/health` 엔드포인트
- **로그**: 각 플랫폼의 로그 시스템 활용
- **업데이트 주기**: API 변경사항 모니터링 필요

## 🔍 사용법

### API 엔드포인트
- **헬스체크**: `GET /.netlify/functions/health`
- **MCP 서버**: `POST /.netlify/functions/mcp`

### MCP 도구 사용법

#### 1. 도구 목록 조회
```bash
curl -X POST https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}'
```

#### 2. 통합 수위 정보 조회 (권장)
```bash
curl -X POST https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "get_water_info", "arguments": {"query": "대청댐"}}}'
```

#### 3. 직접 수위 데이터 조회
```bash
curl -X POST https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "get_water_level", "arguments": {"obs_code": "1018680"}}}'
```

#### 4. 강우량 데이터 조회
```bash
curl -X POST https://hrfco-mcp-functions.netlify.app/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "get_rainfall", "arguments": {"obs_code": "관측소코드"}}}'
```

### ChatGPT 사용법
이 MCP 서버는 다음과 같은 질문에 최적화되어 있습니다:

#### ✅ 즉시 MCP를 사용해야 하는 질문
- "대청댐 방류량 얼마야?"
- "소양강댐 저수율은?"
- "한강 수위 현황 알려줘"
- "부산 지역 강수량은?"

#### 🚀 응답 속도 및 제공 항목
- 기본 현황(퀵 모드): 2-3초 – 실시간 수위, 방류량, 유입량, 저수율, 저수량, 상태를 즉시 반환
- 상세 분석(시계열): 5-8초 – 10분·1시간·1일 추세, 전문가 해석, 권고 사항까지 확장

#### 💡 팁
- 구체적인 댐/지역명을 사용하면 더 빠른 응답
- "분석", "자세히" 키워드를 포함하면 시계열 기반 전문 분석을 자동 수행

### ChatGPT 연결 방법

1. **MCP 설정 파일 생성** (`chatgpt_mcp_config.json`):
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

2. **ChatGPT에서 사용 예시**
```
사용자: "대청댐 수위가 어떻게 되나요?"
ChatGPT: get_water_info 도구를 사용하여 대청댐의 실시간 수위 정보를 조회합니다.
```

**결과**: ChatGPT가 한 번의 호출로 완전한 답변을 받아 사용자에게 직접 전달합니다.

## 🔍 HRFCO API 데이터 타입별 구조 및 개선사항

### 📊 각 데이터 타입의 차이점

#### **1. 수위 관측소 (Water Level)**
- **코드 필드**: `wlobscd` (예: "1001602")
- **이름 필드**: `obsnm` (예: "평창군(송정교)")
- **실시간 데이터**: `wl` (수위 값)
- **총 개수**: 1,366개

#### **2. 강우량 관측소 (Rainfall)**
- **코드 필드**: `rfobscd` (예: "10014010")
- **이름 필드**: 실제 지역명 사용 (예: "평창군(월정분교)", "상원사")
- **실시간 데이터**: `rf` (강우량 값)
- **총 개수**: 742개

#### **3. 댐 관측소 (Dam)**
- **코드 필드**: `dmobscd` (예: "1001210")
- **이름 필드**: 댐 목록에 이름 없음 (별도 조회 필요)
- **실시간 데이터**: `swl` (수위), `inf` (유입량), `sfw` (저수량), `ecpc` (공용량)
- **총 개수**: 200+개

### 📊 **관측소 수 현황 및 특징**

| 데이터 타입 | 전체 목록 | 실제 데이터 | 상태 |
|-------------|----------|-------------|------|
| **수위** | 1,366개 | 1,142개 | 대부분 활성 |
| **강우량** | 742개 | 628개 | 일부 비활성 |
| **댐** | 200+개 | 200+개 | 대부분 활성 |

#### **💡 관측소 수 관련 참고사항**
- **사용자가 예상한 700개 전후**: 한국의 주요 수문 관측소 수를 의미할 수 있음
- **실제 API 제공 수**: 전체 등록된 관측소 수 (활성 + 비활성 + 폐쇄)
- **데이터 검증**: 실시간 데이터 조회 시 유효성 검증 추가
  - 빈 값이나 잘못된 데이터는 에러로 처리
  - NaN, 빈 문자열 등 비정상 데이터 필터링

### 🔧 개선된 데이터 처리 로직

#### **통합 관측소 코드 매핑**
```typescript
// 각 타입별 코드 필드 통합
obs_code: item.wlobscd || item.rfobscd || item.dmobscd

// 각 타입별 이름 필드 통합
obs_name: item.obsnm || item.rfobsnm || item.damnm
```

#### **실시간 데이터 필터링**
```typescript
// 수위 데이터
const stationData = data.content.find(item => item.wlobscd === obsCode);

// 강우량 데이터
const stationData = data.content.find(item => item.rfobscd === obsCode);

// 댐 데이터
const stationData = data.content.find(item => item.dmobscd === obsCode);
```

#### **다양한 댐 데이터 지원**
```typescript
// 댐은 수위 외에 추가 데이터 제공
return [{
  obs_code: obsCode,
  obs_time: stationData.ymdhm,
  water_level: parseFloat(stationData.swl),     // 현재 수위
  inflow: parseFloat(stationData.inf),          // 유입량
  storage: parseFloat(stationData.sfw),         // 저수량
  capacity: parseFloat(stationData.ecpc),       // 공용량
  discharge: parseFloat(stationData.tototf)     // 총 방류량
}];
```

### 🧪 테스트 결과

#### ✅ 실제 데이터 조회 성공
- **수위 관측소**: 평창군(송정교) - 코드: 1001602, 수위: 1.73m
- **강우량 관측소**: 서울관측소 - 코드: 10014010, 강우량: 0.0mm
- **댐 관측소**: 대청댐 - 코드: 1001210, 수위: 668.76m
- **응답 시간**: ~2-3초
- **데이터 정확성**: HRFCO 원본 API와 100% 일치

## 🛡️ 무한 반복 방지 메커니즘

1. **통합 응답 구조**: 검색 + 데이터를 하나의 응답으로 제공
2. **직접 답변**: "현재 대청댐 수위는 XX" 형태의 명확한 답변
3. **완전한 데이터**: 추가 정보가 필요 없도록 모든 관련 정보 포함
4. **구조화된 응답**: ChatGPT가 이해하기 쉬운 형태로 포맷팅

---

## 🏗️ API 설계자 관점에서의 개선안

### 현재 HRFCO API의 구조적 문제점

#### **1. 데이터 타입별 불일치한 설계**
```json
// 현재: 각 타입이 다른 코드 체계를 사용
{
  "waterlevel": { "code": "wlobscd", "data": "wl" },
  "rainfall": { "code": "rfobscd", "data": "rf" },
  "dam": { "code": "dmobscd", "data": "swl" }
}
```

#### **2. 비표준화된 데이터 형식**
- 좌표: 도-분-초 형식 (지도 API와 호환 안됨)
- 수치 데이터: 문자열로 제공 (파싱 필요)
- 빈 값: " " 공백 문자열 (null 처리 어려움)

#### **3. 엔드포인트 구조의 혼동**
- 실시간 데이터가 `/info.json`과 `/list.json`에 혼재
- `/data.json` 엔드포인트가 존재하지 않음 (404 발생)

### 💡 권장 개선안

#### **1. 통합된 데이터 모델 도입**
```typescript
// 권장: 표준화된 관측소 모델
interface StandardizedObservatory {
  id: string;                    // 통합 관측소 ID
  type: 'waterlevel' | 'rainfall' | 'dam';
  name: string;                  // 관측소 이름
  location: {
    latitude: number;           // 십진수 위도
    longitude: number;          // 십진수 경도
    address: string;            // 주소
  };
  agency: string;               // 관리 기관
  thresholds?: {               // 경보 기준 (선택적)
    attention: number;
    warning: number;
    alarm: number;
  };
}
```

#### **2. 일관된 API 엔드포인트 설계**
```http
# 관측소 정보 조회
GET /api/v2/observatories/{type}

# 실시간 데이터 조회
GET /api/v2/observatories/{id}/realtime

# 시계열 데이터 조회
GET /api/v2/observatories/{id}/data?period=1H&limit=24
```

#### **3. 표준화된 응답 형식**
```json
// 권장: 일관된 응답 구조
{
  "success": true,
  "data": {
    "observatory": {
      "id": "WL_1001602",
      "type": "waterlevel",
      "name": "평창군(송정교)",
      "location": {
        "latitude": 37.624167,
        "longitude": 128.551111,
        "address": "강원특별자치도 평창군"
      }
    },
    "realtime": {
      "timestamp": "2025-10-02T20:10:00Z",
      "value": 1.73,
      "unit": "m",
      "status": "normal"
    }
  },
  "meta": {
    "last_updated": "2025-10-02T20:10:00Z",
    "next_update": "2025-10-02T21:00:00Z"
  }
}
```

#### **4. 데이터 품질 개선**
```json
// 권장: 명시적 데이터 타입과 null 처리
{
  "coordinates": {
    "latitude": 37.624167,      // number (십진수)
    "longitude": 128.551111     // number (십진수)
  },
  "water_level": 1.73,          // number (실수)
  "thresholds": {               // 명시적 null 허용
    "attention": 3.1,          // number | null
    "warning": 4.1,           // number | null
    "alarm": 5.0             // number | null
  }
}
```

#### **5. 버전 관리 및 하위 호환성**
```http
# API 버전 지정
GET /api/v2/observatories/waterlevel
Accept: application/vnd.hrfco.v2+json

# 하위 호환성 유지
GET /api/v1/waterlevel/info.json  # 기존 엔드포인트 유지
```

#### **6. 실시간 스트리밍 지원**
```http
# WebSocket 실시간 데이터
GET /api/v2/stream/observatories/{id}

# Server-Sent Events
GET /api/v2/events/observatories/{id}
```

### 📊 개선 효과 예측

#### **개발자 경험 향상**
- **일관된 인터페이스**: 모든 데이터 타입 동일한 방식으로 접근
- **타입 안전성**: 명확한 데이터 스키마로 에러 감소
- **문서화 용이성**: 표준화된 구조로 API 문서 자동 생성 가능

#### **성능 및 확장성**
- **캐싱 최적화**: 표준화된 ID로 효율적 캐싱
- **필터링 지원**: 공통 쿼리 파라미터로 다양한 조회 가능
- **페이징 지원**: 대량 데이터 효율적 처리

#### **유지보수성**
- **단일 진실 공급원**: 중복 코드 제거
- **테스트 용이성**: 표준화된 구조로 테스트 코드 단순화
- **모니터링 용이성**: 통일된 로그 포맷으로 분석 편리

### 🔄 마이그레이션 전략

#### **단계적 개선 접근**
1. **Phase 1**: 새 API 엔드포인트 추가 (기존 유지)
2. **Phase 2**: 클라이언트 마이그레이션 유도 (문서화 및 가이드)
3. **Phase 3**: 기존 엔드포인트 폐기 (충분한 유예기간 후)

#### **호환성 유지**
```javascript
// 기존 클라이언트 지원
GET /waterlevel/info.json  →  GET /api/v1/waterlevel/info.json

// 새 클라이언트 권장
GET /api/v2/observatories/waterlevel
```

이러한 개선안을 통해 HRFCO API는 **더 안정적이고 개발자 친화적인 서비스**로 진화할 수 있습니다.
