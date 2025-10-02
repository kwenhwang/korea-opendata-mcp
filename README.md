# HRFCO MCP Server (TypeScript)

홍수통제소 API를 MCP 프로토콜로 제공하는 TypeScript 서버 - **ChatGPT 무한 반복 호출 방지 기능 포함**

## 🎯 주요 개선사항

### ✅ ChatGPT 무한 반복 호출 해결
- **통합 검색 기능**: 관측소 검색 + 실시간 데이터 조회를 한번에 처리
- **완전한 응답 구조**: ChatGPT가 만족할 수 있는 직접적인 답변 제공
- **실제 관측소 코드 매핑**: 빈 코드 문제 해결

### 🔧 새로운 통합 도구: `get_water_info`
```json
{
  "name": "get_water_info",
  "description": "관측소 검색 및 실시간 수위 데이터 통합 조회 (ChatGPT 무한 반복 방지용)",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "검색어 (관측소명, 하천명, 위치)"
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
- **`get_water_info`** - 관측소 검색 + 실시간 데이터 통합 조회

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
   - 관측소 검색 + 실시간 데이터 조회를 하나의 메서드로 통합
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

### ChatGPT에서 사용 예시
```
사용자: "대청댐 수위가 어떻게 되나요?"
ChatGPT: get_water_info 도구를 사용하여 대청댐의 실시간 수위 정보를 조회합니다.
```

**결과**: ChatGPT가 한 번의 호출로 완전한 답변을 받아 사용자에게 직접 전달합니다.

## 🛡️ 무한 반복 방지 메커니즘

1. **통합 응답 구조**: 검색 + 데이터를 하나의 응답으로 제공
2. **직접 답변**: "현재 대청댐 수위는 XX" 형태의 명확한 답변
3. **완전한 데이터**: 추가 정보가 필요 없도록 모든 관련 정보 포함
4. **구조화된 응답**: ChatGPT가 이해하기 쉬운 형태로 포맷팅
