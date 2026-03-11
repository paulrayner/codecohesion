# CodeCohesion Test Run: beads + gastown repos

**Date:** 2026-03-11
**Branch:** `claude-harness-refactoring` (Eric Olson)
**Purpose:** Validate processor/viewer against real-world agentic-factory repos

## Repos Analyzed

| Repo | Commits | Files | LOC | Date Range |
|------|---------|-------|-----|------------|
| [beads](https://github.com/steveyegge/beads) | 7,584 | 1,142 | 286,271 | Oct 2025 - Mar 2026 (5 months) |
| [gastown](https://github.com/steveyegge/gastown) | 6,046 | 1,210 | 383,720 | Dec 2025 - Mar 2026 (3 months) |

**Cross-repo relationship:** gastown imports beads as a Go module (`github.com/steveyegge/beads v0.59.0`). 12 gastown files reference beads directly via `beadsdk` import alias.

---

## Deep Analysis Findings

### 1. Agent vs Human Contribution Patterns

**Beads:** 20.1% agent commits (1,576) / 79.9% human (6,275)
**Gastown:** 38.5% agent commits (2,328) / 61.5% human (3,721)

Gastown relies on agents nearly twice as much as beads proportionally. The trend is accelerating: in the most recent weeks (W10-W11 2026), gastown agent commits hit 74-78%.

| Period | Beads Agent % | Gastown Agent % |
|--------|--------------|-----------------|
| Before 2026 | 0% | ~5% |
| Jan 2026 | 43-72% | 47-73% |
| Feb 2026 | 47-60% | 34-57% |
| Mar 2026 (so far) | 48-68% | 74-78% |

**Top agent contributors:**
- `beads/crew/emma` (322 commits) is the most prolific agent in beads
- `mayor` (438 commits in gastown, 136 in beads) is the highest-volume agent overall
- `furiosa` (185 commits) is gastown's second-most-active agent

**Steve Yegge** dominates the human side: 4,445 beads commits (56.7% of all beads commits) and 2,185 gastown commits (36.1%).

### 2. Commit Type Distribution: Agents Fix More Than They Build

| Type | Beads Agent | Beads Human | Gastown Agent | Gastown Human |
|------|-------------|-------------|---------------|---------------|
| fix | 687 | 1,038 | 1,154 | 1,021 |
| feat | 233 | 450 | 451 | 441 |
| refactor | 84 | 85 | 72 | 76 |
| test | 34 | 106 | 46 | 40 |
| docs | 38 | 199 | 102 | 138 |

In gastown, agents produce **more fixes than features** (1,154 fix vs 451 feat), and actually produce more fixes than humans do. This suggests agents are primarily used for maintenance/stabilization work, while humans drive the feature design.

### 3. Commit Size: Agents Make Larger Commits

| | Beads Agent | Beads Human | Gastown Agent | Gastown Human |
|---|---|---|---|---|
| Median files/commit | 2 | 1 | 2 | 1 |
| Average | 4.8 | 2.4 | 2.7 | 2.4 |
| P90 | 9 | 5 | 5 | 5 |
| Max | 259 | 179 | 82 | 176 |

Agents in beads make commits that are 2x larger on average. The max of 259 files in a single agent commit suggests some large-scale refactoring operations.

### 4. Fix-After-Feat Pattern (Quality Signal)

"Fix within 48 hours of a feature on the same file" indicates features that didn't land cleanly.

**Beads:** 1,048 fix-after-feat events
**Gastown:** 1,516 fix-after-feat events

| Beads Top Files | Events | Gastown Top Files | Events |
|-----------------|--------|-------------------|--------|
| `internal/storage/dolt/store.go` | 62 | `internal/cmd/sling.go` | 65 |
| `cmd/bd/init.go` | 51 | `internal/daemon/daemon.go` | 61 |
| `cmd/bd/main.go` | 43 | `internal/witness/handlers.go` | 53 |
| `cmd/bd/sync.go` | 32 | `internal/tmux/tmux.go` | 51 |
| `cmd/bd/doctor.go` | 30 | `internal/cmd/done.go` | 47 |

These are the same files that show up as highest churn. The fix-after-feat pattern confirms they're quality hotspots, not just active areas.

### 5. Rapid Handoff Analysis (Coordination Signal)

"Same file modified by different author within 24 hours" suggests coordination overhead or agent-human handoff friction.

**Beads:** 2,398 rapid handoff events
**Gastown:** 3,224 rapid handoff events

The top rapid-handoff files perfectly mirror the churn hotspots. `daemon.go` (96 handoffs), `done.go` (94), `sling.go` (82) in gastown, and `main.go` (96), `store.go` (91) in beads. This suggests these files are bottlenecks where multiple agents (or agent + human) frequently need to touch the same code.

### 6. Revert/Rework Patterns

**Beads:** 99 revert/rework commits (1.3%)
**Gastown:** 88 revert/rework commits (1.5%)

Notable patterns in beads reverts:
- Multiple "Restore clean database state" and "Database recovery" commits in Oct 2025, suggesting the early database schema was unstable
- "Revert hash ID generation" (Oct 30) followed by reimplementation, a design pivot
- "Restore stable state: revert to beads.jsonl with 538 issues" (Nov 21), followed by another restore the same day

Gastown reverts include several rapid revert-then-restore cycles in late December 2025, suggesting the Christmas holiday period was a rough patch for gastown development.

### 7. Architectural Evolution

**Beads package growth:** Started with 26 second-level directories in Oct 2025, peaked at 76 in Jan 2026, then pruned to 69 by March 2026. The pruning suggests architectural consolidation after rapid growth.

**Gastown package growth:** Started with 40 second-level directories in Dec 2025, grew rapidly to 96 by Feb 2026, stabilized at 94 by March 2026.

| Month | Beads 2nd-Level Dirs | Gastown 2nd-Level Dirs |
|-------|---------------------|----------------------|
| Oct 2025 | 26 | - |
| Nov 2025 | 54 | - |
| Dec 2025 | 65 | 40 |
| Jan 2026 | 76 | 78 |
| Feb 2026 | 70 | 96 |
| Mar 2026 | 69 | 94 |

Beads had an expansion-then-contraction pattern (healthy architectural pruning). Gastown expanded rapidly and stabilized but hasn't pruned yet.

### 8. Cross-Repo Analysis

#### Shared Authors
**86 authors commit to both repos.** Key shared contributors:
- **Steve Yegge:** 4,445 beads + 2,185 gastown, 52 same-day dual-repo days (87% of gastown's active days)
- **mayor** (agent): 136 beads + 438 gastown, 37 same-day dual-repo days
- **beads/crew/emma** (agent): 322 beads + 97 gastown, 13 same-day dual-repo days
- **gastown/crew/george** (agent): 86 beads + 69 gastown, 7 same-day dual-repo days

Agents crossing repo boundaries is significant. `mayor` commits to both repos on the same day 37 times, suggesting it's an orchestration agent that coordinates across the two projects. Several `beads/crew/*` agents appear in gastown commits and vice versa, confirming agent identity is not repo-scoped.

#### Daily Commit Correlation
Pearson correlation of daily commit counts: **r = 0.56** (moderate-to-strong positive). Both repos are active on **100% of overlapping days** (86/86 days). They alternate leadership: sometimes beads surges (building features gastown needs), sometimes gastown surges (integrating).

Top combined activity days:
| Date | Beads | Gastown | Total |
|------|-------|---------|-------|
| 2026-02-24 | 122 | 162 | 284 |
| 2026-03-01 | 109 | 136 | 245 |
| 2025-12-24 | 195 | 49 | 244 |
| 2026-03-07 | 90 | 141 | 231 |

#### Beads Version Bumps in Gastown
**9 dependency bumps in 24 days** (Feb-Mar), including one revert. Gastown pinned at v0.59.0 (latest tag, bumped Mar 6). The Feb 20 revert (v0.54.0 rollback after beads shipped 7 tags in a single day) demonstrates the fragility of rapid upstream evolution.

#### Cross-Repo Cascade Events
**2,007 cascade events** detected (gastown touching beads-related files within 24h of beads activity). **54 tag-triggered cascades** where a beads tag release triggered gastown beads-related commits within 48 hours. The Dec 21 beads v0.33.0 tag triggered 408+ gastown responses within 48h.

498 gastown commits (8.2%) explicitly mention "beads" in their commit message. Gastown's `.beads/` directory is actively maintained with issue tracking, meaning beads (the tool) is used to manage gastown (the project).

#### Shared Vocabulary (Domain Concept Overlap)
| Term | Beads commits | Gastown commits | Analysis |
|------|:---:|:---:|----------|
| daemon | 717 | 173 | Shared infrastructure |
| dolt | 493 | 254 | Shared database layer |
| polecat | 42 | 485 | Gastown concept leaking into beads |
| formula | 51 | 187 | Growing shared concept |
| agent | 75 | 298 | Shared concept |

The vocabulary overlap reveals gastown is not just a dependency consumer but shares a conceptual framework with beads.

### 9. Architectural Evolution Trajectory

#### Beads: Expansion then Pruning
Beads hit an inflection in **Feb 2026**: 757 files deleted (net -164), the only negative month in either repo. This was a deliberate decomposition, primarily breaking apart `cmd/bd/sync.go` (deleted entirely, decomposed into ~25 files) and pruning `cmd/bd/doctor/` (45+ files).

The coupling data confirms this: `.beads <-> cmd` coupling dropped from 9.9% to 1.6% between first and second half, but `cmd/bd <-> internal/storage` coupling intensified from 4.1% to 6.6% due to the Dolt storage migration. **Beads traded one coupling problem for another.**

#### Gastown: Still Expanding, Pruning Ahead
Gastown created **70+ internal/ packages in 3 months** (double beads' rate of 35 in 5 months). Despite more packages, coupling to `internal/cmd` is intensifying, not decreasing. `daemon.go` is on a god-object trajectory (39 -> 50 -> 93 monthly touches, accelerating).

Gastown's `internal/cmd` is a coupling star: nearly every top coupling pair involves it. This is analogous to where beads' `cmd/bd` was before its February pruning event. Gastown should anticipate a similar restructuring need.

#### Package Introduction Rate
- **Beads Nov 2025:** Peak extraction month (12 new packages), deliberate decomposition of initial monolithic structure
- **Gastown Jan 2026:** Peak expansion (20+ new packages in one month), primarily integration and agent runtime packages
- **Gastown Feb 2026:** Agent runtime explosion (`copilot`, `gemini`, `wasteland`, `scheduler`, `quota`, `telemetry`)

---

## Gotchas with Eric's Implementation

### 1. CLI output naming is confusing
The processor CLI always writes to `processor/output/repo-data.json` by default, regardless of which repo you analyze. The second positional arg sets the output path, but there's no `-o` flag. Running two analyses in sequence silently overwrites the first result.
```bash
# Must explicitly pass output path:
npx ts-node src/cli.ts /path/to/repo /path/to/output.json
```
**However**, the `--full-delta` flag auto-names output using the repo directory name (e.g., `beads-timeline-full.json`), creating an inconsistency: HEAD snapshots overwrite each other, but full-delta outputs don't.

### 2. Full-delta output vs HEAD snapshot output go to different places
- HEAD snapshot: writes to `processor/output/repo-data.json` (or second positional arg)
- Full-delta: writes to `processor/output/{reponame}-timeline-full.json` (auto-named, ignores positional arg)
- Coupling: writes next to the input file (e.g., `processor/output/{reponame}-coupling.json`)

This means you need to manually copy files to `viewer/public/data/` in three separate steps. The in-app Analyze panel (via API) handles this automatically, but the CLI workflow requires manual file management.

### 3. Coupling CLI takes a JSON file path, not a repo path
The coupling CLI (`coupling-cli.ts`) takes the path to a timeline-full JSON file, not a repo path. The error message when you pass a directory is unhelpful ("EISDIR: illegal operation on a directory, read"). The main CLI's `--coupling` flag is supposed to chain full-delta + coupling automatically but the workflow isn't obvious.

### 4. `sharedCommits` is undefined in coupling edges
The coupling edge data includes `coupling` score but `sharedCommits` is `undefined`, making it hard to distinguish between "these two files changed together 2 out of 2 times" vs "200 out of 200 times". Both show coupling=1.0 but the confidence is very different.

### 5. Contributors field is undefined in HEAD snapshots
`snapshot.stats.contributors` returns `undefined`. The contributor data exists per-file (`lastAuthor`, `authorCount`) but isn't aggregated at the snapshot level. For repos with 100+ contributors this is a significant missing feature.

### 6. No cross-repo analysis capability yet
While we can analyze beads and gastown independently, there's no way to:
- Detect that gastown depends on beads (go.mod parsing)
- Find which gastown files import beads types
- Correlate commit timing across repos (both repos have ~50 commits/day)
- Assess API surface coupling between the two

This is exactly the "cross-repo cohesion gap" from Paul and Eric's March 4 conversation.

### 7. Go language support is pattern-based, not AST-based
The structure analyzer uses tree-sitter for TypeScript/JavaScript. Go files get basic analysis (LOC, git metadata) but not import edge extraction or function declaration parsing. For Go-heavy repos like beads/gastown, the structure and complexity analyses produce no useful data. This is the main language-support gap for enterprise adoption.

### 8. Migration files create coupling noise
SQLite migration files (e.g., `003_composite_indexes.go` through `014_child_counters_table.go`) show coupling=1.0 because they were all committed together. This is a common false positive in coupling analysis. A "generated/infrastructure file" filter would improve signal-to-noise.

### 9. CLI query commands are library-only, not runnable
The `packages/cli/src/commands/` files (risk, who, context, impact) export functions but have no arg parsing or `main()`. They're not wired into the unified CLI entry point (`index.ts`). Running them directly produces no output. Only `who` works with HEAD snapshot data alone. The other three (`risk`, `context`, `impact`) require structure/complexity data that doesn't exist for Go repos. The MCP tools (hotspots, impact, structure) are similarly unregistered; `registerTools()` only registers a `ping` tool.

### 10. Timeline V2 doesn't capture lines changed
`linesAdded` and `linesDeleted` are always 0 in the timeline data. This means we can count file touches but can't distinguish between a 1-line fix and a 500-line rewrite. Significant gap for any LOC-based analysis over time.

### 11. 48 console.log statements in viewer main.ts
Eric's branch has extensive debug logging throughout `main.ts` (e.g., "Commit highlighting conditions met"). These should be cleaned up before release.

### 12. Viewer data directory is gitignored
Generated JSON files in `viewer/public/data/` are gitignored. After running the processor, you need to have the files present locally to view them. The viewer shows a repo dropdown based on what JSON files exist in this directory. By design, but can be confusing for first-time setup.

---

## Analyses Completed

- [x] HEAD snapshot (beads) - 1,142 files, 286K LOC
- [x] HEAD snapshot (gastown) - 1,210 files, 384K LOC
- [x] Full-delta timeline (beads) - 7,851 commits, 105 version tags
- [x] Full-delta timeline (gastown) - 6,049 commits, 18 version tags
- [x] Coupling analysis (beads) - 9,260 edges, 101 clusters
- [x] Coupling analysis (gastown) - 4,354 edges, 129 clusters
- [x] Agent vs human contribution analysis
- [x] Fix-after-feat quality signal analysis
- [x] Rapid handoff / coordination overhead analysis
- [x] Revert/rework pattern detection
- [x] Architectural evolution trajectory
- [x] Cross-repo temporal correlation
- [x] Cross-repo cascade detection
- [x] CLI/MCP tool testing
- [ ] Structure analysis - skipped (Go, not TS/JS; no tree-sitter support)
- [ ] Complexity analysis - skipped (depends on structure analysis)

## Viewer

All data files copied to `viewer/public/data/`. Viewer running at http://localhost:3000/. Both repos should appear in the dropdown. Available color modes include "Bounded Contexts" (cluster view) when coupling data is loaded.
