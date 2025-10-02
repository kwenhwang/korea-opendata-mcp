import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MCPHandler } from '../src/lib/mcp-handler';
import { MCPRequest } from '../src/lib/types';

const handler = new MCPHandler();

export default async function mcpEndpoint(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      message: 'HRFCO MCP Server (TypeScript)',
      version: '1.0.0',
      endpoints: {
        mcp: '/api/mcp',
        health: '/api/health',
      },
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const mcpRequest: MCPRequest = req.body;
    
    // 요청 검증
    if (!mcpRequest.jsonrpc || !mcpRequest.method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        id: mcpRequest.id || null,
        error: {
          code: -32600,
          message: 'Invalid Request',
        },
      });
    }

    const response = await handler.handleRequest(mcpRequest);
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('MCP Handler Error:', error);
    
    return res.status(500).json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: 'Internal error',
      },
    });
  }
}
