# ADR 0006: API LRU Cache

## Status

Accepted

## Context

Every API request re-reads JSON from disk via `DataLoader.loadRepoFile()`. For large timeline files (full-delta format can be 10+ MB), this adds unnecessary latency. The MCP server (Phase 3) will increase request volume further.

## Decision

Add a hand-rolled LRU cache (~50 lines) using `Map`'s insertion-order guarantee. No external dependency.

- `LRUCache<K, V>` with configurable `maxSize`
- Integrated into `DataLoader` with `maxSize=20` (covers typical deployment with 5-15 repos)
- Cache key is the filename; cache value is the parsed JSON
- `listRepos()` is not cached (cheap directory listing)

## Consequences

- Second request for the same repo is instant (no disk I/O)
- Memory bounded: at most 20 parsed JSON objects in memory
- Cache is per-process; server restart clears it
- 9 tests verify eviction, hit/miss, access-order refresh, and clear behavior
