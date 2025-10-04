let handler;

try {
  handler = require('../dist/api/health').default;
} catch (error) {
  console.error('Failed to load compiled Health handler. Run `npm run build` to generate dist/api/health.js');
  throw error;
}

module.exports = handler;
