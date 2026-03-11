# ADR 0004: Processor Library Extraction

## Status

Accepted

## Context

The processor was a standalone CLI tool. All analyzers had hardcoded `console.log` calls and `RepositoryAnalyzer` used `fs.statSync`/`fs.readFileSync` directly. This made the processor unimportable as a library for the API, CLI, or future MCP server.

## Decision

1. **Logger injection**: Created `Logger` interface with `silentLogger` and `consoleLogger` implementations. All analyzers accept an optional `logger` parameter (defaults to `consoleLogger` for backward compatibility).

2. **FileReader injection**: Created `FileReader` interface with `nodeFileReader` implementation. `RepositoryAnalyzer` accepts an optional `fileReader` parameter.

3. **Barrel export**: Created `processor/src/index.ts` exporting all public APIs. Updated `package.json` main to `dist/index.js`.

4. **CLI extraction**: Moved `main()` from `analyze.ts` to `cli.ts`. The `analyze.ts` file is now a pure library module with no `process.exit`, `fs.writeFile`, or arg parsing.

## Consequences

- Processor is importable: `const { RepositoryAnalyzer, silentLogger } = require('codecohesion-processor')`
- Existing CLI usage unchanged: `npm run dev` now runs `cli.ts`
- Callers can suppress output with `silentLogger` or provide custom loggers
- `RepositoryAnalyzer` can be used in environments without a real filesystem via custom `FileReader`
