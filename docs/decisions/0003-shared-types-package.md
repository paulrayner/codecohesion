# ADR 0003: Shared Types Package

## Status

Accepted

## Context

Types were manually duplicated across `processor/src/types.ts`, `viewer/src/types.ts`, and `api/src/types.ts`. A `scripts/check-types-sync.ts` script validated they stayed in sync, but this was fragile and easy to forget.

## Decision

Extract the 8 shared interfaces (`FileNode`, `DirectoryNode`, `TreeNode`, `RepositorySnapshot`, `TimelineData`, `CommitSnapshot`, `DrillDownLayer`, `TimelineDataV2`) into `packages/shared-types/` as an npm workspace package `@codecohesion/shared-types`.

- **Processor**: imports changed from `./types` to `@codecohesion/shared-types`
- **API**: `types.ts` re-exports shared types and retains API-specific types (`Link`, `ErrorResponse`, etc.)
- **Viewer**: `types.ts` becomes a re-export shim, preserving all 29+ existing `from './types'` / `from '../types'` import paths untouched

No build step needed — `"main": "src/index.ts"` works because consumers use ts-node or Vite.

## Consequences

- Single source of truth for shared types
- `scripts/check-types-sync.ts` deleted — no longer needed
- `processor/src/types.ts` deleted — canonical copy is now in `packages/shared-types/src/index.ts`
- Adding a new shared type requires editing only one file
