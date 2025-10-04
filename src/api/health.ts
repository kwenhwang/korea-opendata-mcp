import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function health(req: VercelRequest, res: VercelResponse) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'HRFCO MCP Server',
    version: '1.0.0',
    environment: 'vercel',
    features: [
      '통합 검색 기능 (get_water_info)',
      'ChatGPT 무한 반복 호출 방지',
      '실시간 수위 데이터 조회',
      '관측소 코드 매핑'
    ]
  });
}