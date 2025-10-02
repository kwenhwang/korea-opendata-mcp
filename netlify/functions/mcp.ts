import type { Handler } from '@netlify/functions';
import { MCPHandler } from '../../src/lib/mcp-handler';
import { MCPRequest } from '../../src/lib/types';

const mcpHandler = new MCPHandler();

export const handler: Handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // OPTIONS 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // GET 요청 처리 (헬스체크)
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'HRFCO MCP Server (TypeScript) - Netlify Functions',
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
      }),
    };
  }

  // POST 요청 처리
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const mcpRequest: MCPRequest = JSON.parse(event.body || '{}');
    
    // 요청 검증
    if (!mcpRequest.jsonrpc || !mcpRequest.method) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: mcpRequest.id || null,
          error: {
            code: -32600,
            message: 'Invalid Request',
          },
        }),
      };
    }

    const response = await mcpHandler.handleRequest(mcpRequest);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
    
  } catch (error) {
    console.error('MCP Handler Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: 'Internal error',
        },
      }),
    };
  }
};