import type { Handler } from '@netlify/functions';

const health: Handler = async (event) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    runtime: 'netlify',
    api_keys: {
      hrfco: !!process.env.HRFCO_API_KEY,
    },
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(healthData),
  };
};

export default health;
