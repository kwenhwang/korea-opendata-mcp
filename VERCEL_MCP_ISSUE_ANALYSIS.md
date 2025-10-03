# 🔍 Vercel MCP 서버 툴리스트 문제 분석 및 개선 계획

## 📋 문제 상황
- **Netlify 배포 시**: 툴리스트 정상 작동 ✅
- **Vercel 배포 시**: 툴리스트가 안 나옴 ❌
- **현재 상태**: API는 정상 응답하지만 Gemini에서 인식 안됨

## 🔍 원인 분석

### 1. 실제 테스트 결과
```bash
# 툴리스트 조회 - 정상 응답 ✅
curl -X POST https://hrfco-mcp-lctuob0og-kewns-projects.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# 응답: 5개 도구 정상 반환
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {"name": "get_water_level", "description": "실시간 수위 데이터 조회"},
      {"name": "get_rainfall", "description": "실시간 강우량 데이터 조회"},
      {"name": "get_observatory_list", "description": "관측소 목록 조회"},
      {"name": "search_observatory", "description": "관측소 검색"},
      {"name": "get_water_info", "description": "관측소 검색 및 실시간 수위 데이터 통합 조회"}
    ]
  }
}
```

### 2. 핵심 문제점 식별

#### 2.1 MCP 프로토콜 호환성 문제
**문제**: Gemini가 MCP 서버를 인식하지 못함
- **원인 1**: MCP 프로토콜 버전 불일치
- **원인 2**: 초기화(initialize) 응답 형식 문제
- **원인 3**: CORS 설정 부족

#### 2.2 현재 초기화 응답 분석
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {}  // ← 문제: 빈 객체
    },
    "serverInfo": {
      "name": "hrfco-mcp-ts",
      "version": "1.0.0"
    }
  }
}
```

**문제점**: `capabilities.tools`가 빈 객체 `{}`로 되어 있음

#### 2.3 Netlify vs Vercel 차이점
| 항목 | Netlify | Vercel | 영향 |
|------|---------|--------|------|
| 함수 런타임 | Node.js 18 | Node.js 20 | 미미 |
| 빌드 프로세스 | 자동 | TypeScript 컴파일 필요 | 중간 |
| 환경변수 | 자동 주입 | 수동 설정 | 높음 |
| CORS 처리 | 기본 지원 | 수동 설정 | 높음 |
| MCP 프로토콜 | 정상 작동 | 호환성 문제 | 높음 |

## 🎯 개선 계획

### Phase 1: 즉시 수정 (High Priority)

#### 1.1 MCP 프로토콜 초기화 수정
```typescript
// 현재 (문제)
capabilities: {
  tools: {}
}

// 수정 후 (올바른 형식)
capabilities: {
  tools: {
    listChanged: true
  }
}
```

#### 1.2 CORS 헤더 강화
```typescript
// 현재
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

// 수정 후
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
res.setHeader('Access-Control-Max-Age', '86400');
```

#### 1.3 MCP 프로토콜 버전 확인
- Gemini가 지원하는 MCP 프로토콜 버전 확인
- 필요시 버전 다운그레이드

### Phase 2: 구조적 개선 (Medium Priority)

#### 2.1 Vercel 설정 최적화
```json
// vercel.json 생성
{
  "functions": {
    "api/mcp.ts": {
      "runtime": "@vercel/node@3.0.7"
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, OPTIONS, PUT, DELETE"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "Content-Type, Authorization, X-Requested-With"
        }
      ]
    }
  ]
}
```

#### 2.2 환경변수 검증 강화
```typescript
// 환경변수 검증 로직 추가
if (!process.env.HRFCO_API_KEY) {
  throw new Error('HRFCO_API_KEY is required');
}
```

#### 2.3 로깅 시스템 추가
```typescript
// 디버깅을 위한 로깅
console.log('MCP Request:', JSON.stringify(request, null, 2));
console.log('MCP Response:', JSON.stringify(response, null, 2));
```

### Phase 3: 모니터링 및 테스트 (Low Priority)

#### 3.1 헬스체크 엔드포인트 강화
```typescript
// /api/health 엔드포인트에 MCP 상태 포함
{
  "status": "healthy",
  "mcp": {
    "protocolVersion": "2024-11-05",
    "toolsCount": 5,
    "capabilities": ["tools"]
  },
  "timestamp": "2025-10-03T02:07:58Z"
}
```

#### 3.2 자동화된 테스트 스위트
```bash
# MCP 프로토콜 테스트 스크립트
./test-mcp-protocol.sh
```

## 🚀 실행 계획

### Step 1: 즉시 수정 (30분)
1. MCP 핸들러 초기화 응답 수정
2. CORS 헤더 강화
3. 환경변수 검증 추가

### Step 2: 테스트 및 배포 (15분)
1. 로컬 테스트
2. Vercel 재배포
3. Gemini에서 MCP 등록 테스트

### Step 3: 검증 (15분)
1. 툴리스트 조회 확인
2. 도구 호출 테스트
3. 성능 모니터링

## 📊 예상 결과

### 수정 전
- ❌ Gemini에서 MCP 서버 인식 실패
- ❌ 툴리스트 조회 불가
- ❌ 도구 호출 불가

### 수정 후
- ✅ Gemini에서 MCP 서버 정상 인식
- ✅ 툴리스트 조회 성공
- ✅ 모든 도구 호출 가능
- ✅ Netlify 수준의 안정성 달성

## 🔧 기술적 세부사항

### MCP 프로토콜 요구사항
```typescript
interface MCPCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
}
```

### Gemini MCP 등록 명령어
```bash
gemini mcp add --transport http HRFCO_Water https://hrfco-mcp-lctuob0og-kewns-projects.vercel.app/api/mcp
```

---

**분석 완료**: 2025년 10월 3일  
**다음 단계**: 즉시 수정 실행