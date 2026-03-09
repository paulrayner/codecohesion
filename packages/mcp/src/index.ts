#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/index.js';

const SERVER_NAME = 'codecohesion';
const SERVER_VERSION = '0.1.0';

async function main(): Promise<void> {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerTools(server);

  // Stdio transport: Claude Desktop and other MCP clients communicate via
  // stdin/stdout. No HTTP listener is required.
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  // Write to stderr so the error is visible in client logs without
  // corrupting the stdio MCP protocol stream on stdout.
  process.stderr.write(`Fatal error starting MCP server: ${(error as Error).message}\n`);
  process.exit(1);
});
