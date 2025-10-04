import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MCPHandler } from '../lib';
import type { MCPRequest } from '../lib';

// 환경변수 검증
if (!process.env.HRFCO_API_KEY) {
  console.error('❌ HRFCO_API_KEY 환경변수가 설정되지 않았습니다.');
}

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
      message: 'HRFCO MCP Server (TypeScript) - Vercel',
      version: '1.0.0',
      endpoints: {
        mcp: '/api/mcp',
        health: '/api/health',
      },
      features: [
        '통합 검색 기능 (get_water_info)',
        'ChatGPT 무한 반복 호출 방지',
        '실시간 수위 데이터 조회',
        '관측소 코드 매핑'
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
