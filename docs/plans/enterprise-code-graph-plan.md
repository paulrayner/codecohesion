# Enterprise Multi-Repo Code Intelligence Platform
## Architecture & Build Plan with Technology Recommendations

---

## 1. Vision & Problem Statement

The goal is to build an enterprise-grade code intelligence platform that combines the best ideas from GitNexus (precomputed knowledge graphs + MCP), Sourcegraph/Cody (multi-repo cross-reference at scale), LSP servers (compiler-accurate type intelligence), and the agentic search philosophy validated by Claude Code (grep/glob for freshness and simplicity). The platform should work across hundreds of repositories, dozens of languages, and thousands of developers — while also serving as a context backbone for AI coding agents.

**The core thesis**: Neither grep alone (Boris Cherny's insight) nor knowledge graphs alone (GitNexus's bet) nor LSP alone is sufficient for enterprise-scale AI-assisted development. The winning architecture is a **layered hybrid** that uses each approach where it's strongest:

- **Grep/glob** for real-time, fresh, textual search (always accurate, never stale)
- **Graph database** for structural queries (blast radius, transitive dependencies, clustering)
- **SCIP/LSP-derived indexes** for compiler-accurate type relationships (cross-repo go-to-definition)
- **Embeddings** for semantic/natural-language search (conceptual queries like "where do we handle auth?")

**References:**
- Boris Cherny on Claude Code abandoning RAG for agentic search (Latent Space podcast, May 2025; X post Feb 2026)
- GitNexus architecture: PreToolUse hooks that enrich grep/glob with graph context (github.com/abhigyanpatwari/GitNexus)
- Sourcegraph SCIP protocol design: compiler-accurate cross-repo navigation (sourcegraph.com/blog/announcing-scip)
- Hybrid architecture consensus emerging in practitioner community (vadim.blog/claude-code-no-indexing)

---

## 2. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI AGENT INTERFACE LAYER                       │
│  MCP Server  ·  LSP Bridge  ·  REST/GraphQL API  ·  Web UI      │
└──────────┬──────────┬──────────────┬──────────────┬──────────────┘
           │          │              │              │
┌──────────▼──────────▼──────────────▼──────────────▼──────────────┐
│                     QUERY ORCHESTRATOR                            │
│  Routes queries to the right engine(s), merges results,          │
│  manages confidence scoring, and formats for LLM consumption     │
└──────┬────────┬──────────┬──────────────┬───────────────┬────────┘
       │        │          │              │               │
  ┌────▼───┐ ┌──▼────┐ ┌──▼────────┐ ┌──▼──────────┐ ┌──▼───────┐
  │ Graph  │ │ Text  │ │ Precise   │ │ Semantic    │ │ Temporal │
  │ Engine │ │Search │ │ Code Nav  │ │ Search      │ │ Analysis │
  │(Struct)│ │(Fresh)│ │(SCIP/LSP) │ │(Embeddings) │ │(Git hist)│
  └────┬───┘ └──┬────┘ └──┬────────┘ └──┬──────────┘ └──┬───────┘
       │        │          │              │               │
┌──────▼────────▼──────────▼──────────────▼───────────────▼────────┐
│                     UNIFIED DATA LAYER                            │
│  Graph DB  ·  Search Index  ·  SCIP Store  ·  Vector DB  ·  Git  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                  INDEXING PIPELINE (CI/CD integrated)             │
│  Tree-sitter AST  ·  SCIP indexers  ·  Git history mining        │
│  Embedding generation  ·  Community detection  ·  Incremental    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Indexing Pipeline — The Foundation

### 3.1 Multi-Language AST Parsing

**Recommended: Tree-sitter (primary) + SCIP indexers (precision layer)**

Tree-sitter is the right foundation for polyglot AST parsing. It handles 40+ languages with a single interface, parses in milliseconds even with syntax errors, and produces concrete syntax trees that map back to exact source positions. GitNexus, Repomix, Kiro CLI, GitHub's Semantic tool, and most modern code intelligence tools have converged on Tree-sitter for exactly these reasons.

However, Tree-sitter operates at the syntactic level — it doesn't do type resolution, generic inference, or cross-file semantic analysis. For that, you need compiler-backed indexers. Sourcegraph's SCIP protocol is the best available standard here: it's a Protobuf schema with human-readable symbol IDs that's 4-5x smaller than LSIF and 10x faster to produce. SCIP indexers exist for TypeScript/JavaScript, Java/Scala/Kotlin, Go, Python, Ruby, and Rust.

