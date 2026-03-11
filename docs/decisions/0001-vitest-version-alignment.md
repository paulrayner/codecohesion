# ADR 0001: Vitest Version Alignment

## Status

Accepted

## Context

The three packages used different Vitest versions:
- `viewer/`: `^4.0.4`
- `processor/`: `^1.6.0`
- `api/`: `^1.0.4`

This fragmentation would cause version conflicts when wiring npm workspaces (M2), since hoisted dependencies must resolve to compatible versions.

## Decision

Upgrade `processor` and `api` to `vitest: ^4.0.4` (and `@vitest/ui: ^4.0.4` for api) to match the viewer.

## Consequences

- All three packages now use Vitest v4.x, enabling dependency hoisting under npm workspaces.
- No test changes were required — all existing tests pass on v4.
- The 3 pre-existing failures in `viewer/src/ForceDirectedLayoutStrategy.test.ts` are TDD red-gate tests unrelated to this change.
