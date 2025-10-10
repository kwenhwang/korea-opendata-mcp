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
    service: 'KoreaOpenData MCP Server',
    version: '1.0.0',
    environment: 'vercel',
    features: [
      '실시간 댐 방류량·유입량·저수율 조회',
      '하천 수위 및 홍수 경보 단계 제공',
      '전국 강수량·우량 관측 데이터 조회',
      'ChatGPT 무한 반복 호출 방지 로직',
      '관측소 코드 자동 매핑 및 통합 분석',
      '아파트 실거래가 조회 (get_realestate_info)'
    ]
  });
}
