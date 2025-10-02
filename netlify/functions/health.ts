import type { Handler } from '@netlify/functions';

export const health: Handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'HRFCO MCP Server',
      version: '1.0.0',
      environment: 'netlify',
      features: [
        '통합 검색 기능 (get_water_info)',
        'ChatGPT 무한 반복 호출 방지',
        '실시간 수위 데이터 조회',
        '관측소 코드 매핑'
      ]
    }),
  };
};