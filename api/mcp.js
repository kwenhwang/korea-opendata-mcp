let handler;

try {
  handler = require('../dist/api/mcp').default;
} catch (error) {
  console.error('Failed to load compiled MCP handler. Run `npm run build` to generate dist/api/mcp.js');
  throw error;
}

module.exports = handler;
