# CodeCohesion vs GitNexus Comparison

Research date: 2026-02-21
Source: https://github.com/abhigyanpatwari/GitNexus

## What GitNexus Is

GitNexus is a code intelligence tool that indexes codebases into a knowledge graph (KuzuDB), then exposes that graph to AI agents via MCP. It parses source code with Tree-sitter to extract functions, classes, call chains, imports, and inheritance. It runs community detection (Leiden algorithm) to cluster related code, traces execution flows from entry points, and generates embeddings for hybrid search (BM25 + semantic).

Two modes:
- **CLI + MCP** (main use case): `npm install -g gitnexus`, run `gitnexus analyze`, then AI agents get 7 tools via MCP
- **Web UI**: browser-based graph explorer (everything client-side via WASM)

License: PolyForm Noncommercial.

## Fundamental Difference

| | **CodeCohesion** | **GitNexus** |
|---|---|---|
| **Core approach** | Git history analysis (temporal) | Static code analysis (structural) |
| **What it sees** | Files that *change together* | Functions that *call each other* |
| **Graph source** | Co-commit patterns | AST parsing (Tree-sitter) |
| **Output** | 3D visual exploration | MCP tools for AI agents |
| **User** | Human developer exploring | AI agent making edits |
| **Clustering** | Louvain on temporal coupling | Leiden on call graph edges |
| **DDD angle** | Discovers bounded contexts from behavior | Discovers dependencies from structure |

They're complementary, not competitive. CodeCohesion answers "what evolves together?" while GitNexus answers "what depends on what?"

## What CodeCohesion Can Learn From GitNexus

### 1. Impact/blast radius analysis is a killer feature

GitNexus's `impact` tool ("47 functions depend on this return type") is concrete and actionable. CodeCohesion has the coupling data to do something similar: "these 12 files have changed together in 80% of commits; touching one likely means touching the others."

### 2. MCP as the delivery mechanism for AI agents

GitNexus's main value isn't the graph itself; it's exposing that graph through MCP tools so agents can query it mid-task. The DDD vision document already mentions this. GitNexus validates the approach: 7 focused tools with clear purposes beats a generic "here's the graph" dump.

### 3. Confidence scoring on relationships

GitNexus tags every CALLS edge with a confidence score (0.3-0.9) based on how it resolved the reference. CodeCohesion's temporal coupling already has a natural confidence metric (co-commit frequency / total commits), but it could be made more explicit and filterable.

### 4. Process/flow detection

GitNexus traces execution flows from entry points through call chains. CodeCohesion could do something analogous with temporal sequences: which files tend to change *in what order* within a commit or PR? That's a behavioral process trace rather than a structural one.

### 5. Precomputed intelligence over raw data

GitNexus's core insight: don't hand the LLM a graph and hope it explores enough. Precompute the answers (clusters, processes, impact chains) at index time and return them in one tool call. If CodeCohesion adds MCP, this principle matters a lot.

## Where CodeCohesion Has Advantages

- **Temporal coupling catches what static analysis can't.** Two modules with zero direct imports but 95% co-commit rate? That's a hidden dependency GitNexus won't see.
- **Visual exploration.** The 3D solar system view gives humans spatial intuition about architecture that a text-based MCP tool can't.
- **Git history is universal.** Works on any language, any framework, no parser needed. GitNexus needs Tree-sitter grammars for each language.
- **Evolution over time.** Timeline playback shows *how* architecture emerged, not just its current state.

## Concrete Ideas for CodeCohesion's Roadmap

1. **Add an MCP server** exposing coupling clusters, hotspots, and co-change predictions as tools. Already in the DDD vision; GitNexus proves the market wants it.
2. **"Coupling impact" tool**: given a file, return all files with >X% co-change rate, grouped by coupling strength. Analogous to GitNexus's `impact` but temporal.
3. **Combine both signals**: integrating Tree-sitter parsing (Phase 5 of the DDD vision) would allow scoring relationships on *both* structural dependency AND temporal coupling. That would be uniquely powerful; neither tool does both today.

## GitNexus Technical Details

### MCP Tools (7)

| Tool | What It Does |
|------|-------------|
| `list_repos` | Discover all indexed repositories |
| `query` | Process-grouped hybrid search (BM25 + semantic + RRF) |
| `context` | 360-degree symbol view with categorized refs and process participation |
| `impact` | Blast radius analysis with depth grouping and confidence |
| `detect_changes` | Git-diff impact, maps changed lines to affected processes |
| `rename` | Multi-file coordinated rename with graph + text search |
| `cypher` | Raw Cypher graph queries |

### Indexing Pipeline (7 phases)

1. **Structure** (0-15%): Walk file tree, create CONTAINS edges
2. **Parse** (15-40%): Tree-sitter ASTs, extract symbols
3. **Imports** (40-55%): Language-aware import resolution
4. **Calls + Heritage** (55-75%): Function call resolution with confidence scoring
5. **Communities** (75-85%): Leiden algorithm clustering
6. **Processes** (85-95%): Entry point tracing via BFS
7. **Embeddings** (95-100%): HNSW vector index + BM25 full-text

### Tech Stack

- Tree-sitter (native bindings for CLI, WASM for web)
- KuzuDB (embedded graph database with vector support)
- Graphology + Leiden (clustering)
- transformers.js (embeddings)
- Supports: TypeScript, JavaScript, Python, Java, C, C++, C#, Go, Rust

### Confidence Scoring

| Confidence | Reason | Meaning |
|-----------|--------|---------|
| 0.90 | import-resolved | Target found in imported file |
| 0.85 | same-file | Target defined in same file |
| 0.50 | fuzzy-global (1 match) | Single global match by name |
| 0.30 | fuzzy-global (N matches) | Multiple matches, first picked |
