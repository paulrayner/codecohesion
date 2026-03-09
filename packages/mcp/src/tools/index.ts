import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Registers all CodeCohesion MCP tools on the given server instance.
 *
 * Each tool will be extracted into its own file under src/tools/ (< 200 LOC)
 * as the surface area grows. This function acts as the single registration
 * entry point so index.ts stays focused on transport setup.
 */
export function registerTools(server: McpServer): void {
  // Tool registrations are added here as individual tool modules are
  // implemented. Each module exports a register(server) function and is
  // called from this function to keep each file under the 200 LOC limit.
  //
  // Example (once implemented):
  //   registerAnalyzeTool(server);
  //   registerSnapshotTool(server);

  // Placeholder: expose a no-op ping tool so the server validates cleanly
  // during initial scaffold verification.
  server.tool(
    'ping',
    'Returns a pong response to verify the MCP server is reachable.',
    {},
    async () => ({
      content: [{ type: 'text' as const, text: 'pong' }],
    }),
  );
}
