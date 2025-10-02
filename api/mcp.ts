import type { Handler } from '@netlify/functions';
import { MCPHandler } from '../src/lib/mcp-handler';
import { MCPRequest } from '../src/lib/types';

const handler = new MCPHandler();

const mcp: Handler = async (event) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'HRFCO MCP Server (TypeScript)',
        version: '1.0.0',
        endpoints: {
          mcp: '/.netlify/functions/mcp',
          health: '/.netlify/functions/health',
        },
      }),
    };
  }

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

    const response = await handler.handleRequest(mcpRequest);
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

export default mcp;
