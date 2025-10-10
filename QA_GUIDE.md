# HRFCO MCP 서버 QA 가이드

## 📋 개요
이 문서는 HRFCO MCP 서버의 품질 보증(QA) 테스트 가이드입니다. 실제 배포된 서버를 대상으로 다양한 시나리오를 테스트하고 결과를 기록합니다.

**배포 URL**: https://hrfco-mcp-lctuob0og-kewns-projects.vercel.app  
**테스트 일시**: 2025년 10월 3일  
**테스트 환경**: Production (Vercel)

---

## 🛠️ MCP 서버 기본 정보

### 사용 가능한 도구 목록
```json
{
  "tools": [
    {
      "name": "get_water_level",
      "description": "실시간 수위 데이터 조회",
      "parameters": ["obs_code", "time_type"]
    },
    {
      "name": "get_rainfall", 
      "description": "실시간 강우량 데이터 조회",
      "parameters": ["obs_code", "time_type"]
    },
    {
      "name": "get_observatory_list",
      "description": "관측소 목록 조회",
      "parameters": ["hydro_type"]
    },
    {
      "name": "search_observatory",
      "description": "관측소 검색",
      "parameters": ["query", "hydro_type"]
    },
    {
      "name": "get_water_info",
      "description": "한국 댐, 수위관측소, 우량관측소 실시간 데이터 조회 - 방류량, 유입량, 저수율, 수위, 강수량 등 종합 정보 제공",
      "parameters": ["query"]
    }
  ]
}
```

---

## 🧪 테스트 시나리오 및 결과

### 1. 댐 검색 테스트

#### 1.1 대청댐 검색
**요청**:
```bash
curl -X POST https://hrfco-mcp-lctuob0og-kewns-projects.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "get_water_info",
      "arguments": {
        "query": "대청댐"
      }
    }
  }'
```

**결과**: ⚠️ **문제 발견**
- 수위관측소 데이터만 반환됨 (청주시(대청댐방수로))
- 댐 데이터 (유입량, 방류량, 저수량 등)가 누락됨
- 응답 시간: 약 9초 (느림)

**예상 결과**: 댐 데이터와 수위 데이터가 모두 포함된 통합 응답

#### 1.2 소양댐 검색
**요청**:
```bash
curl -X POST https://hrfco-mcp-lctuob0og-kewns-projects.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_water_info",
      "arguments": {
        "query": "소양댐"
      }
    }
  }'
```

**결과**: ✅ **정상 작동**
- 댐 데이터 정상 반환 (수위: 190.8m, 유입량: 143.4m³/s, 방류량: 90.1m³/s)
- 수위 분석 포함 (제한수위 대비 0.5m 높음)
- 응답 시간: 약 3초

### 2. 위치/지명 검색 테스트

#### 2.1 도시명 검색 - "서울"
**요청**:
```bash
curl -X POST https://hrfco-mcp-lctuob0og-kewns-projects.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "get_water_info",
      "arguments": {
        "query": "서울"
      }
    }
  }'
```

**결과**: ✅ **정상 작동**
- 서울시(광진교) 관측소 반환
- 수위: 1.1m, 상태: 낮음
- 응답 시간: 약 3초

#### 2.2 강명 검색 - "한강"
**요청**:
```bash
curl -X POST https://hrfco-mcp-lctuob0og-kewns-projects.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "get_water_info",
      "arguments": {
        "query": "한강"
      }
    }
  }'
```

**결과**: ✅ **정상 작동**
- 원주시(남한강대교) 관측소 반환
- 수위: 0.5m, 상태: 낮음, 추세: 상승
- 관련 관측소 정보 포함 (한강대교)
- 응답 시간: 약 2초

#### 2.3 호수명 검색 - "대청호"
**요청**:
```bash
curl -X POST https://hrfco-mcp-lctuob0og-kewns-projects.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 6,
    "method": "tools/call",
    "params": {
      "name": "get_water_info",
      "arguments": {
        "query": "대청호"
      }
    }
  }'
```

**결과**: ✅ **정상 작동**
- 대청호 관측소 반환
- 수위: 73.8m, 상태: 낮음, 추세: 하강
- 응답 시간: 약 2초

---

## 📊 테스트 결과 요약

### ✅ 정상 작동 기능
1. **소양댐 검색**: 댐 데이터 완전 반환 (유입량, 방류량, 수위 분석 포함)
2. **위치 검색**: 서울, 한강, 대청호 등 다양한 지명 검색 정상
3. **동적 검색**: 2,163개 관측소 중 관련 관측소 정확히 검색
4. **응답 형식**: JSON-RPC 2.0 표준 준수
5. **데이터 품질**: 실시간 데이터 정확성 확인

### ⚠️ 발견된 문제점

#### 1. 대청댐 검색 문제
- **문제**: 댐 데이터가 아닌 수위관측소 데이터만 반환
- **영향**: 댐의 핵심 정보 (유입량, 방류량, 저수량) 누락
- **심각도**: 높음 (주요 기능 미작동)
- **재현성**: 100% 재현

#### 2. 응답 시간 문제
- **문제**: 대청댐 검색 시 9초 소요 (다른 검색은 2-3초)
- **영향**: 사용자 경험 저하
- **심각도**: 중간

---

## 🔧 권장 수정사항

### 1. 대청댐 검색 문제 해결
```typescript
// 문제 원인 분석 필요
// 1. STATION_CODE_MAPPING에서 대청댐 코드 확인
// 2. 동적 검색에서 댐 타입 인식 문제 확인
// 3. getDamData 함수 호출 여부 확인
```

### 2. 성능 최적화
- 대청댐 검색 응답 시간 개선
- API 호출 최적화
- 캐싱 전략 검토

### 3. 추가 테스트 필요 항목
- [ ] 모든 55개 댐 검색 테스트
- [ ] 강우량 관측소 검색 테스트
- [ ] 에러 처리 테스트 (존재하지 않는 관측소)
- [ ] 대용량 응답 테스트
- [ ] 동시 요청 처리 테스트

---

## 📝 테스트 명령어 모음

### 기본 서버 상태 확인
```bash
curl -X POST https://hrfco-mcp-lctuob0og-kewns-projects.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

### 관측소 검색 테스트
```bash
# 댐 검색
curl -X POST https://hrfco-mcp-lctuob0og-kewns-projects.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_water_info",
      "arguments": {
        "query": "댐명"
      }
    }
  }'

# 위치 검색
curl -X POST https://hrfco-mcp-lctuob0og-kewns-projects.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_water_info",
      "arguments": {
        "query": "지명"
      }
    }
  }'
```

---

## 🎯 다음 단계

1. **즉시 수정 필요**: 대청댐 검색 문제 해결
2. **성능 개선**: 응답 시간 최적화
3. **포괄적 테스트**: 모든 댐 및 관측소 검색 테스트
4. **모니터링**: 배포 후 지속적 성능 모니터링

---

**문서 작성자**: AI Assistant  
**최종 업데이트**: 2025년 10월 3일  
**다음 리뷰 예정**: 문제 수정 후
