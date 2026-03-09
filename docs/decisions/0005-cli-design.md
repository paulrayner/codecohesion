# ADR 0005: CLI Package Design

## Status

Accepted

## Context

There was no unified entry point for the full CodeCohesion workflow. Users had to `cd` into each package and run separate scripts. The processor CLI was embedded in `analyze.ts`, mixing library code with arg parsing.

## Decision

Create `packages/cli/` (`@codecohesion/cli`) with three subcommands:

- `codecohesion analyze <path>` — runs any analysis mode (`--timeline`, `--full-delta`, `--coupling`)
- `codecohesion view` — spawns the Vite dev server for the viewer
- `codecohesion serve` — spawns the API server

The CLI imports `codecohesion-processor` as a workspace library dependency and calls analyzers directly. No CLI framework — simple `process.argv` parsing is sufficient for 3 subcommands.

The `--coupling` flag chains full-delta + coupling analysis automatically, eliminating the previous two-step manual workflow.

## Consequences

- Single entry point for all CodeCohesion operations
- Processor is consumed as a library (validating M4)
- `view` and `serve` delegate to child processes in the existing package directories
- Can be extended with `commander` if subcommand complexity grows
