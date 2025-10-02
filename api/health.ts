import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function health(req: VercelRequest, res: VercelResponse) {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    runtime: 'vercel',
    api_keys: {
      hrfco: !!process.env.HRFCO_API_KEY,
    },
  };

  return res.status(200).json(healthData);
}
