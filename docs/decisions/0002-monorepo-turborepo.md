# ADR 0002: npm Workspaces + Turborepo

## Status

Accepted

## Context

The three packages (`processor/`, `viewer/`, `api/`) were independently managed with separate `node_modules` and lockfiles. This made it impossible to share code via workspace packages and required manual dependency management.

## Decision

- Add `workspaces` to root `package.json` pointing to `processor`, `viewer`, `api`, and `packages/*`
- Add Turborepo for task orchestration (`turbo run test`, `turbo run build`, etc.)
- Delete per-package `package-lock.json` files; root lockfile manages all
- Use `"^build"` dependency for test tasks (upstream builds only, not own build) because the viewer's `tsc` has pre-existing type errors in `main.ts` while vitest transpiles independently

## Consequences

- `npm install` from root installs all workspace dependencies with hoisting
- `npx turbo run test` runs tests across all packages in parallel
- Individual `cd package && npm test` workflows continue to work
- New shared packages can be added under `packages/` and referenced via `workspace:*`
- Per-package lockfiles are removed; only the root lockfile exists
