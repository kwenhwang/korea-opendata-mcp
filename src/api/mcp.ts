import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MCPHandler } from '../lib';
import type { MCPRequest } from '../lib';

// 환경변수 검증
if (!process.env.HRFCO_API_KEY) {
  console.error('❌ HRFCO_API_KEY 환경변수가 설정되지 않았습니다.');
}
if (!process.env.PUBLIC_DATA_API_KEY) {
  console.warn('⚠️ PUBLIC_DATA_API_KEY 환경변수가 설정되지 않았습니다. 일부 공공데이터포털 연동이 동작하지 않을 수 있습니다.');
}

const toolsMetadata = {
  name: 'Korea Water Data MCP',
  description: '한국 수자원 통합 정보 시스템 - 댐 방류량, 수위 모니터링, 강수량 실시간 조회',
  capabilities: [
    '실시간 댐 정보: 방류량, 유입량, 저수율, 저수량',
    '하천 수위 및 홍수 경보 단계 모니터링',
    '전국 강수량·우량 관측 데이터 수집',
    '주요 댐: 팔당댐, 소양강댐, 대청댐, 충주댐 등 지원',
    '주요 하천: 한강, 낙동강, 금강, 섬진강 등 지원',
  ],
};

const mcpHandler = new MCPHandler();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 헤더 설정 (강화)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Content-Type', 'application/json');

  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // GET 요청 처리 (헬스체크)
  if (req.method === 'GET') {
    res.status(200).json({
      message: 'KoreaOpenData MCP Server (TypeScript) - Vercel',
      version: '1.0.0',
      endpoints: {
        mcp: '/api/mcp',
        health: '/api/health',
      },
      toolsMetadata,
      features: [
        '실시간 댐 방류량·유입량·저수율 조회',
        '하천 수위 및 홍수 경보 단계 제공',
        '전국 강수량·우량 관측 데이터 조회',
        'ChatGPT 무한 반복 호출 방지 로직',
        '관측소 코드 자동 매핑 및 통합 분석',
        '아파트 실거래가 조회 (get_realestate_info)',
      ]
    });
    return;
  }

  // POST 요청 처리
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const mcpRequest: MCPRequest = req.body;

    // 디버깅을 위한 로깅
    console.log('🔍 MCP Request:', JSON.stringify(mcpRequest, null, 2));

    // 요청 검증
    if (!mcpRequest.jsonrpc || !mcpRequest.method) {
      res.status(400).json({
        jsonrpc: '2.0',
        id: mcpRequest.id || null,
        error: {
          code: -32600,
          message: 'Invalid Request',
        },
      });
      return;
    }

    const response = await mcpHandler.handleRequest(mcpRequest);
    
    // 응답 로깅
    console.log('✅ MCP Response:', JSON.stringify(response, null, 2));
    
    res.status(200).json(response);

  } catch (error) {
    console.error('MCP Handler Error:', error);

    res.status(500).json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: 'Internal error',
      },
    });
  }
}
