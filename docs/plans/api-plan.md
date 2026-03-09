# CodeCohesion API - Remaining Plan

**Original Plan Date:** 2025
**Status:** Milestones 0-1 complete. API evolved differently than originally planned.

**What's been built (v0.9.0):**
- Express API on port 3001 with CORS, error handling
- `GET /api/repos`, `GET /api/repos/:repoId/stats`, `GET /api/repos/:repoId/files`
- `POST /api/process` — runs processor as library with SSE progress streaming
- `GET /api/process/:jobId/progress` — real-time SSE progress
- LRU cache for API response caching
- Processor-as-library integration (no CLI shelling)
- Supports local paths and GitHub URLs (auto-clones)
- Writes output to `viewer/public/data/` and updates `repos.json`
- Test fixtures in `api/test/data/`

**Key divergence from original plan:** On-demand analysis (originally M3) was implemented early via `POST /api/process` with SSE streaming, without PostgreSQL or Redis. The processor-as-library pattern (originally M3) was done as part of the monorepo migration.

---

## Milestone 2: Query & Filter Features (Partially Done)

### Still TODO
- [ ] `findRepoByUrl()` — lookup repo by GitHub URL
- [ ] `GET /api/repos/:repoId/contributors` with date filtering (`since`, `until`)
- [ ] `GET /api/contributors?url=<url>&days=<n>` convenience endpoint
- [ ] File filtering by path prefix and sorting by metric (churn, contributors, loc)
- [ ] `GET /api/repos/:repoId/hotspots?limit=<n>` — top N files by churn/contributors
- [ ] Query parameter validation with 400 responses

---

## Milestone 3: Persistence (Future)

- [ ] PostgreSQL storage for analysis results
- [ ] Database migrations and schema (`repos`, `files`, `contributors`, `analysis_jobs`)
- [ ] Cache headers (`Cache-Control`, `ETag`)

**Note:** On-demand analysis via processor-as-library is already done. The remaining M3 value is persistent storage for historical comparisons.

---

## Milestone 4: Advanced Queries & Search

- [ ] Search DSL: `commitCount.gt(50) AND contributorCount.gt(5)`
- [ ] Commit comparison: `GET /api/repos/:repoId/compare?from=<commit>&to=<commit>`
- [ ] Aggregations with histograms and percentiles
- [ ] Timeline navigation endpoints
- [ ] Field selection (`?fields=path,loc,commitCount`)
- [ ] Pagination (`limit`, `offset`, `hasMore`)
- [ ] OpenAPI 3.1 spec with Swagger UI at `/api/docs`

---

## Milestone 5: Notifications & Automation

- [ ] Webhook system (register, deliver events, retry with backoff)
- [ ] Threshold alerts (notify when metrics exceed limits)
- [ ] Scheduled analysis (cron-based)
- [ ] Export formats (CSV, JSONL, Prometheus)

---

## Milestone 6: Integrations & Intelligence

- [ ] GitHub App (PR comments with churn analysis, check runs)
- [ ] Slack/Discord bot commands
- [ ] Repository health score (0-100 based on churn, contributors, coupling, stability)
- [ ] Bounded context recommendations via coupling clustering
- [ ] Prometheus metrics endpoint for Grafana/Datadog

---

## Related Documents

- [API Architecture](../api/architecture.md)
- [API Specification](../api/spec.md)
- [API Vision](../api/vision.md)
- [API Discoverability](../api/discoverability.md)