**The two-tier approach:**
- **Tier 1 (fast, always available):** Tree-sitter AST parsing for all languages. Extracts functions, classes, imports, call sites, and basic dependency edges. This is your "good enough" layer that works everywhere, instantly.
- **Tier 2 (precise, CI/CD generated):** SCIP indexes produced by compiler-backed indexers during builds. These give you compiler-accurate go-to-definition, find-references, and type hierarchies across repositories.

**Alternatives considered:**
- *ast-grep*: Good for pattern matching but less mature as a full parsing infrastructure
- *ANTLR*: Powerful but requires per-language grammar maintenance; heavier than Tree-sitter
- *Language-native ASTs (Python ast, TypeScript Compiler API)*: Maximum accuracy per language but no cross-language unification

**References:**
- Tree-sitter used by GitHub's Semantic project for multi-language analysis (github.com/github/semantic/blob/main/docs/why-tree-sitter.md)
- Symflower achieved 36x parsing speedup migrating from JavaParser to Tree-sitter (symflower.com/en/company/blog/2023/parsing-code-with-tree-sitter)
- Tree-sitter vs LSP: "Tree-sitter is about understanding a file, LSP is about understanding the project" (cycode.com/blog/tips-for-using-tree-sitter-queries)
- SCIP design: "8x smaller and 3x faster to process" than LSIF per Meta's integration (sourcegraph.com/blog/announcing-scip)
- Kiro CLI: built-in Tree-sitter for 18 languages + optional LSP for precision (kiro.dev/docs/cli/code-intelligence)

### 3.2 Graph Construction

From the AST parse, construct the following node and edge types:

**Nodes:** Repository, Module/Package, File, Class/Interface/Struct, Function/Method, Variable/Constant, Type, API Endpoint, Configuration Entry

**Edges:** IMPORTS, CALLS, EXTENDS/IMPLEMENTS, RETURNS_TYPE, ACCEPTS_PARAM, DEFINED_IN, DEPENDS_ON (package-level), EXPOSES_API, CONSUMES_API

**Higher-order derived relationships (computed post-ingestion):**
- **Community clusters** via Louvain or Leiden algorithm (identifying bounded contexts / natural service boundaries)
- **Process flows** via tracing entry-point-to-exit chains (e.g., HTTP handler → service → repository → database)
- **Blast radius** via transitive closure of CALLS/IMPORTS edges with confidence decay
- **Cross-repo dependency edges** via package manifest parsing (package.json, pom.xml, go.mod, Cargo.toml) + SCIP cross-repo symbol resolution

**Reference:** GitNexus's seven-phase indexing pipeline: Structure → Parse → Imports → Calls → Heritage → Communities → Processes (github.com/abhigyanpatwari/GitNexus)

### 3.3 Git History Mining

Following CodeScene's behavioral code analysis approach, mine git history for:

- **Change frequency (churn)** per file and function
- **Temporal coupling** — files that consistently change together across commits (using Louvain clustering on co-change matrices)
- **Knowledge distribution** — which developers have authored/modified each module, and bus factor calculation
- **Code age and stability** — when each function was last meaningfully changed
- **Hotspot analysis** — intersection of high complexity and high churn (the code that matters most to fix)

This temporal layer is what separates an enterprise tool from a snapshot analyzer. CodeScene has shown that code with poor health scores has 15x more defects — but you need history to compute those scores.

**References:**
- CodeScene's behavioral analysis methodology (codescene.com/blog/code-analysis-tool)
- CodeCohesion's timeline playback and temporal coupling detection (github.com/virtualgenius/codecohesion)
- Adam Tornhill's "Your Code as a Crime Scene" methodology

### 3.4 Incremental Indexing Strategy

**The staleness problem is real** — Boris Cherny explicitly cited it as a primary reason to abandon RAG. The solution is incremental indexing tightly coupled to git events:

1. **On push/merge to main:** CI/CD job runs Tree-sitter re-parse on changed files only, updates affected graph edges, regenerates SCIP index for changed packages, recomputes embeddings for modified functions
2. **On PR creation:** Lightweight diff-based analysis — compute blast radius of proposed changes against the existing graph, surface as PR comments
3. **Nightly full rebuild:** Complete graph reconstruction + community detection + temporal coupling recalculation (these algorithms need global context)
4. **Local developer mode:** File-watcher triggers local incremental re-index on save (like GitNexus's current `--watch` behavior)

**Key design principle:** The graph should *never* be more than one commit behind on `main`. Stale data is worse than no data because it creates false confidence.

**Reference:** CocoIndex's incremental processing approach — only reprocess what has changed, using Postgres for data lineage tracking (cocoindex.io/blogs/index-code-base-for-rag)

---

## 4. Data Store Recommendations

This is the most consequential architectural decision. The platform needs four distinct storage capabilities, and the question is whether to unify them or compose specialized systems.

### 4.1 Graph Database — For Structural Queries

**Primary recommendation: KuzuDB (embedded) for developer-local; Neo4j (server) for enterprise-central**

**Why KuzuDB for local/CLI mode:**
- Embedded (in-process, no server), runs via pip/npm, supports WASM for browser
- Up to 188x faster than Neo4j on multi-hop OLAP queries in benchmarks
- Columnar storage with vectorized execution optimized for exactly the kind of analytical graph traversals code intelligence needs (blast radius = multi-hop path queries)
- Cypher query language (same as Neo4j, reuse queries across tiers)
- Built-in vector search and full-text search (reducing the need for a separate vector DB in simpler deployments)
- This is what GitNexus chose, and for good reason

**Why Neo4j for enterprise-central mode:**
- Multi-user concurrent access, RBAC, enterprise auth
- Mature ecosystem, operational tooling, monitoring
- Graph Data Science library for community detection, PageRank, shortest path at scale
- Better suited for a shared server that hundreds of developers query simultaneously

**Alternatives:**
- *FalkorDB*: Redis-based, uses GraphBLAS for graph algorithms. Good performance, but less mature Cypher support. GitLab is evaluating it as a KuzuDB replacement.
- *Memgraph*: In-memory Cypher-compatible graph DB, excellent for real-time queries, but memory-bound
- *Apache AGE*: PostgreSQL extension adding graph capabilities. Appeals if you want to keep everything in Postgres, but graph query performance doesn't match dedicated graph DBs
- *DuckDB + recursive CTEs*: For teams allergic to graph databases, DuckDB can handle moderate graph workloads with recursive SQL. Pragmatic for smaller deployments.

**References:**
- KuzuDB benchmarks: 18x faster ingestion, up to 188x faster multi-hop queries vs Neo4j (thedataquarry.com/blog/embedded-db-2)
- KuzuDB as "the DuckDB of graph databases" (datalabtechtv.com/posts/graphrag-with-kuzudb)
- GitLab's analysis of KuzuDB alternatives after deprecation concerns (gitlab.com/gitlab-org/rust/knowledge-graph/-/work_items/254)
- KuzuDB supports hundreds of millions of nodes on a single machine (blog.brightcoding.dev)

### 4.2 Search Index — For Text/Code Search

**Primary recommendation: Tantivy (embedded Rust) for local; Zoekt or OpenSearch for enterprise**

For the "grep but better" layer, you need full-text search with code-aware tokenization. The agentic search pattern (grep/glob) works because it's always fresh and exact — your search index should preserve this property while adding ranking and faceting.

**Zoekt** is Sourcegraph's trigram-based code search engine, purpose-built for searching across many repositories. It's the most battle-tested option for enterprise code search.

**Tantivy** is an embedded full-text search library in Rust (like Lucene but embeddable), suitable for the local/CLI tier where you want zero-server operation.

**Key capability:** The search index should support regex, exact match, and token-aware code search — not just semantic similarity. Boris Cherny's insight is that exact matching matters more than semantic similarity for code.

**Alternatives:**
- *Elasticsearch/OpenSearch*: Industry standard, but heavyweight for this use case
- *Meilisearch/Typesense*: Simpler but not code-optimized
- *Ripgrep*: For the pure-local tier, just shell out to rg — it's what Claude Code effectively does

### 4.3 Vector Store — For Semantic Search

**Primary recommendation: KuzuDB's built-in vector search (simple deployments); Qdrant or pgvector (enterprise)**

Semantic search handles the queries grep can't: "where do we handle authentication?" or "show me code similar to this pattern." The embedding model matters more than the vector store.

**Embedding model recommendation:** Use a code-specific embedding model like Voyage Code 3 or CodeBERT, not a general-purpose text embedding model. Code has different semantic structure than natural language.

**Architecture decision:** Keep the vector store as a **secondary index**, not the primary retrieval path. This aligns with the Claude Code lesson — embeddings are a supplement to structural and textual search, not a replacement.

**Alternatives:**
- *Chroma*: Simple embedded vector DB, good for local mode
- *Weaviate*: Feature-rich but heavier
- *LanceDB*: Embedded, columnar, good DuckDB integration
- *Just skip it initially*: A viable MVP decision. GitNexus doesn't use embeddings for its core graph queries. Add semantic search as a later enhancement.

### 4.4 SCIP/Symbol Store — For Precise Cross-Repo Navigation

**Primary recommendation: SQLite (local) or PostgreSQL (enterprise) with SCIP-derived tables**

SCIP indexes are a transmission format, not a query format (per Sourcegraph's own design docs). You need to load SCIP data into a queryable store. The key tables are:

- **symbols** (symbol_id, kind, display_name, doc_string, repo, file, range)
- **references** (symbol_id, repo, file, range, is_definition, is_reference, is_implementation)
- **cross-repo edges** (from_symbol, to_symbol, relationship_type)

SQLite is perfect for the local tier (fast, embedded, zero-config). For enterprise, PostgreSQL with appropriate indexes handles the workload.

**Reference:** Sourcegraph SCIP design: "SCIP is meant to be a transmission format... not a storage format for querying" (github.com/sourcegraph/scip/blob/main/DESIGN.md)

### 4.5 Recommended Composite Architecture

```
LOCAL / CLI MODE (zero-server, like GitNexus today):
  ├── KuzuDB (graph + vector search)
  ├── SQLite (SCIP symbols + metadata)
  ├── Tantivy or ripgrep (text search)
  └── Git (temporal data source, always fresh)

ENTERPRISE / SHARED MODE:
  ├── Neo4j or KuzuDB cluster (graph)
  ├── PostgreSQL + pgvector (symbols + vectors + metadata)
  ├── Zoekt (code search across all repos)
  ├── Redis (caching hot query results)
  └── Git servers (temporal data source)
```

---

## 5. Multi-Repo Enterprise Features

This is where the platform goes beyond what GitNexus offers today. Enterprise codebases aren't one repo — they're hundreds or thousands of interconnected repos with package dependencies, shared libraries, API contracts, and organizational ownership boundaries.

### 5.1 Cross-Repository Dependency Graph

**Package manifest parsing:** Automatically parse package.json, pom.xml, build.gradle, go.mod, Cargo.toml, requirements.txt, .csproj, etc. to build repo-to-repo dependency edges.

**API contract detection:** Parse OpenAPI/Swagger specs, gRPC proto files, and GraphQL schemas to identify service-to-service communication boundaries. These are the edges that connect microservice repos.

**SCIP cross-repo resolution:** When SCIP symbol IDs match across repos (e.g., a shared library's exported type is referenced in a consuming repo), create cross-repo navigation edges. This is how Sourcegraph achieves cross-repo go-to-definition.

**Runtime dependency discovery (advanced):** Instrument CI/CD or staging environments to capture actual HTTP calls, message queue interactions, and database queries — building a runtime dependency graph that catches dynamic connections static analysis misses.

### 5.2 Organization-Aware Intelligence

- **Ownership mapping:** Integrate with CODEOWNERS files, GitHub/GitLab team APIs, and org charts to map code regions to teams
- **Bus factor analysis** per module, per team, per service — surfacing single-points-of-failure in knowledge
- **Cross-team coupling detection:** When Team A's repos frequently change in lockstep with Team B's, surface this as an organizational dependency that may indicate misaligned service boundaries
- **Onboarding context:** When a new developer joins, auto-generate a reading guide based on the modules they'll own, their dependency graph, and annotated hotspots

### 5.3 Federated Architecture for Scale

For very large enterprises (1000+ repos), a centralized graph becomes an operational burden. Consider a **federated model**:

- Each repo (or repo group) maintains its own local KuzuDB graph, generated in CI/CD
- A **federation layer** maintains cross-repo edges (package deps, API contracts, SCIP cross-references) in a central Neo4j/PostgreSQL instance
- Queries that stay within a repo hit the local graph (fast, no network). Queries that cross repo boundaries are routed through the federation layer, which joins local results.
- The MCP server advertises tools for both local and cross-repo queries

This mirrors how Sourcegraph handles scale — per-repo indexing with cross-repo resolution at query time.

### 5.4 Access Control

Enterprise deployments need RBAC. Not every developer should see every repo's internals. The query orchestrator must filter graph results based on the requesting user's repo access permissions, which should be synced from the SCM platform (GitHub/GitLab/Bitbucket).

---

## 6. AI Agent Interface Layer

### 6.1 MCP Server (Primary)

The MCP server is the primary interface for AI coding agents. Drawing from GitNexus's seven tools, but extended for multi-repo:

| Tool | Purpose | Query Type |
|------|---------|-----------|
| `search` | Hybrid search (BM25 + semantic + graph-boosted) | Text + Vector |
| `impact` | Blast radius analysis (upstream/downstream, with confidence) | Graph traversal |
| `context_360` | Full context for a symbol (callers, callees, types, tests, docs) | Graph + SCIP |
| `dependencies` | Package and service dependency tree | Graph |
| `cross_repo_refs` | Find usages of a symbol across all accessible repos | SCIP + Federation |
| `hotspots` | High-churn + high-complexity code needing attention | Temporal + Graph |
| `ownership` | Who owns this code, bus factor, knowledge distribution | Temporal + Org data |
| `architecture` | Community clusters, service boundaries, process flows | Graph algorithms |
| `diff_impact` | Given a git diff, what's the cross-repo blast radius | Graph + Git |
| `rename` | Safe multi-file, multi-repo rename with dependency awareness | Graph + SCIP |

### 6.2 PreToolUse Hooks (Claude Code Integration)

Following GitNexus's pattern, intercept Claude Code's built-in grep/glob/bash calls and **enrich** them with graph context. When Claude greps for a function name, the hook appends "and here are the 12 callers, grouped by domain, with confidence scores" to the result. This preserves the freshness of grep while adding structural awareness.

### 6.3 LSP Bridge (IDE Integration)

For IDE users who aren't using AI agents, expose graph intelligence through LSP extensions — augmenting standard LSP responses with cross-repo context, blast radius indicators, and hotspot warnings.

---

## 7. Implementation Phases

### Phase 1: Local Single-Repo MVP (Weeks 1-8)

Build the GitNexus-equivalent core with a cleaner architecture:
- Tree-sitter parsing for TypeScript, Python, Go, Java (4 languages)
- KuzuDB graph with basic node/edge types
- Hybrid search (BM25 via Tantivy + graph-boosted ranking)
- MCP server with `search`, `impact`, `context_360` tools
- CLI: `codegraph index`, `codegraph serve`, `codegraph setup`
- **Ship as MIT licensed** (not PolyForm Noncommercial like GitNexus)

### Phase 2: Temporal Intelligence (Weeks 9-14)

Add git history mining:
- Change frequency, temporal coupling, knowledge distribution
- Hotspot analysis (complexity × churn)
- Timeline playback (inspired by CodeCohesion)
- Add `hotspots` and `ownership` MCP tools

### Phase 3: Multi-Repo & Cross-Repo (Weeks 15-24)

The enterprise differentiator:
- Package manifest parsing for cross-repo dependency graph
- SCIP integration (ingest SCIP indexes from CI/CD)
- Cross-repo symbol resolution and navigation
- Federation layer for distributed graph queries
- API contract detection (OpenAPI, gRPC, GraphQL)
- Add `cross_repo_refs`, `dependencies`, `architecture` tools

### Phase 4: Enterprise Features (Weeks 25-36)

- RBAC and SCM permission sync
- Organization/team mapping
- Admin dashboard (graph health, index freshness, query analytics)
- CI/CD integration (GitHub Actions, GitLab CI, Jenkins)
- PR-time blast radius analysis (bot comments)
- Self-hosted deployment (Kubernetes Helm chart)

### Phase 5: Advanced Intelligence (Ongoing)

- Semantic embeddings (Voyage Code 3 or similar)
- Runtime dependency discovery
- AI-powered anomaly detection (unusual coupling patterns, drift)
- CodeScene-style CodeHealth scoring
- Auto-generated architecture documentation

---

## 8. Technology Stack Summary

| Component | Local/CLI Mode | Enterprise Mode | Alternative |
|-----------|---------------|----------------|-------------|
| **Language** | TypeScript/Rust | TypeScript/Rust + Go | Python (slower but faster to prototype) |
| **AST Parsing** | Tree-sitter WASM | Tree-sitter native | ast-grep, ANTLR |
| **Precise Indexing** | SCIP CLI | SCIP indexers in CI/CD | LSIF (older, larger) |
| **Graph DB** | KuzuDB (embedded) | Neo4j or KuzuDB cluster | FalkorDB, Memgraph, Apache AGE |
| **Text Search** | Tantivy / ripgrep | Zoekt | OpenSearch, Elasticsearch |
| **Vector Search** | KuzuDB built-in | pgvector or Qdrant | Chroma, LanceDB, Weaviate |
| **Metadata Store** | SQLite | PostgreSQL | CockroachDB (multi-region) |
| **Cache** | In-memory (LRU) | Redis | Memcached |
| **CI/CD Integration** | Git hooks | GitHub Actions / GitLab CI | Jenkins, CircleCI |
| **Agent Protocol** | MCP (stdio) | MCP (SSE/HTTP) | Custom REST API, LSP extensions |
| **Web UI** | Vite + React + D3/Three.js | Same + auth layer | — |
| **Deployment** | `npx` / `cargo install` | Kubernetes Helm chart | Docker Compose |

---

## 9. Key Design Principles

1. **Local-first, enterprise-ready.** Every feature works on a developer's laptop with zero server dependencies. Enterprise mode adds shared infrastructure, not different logic.

2. **Freshness over completeness.** A slightly incomplete but fresh graph is more useful than a complete but stale one. Incremental indexing is not optional — it's core architecture.

3. **Enrich, don't replace.** Don't fight the agentic search pattern — enhance it. Grep results enriched with graph context beat graph results that miss recent changes.

4. **Confidence scoring on everything.** Tree-sitter-derived edges are less precise than SCIP-derived edges. Every relationship should carry a confidence score so the AI agent (and the user) can calibrate trust.

5. **Multi-repo is not an afterthought.** The graph schema, query language, and MCP tools must be designed for cross-repo from day one, even if the first implementation is single-repo.

6. **Open source with a sustainable model.** MIT license for the core. Enterprise features (RBAC, federation, admin dashboard, SLA support) can justify commercial licensing. GitNexus's PolyForm Noncommercial license limits adoption — don't repeat that.

---

## 10. Success Metrics

- **Index freshness:** Time from git push to graph update < 30 seconds
- **Query latency:** Single-repo graph queries < 100ms; cross-repo < 500ms
- **Blast radius accuracy:** Compare predicted impact vs actual files changed in subsequent commits (measurable via backtesting on git history)
- **AI agent effectiveness:** Measure reduction in "blind edit" errors (edits that break distant code) when agents use graph context vs. grep-only
- **Developer adoption:** Track MCP tool call volume, query patterns, and time-to-first-value for new repo onboarding

---

## Appendix: Competitive Positioning

| Capability | This Platform | GitNexus | Sourcegraph Cody | CodeScene | SonarQube |
|-----------|--------------|---------|-----------------|-----------|-----------|
| Knowledge graph | ✅ | ✅ | Partial (RSG) | ✗ | ✗ |
| Multi-repo | ✅ | ✗ (single) | ✅ | ✅ | ✅ |
| Cross-repo navigation | ✅ (SCIP) | ✗ | ✅ (SCIP) | ✗ | ✗ |
| Temporal analysis | ✅ | ✗ | ✗ | ✅ | ✗ |
| MCP for AI agents | ✅ | ✅ | ✗ | ✗ | Partial (MCP server) |
| Community detection | ✅ | ✅ | ✗ | ✗ | ✗ |
| Bus factor / ownership | ✅ | ✗ | ✗ | ✅ | ✗ |
| Semantic search | ✅ | ✅ (BM25+) | ✅ | ✗ | ✗ |
| Local-first / no server | ✅ | ✅ | ✗ | ✗ | ✗ |
| Static analysis rules | Defer to SonarQube | ✗ | ✗ | Limited | ✅ (6000+) |
| Compiler-accurate types | ✅ (SCIP) | ✗ | ✅ (SCIP) | ✗ | Limited |
| Open source | ✅ (MIT) | PolyForm NC | Partially | ✗ (commercial) | LGPL-3.0 |
