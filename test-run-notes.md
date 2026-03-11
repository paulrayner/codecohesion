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

---

## Deep Dive Investigations (March 11, follow-up)

Analysis scripts stored at `/tmp/codecohesion-analysis/`. All findings derived from the timeline-full and coupling JSON data produced by Eric's branch.

### 10. Agent Quality by Individual Identity

**Problem:** The aggregate agent-vs-human stats hide significant variation between individual agents. With 291 agent identities, some agents may be consistently high-quality while others generate excessive rework. Understanding per-agent quality profiles would let Steve tune or retire underperforming agents.

**Method:** For each agent with 50+ commits, measured fix-to-feat ratio, fix-after-feat rate (fix within 48h on same file after a feat), revert rate, and commit size (median/P90 files changed).

#### Highest-Quality Agents

| Agent | Commits | Fix:Feat | Fix-After-Feat | Revert% | P90 Files |
|-------|---------|----------|----------------|---------|-----------|
| gastown/crew/jack | 64 | 1.35 | 13.0% | 1.6% | 7 |
| rictus | 85 | 1.50 | 13.3% | 0.0% | 5 |
| nux | 124 | 1.71 | 23.8% | 0.8% | 5 |
| furiosa | 189 | 1.91 | 20.0% | 0.0% | 5 |
| gastown/crew/dennis | 95 | 1.92 | 0.0% | 1.1% | 4 |

`gastown/crew/dennis` stands out: zero fix-after-feat, low fix-to-feat, low revert rate, and small commits. Arguably the highest-quality agent overall.

#### Lowest-Quality Agents

| Agent | Commits | Fix:Feat | Fix-After-Feat | Revert% | P90 Files |
|-------|---------|----------|----------------|---------|-----------|
| julianknutsen | 201 | 9.25 | 68.8% | 4.0% | 7 |
| gastown/crew/joe | 72 | 11.50 | 0.0% | 1.4% | 5 |
| beads/crew/lizzy | 81 | 5.25 | 12.5% | 0.0% | 11 |
| mayor | 574 | 4.04 | 52.1% | 1.4% | 5 |
| obsidian | 98 | 3.82 | 35.3% | 3.1% | 9 |

`julianknutsen` has the worst combined profile: 9.25 fix-to-feat ratio, 68.8% fix-after-feat rate, 4.0% revert rate. `mayor` is the highest-volume agent (574 commits) but over half its features need a same-file fix within 48 hours.

#### Human Baseline Comparison

The human baseline fix-after-feat rate is 62.4%, driven largely by Steve Yegge at 66.4%. This is actually worse than most agents. However, Steve's fix-to-feat ratio (1.62) is better than all but two agents, suggesting humans iterate differently: they fix quickly but their initial features are more focused.

Special-purpose agents like `beads/refinery` and `beads/witness` have infinite fix-to-feat ratios because they produce no features at all; they exist solely for maintenance tasks.

### 11. daemon.go God-Object Trajectory

**Problem:** The initial analysis flagged `internal/daemon/daemon.go` in gastown as accelerating from 39 to 50 to 93 monthly touches, suggesting a god-object trajectory. Quantifying the coupling fan-out and author sprawl would determine whether this file is becoming a refactoring bottleneck.

**Method:** Tracked weekly touch frequency, distinct authors, coupling fan-out from the coupling data, and commit type breakdown. Compared against beads' `cmd/bd/main.go` as a known god-object precedent.

#### Gastown daemon.go

- **204 of 6,049 commits** (3.4%) modify daemon.go across 13 active weeks
- **60 distinct authors** have touched the file. January and February each saw 32 different authors.
- **Touch rate is accelerating**: first-half average 14.3/week, second-half 16.9/week (+18%)
- **Peak week**: W09 2026 with 39 touches
- **51% of commits are fixes**, 26% are features. The 2:1 fix-to-feat ratio indicates the file accumulates defects alongside new functionality.

#### Coupling Fan-Out (Surprisingly Low)

Only 4 files co-change with daemon.go in the coupling data:

| File | Co-Changes | Coupling |
|------|-----------|----------|
| internal/daemon/lifecycle.go | 40 | 0.158 |
| internal/beads/daemon_test.go | 2 | 0.400 |
| internal/doctor/bd_daemon_check.go | 2 | 0.286 |
| internal/cmd/account.go | 2 | 0.111 |

The low fan-out is itself a god-object symptom: everything gets stuffed into one file rather than decomposed into collaborators. Changes are broad and self-contained rather than rippling outward.

#### Beads Comparison: cmd/bd/main.go

Beads' `cmd/bd/main.go` shows a very similar trajectory: 286 touches (3.6% of commits), 67 distinct authors. `cmd/bd/sync.go` was deleted on 2026-03-02 in a cleanup commit. Before deletion, main.go averaged 12.1 touches/week; after, 15.5/week (only 2 weeks of data, too early to conclude).

The parallel is clear: gastown's daemon.go is where beads' main.go/sync.go were before the February pruning. Gastown should anticipate a similar decomposition need.

### 12. February Pruning Event in Beads (Before/After Coupling)

**Problem:** Beads deleted 757 files in February 2026 with net -164. The initial analysis noted coupling shifted from `.beads <-> cmd` to `cmd/bd <-> internal/storage`. Did the pruning actually reduce architectural coupling, or just move it?

**Method:** Split all commits at the February 2026 boundary. Calculated temporal coupling (file pairs co-changing within the same commit) for each period. Mapped the sync.go decomposition and tracked net file changes by directory.

#### The Pruning Was a "Try, Revert, Redo" Process

579 files deleted, 549 created in February. Most files were deleted and re-created exactly twice:

1. **Feb 6-10**: First attempt to remove SQLite backend (-138 files)
2. **Feb 11**: Revert ("premature dolt transition", +155 files restored)
3. **Feb 15**: Successful removal (-135 files, Phase 6)

The pruning happened in clearly labeled phases:
- **Phase 2** (Feb 10): Delete SQLite storage backend
- **Phase 4** (Feb 15): Remove tombstone/soft-delete system
- **Phase 5** (Feb 15): Remove JSONL sync layer (-27 files)
- **Phase 6** (Feb 15): Remove SQLite backend (successful this time)
- **Daemon/RPC removal** (Feb 10): -70 files for daemon, -46 for RPC

#### sync.go Was Actually Deleted in November 2025

The literal `internal/daemonrunner/sync.go` was deleted on **2025-11-07** along with the entire `daemonrunner/` package (~1,500 LOC, 16 files). The February pruning targeted the broader sync ecosystem: 44+ `sync_*.go` files in `cmd/bd/` were deleted across several waves in Feb 10-22.

#### Replacement Architecture

The sync subsystem was replaced by cleaner, domain-specific packages:
- `internal/tracker/` (7 new files): Plugin-based issue tracker framework
- `internal/jira/` (8 new files): Extracted Jira integration
- `internal/gitlab/` and `internal/linear/` (3 files each): Dedicated tracker packages
- `internal/doltserver/` (6 new files): Self-managing Dolt server replacing daemon/RPC

Net file changes by directory (February):
- `internal/storage/`: -115 files (biggest loser)
- `internal/rpc/`: -38 files
- `cmd/bd/`: -29 files
- `internal/tracker/`: +7 files (replacement)
- `internal/jira/`: +8 files (replacement)
- `internal/doltserver/`: +6 files (replacement)

#### Before/After Coupling: The Pruning Worked, Mostly

| Metric | Pre-February | February Onward | Change |
|--------|-------------|-----------------|--------|
| High-coupling pairs (>=5 co-changes) | 768 | 331 | **-57%** |
| Average co-change count per pair | 1.62 | 1.39 | -14% |
| `.beads <-> cmd` coupling | 3.3% of total | 0.1% of total | **-97%** |
| `cmd/bd <-> internal/storage` coupling | 7.2% of total | 8.4% of total | +17% |

The `.beads <-> cmd` coupling collapsed almost entirely. But `cmd/bd <-> internal/storage` coupling intensified slightly, with the hotspot being `cmd/bd/main.go <-> internal/storage/dolt/store.go` (21 co-changes). Post-pruning, the top coupling pairs shifted to `.beads/backup/` data files (backup_state.json, issues.jsonl, events.jsonl), which is expected operational coupling, not architectural coupling.

**Verdict:** The pruning successfully eliminated the sync-layer coupling problem. The new `cmd/bd <-> internal/storage/dolt` coupling is a conscious trade (Dolt migration), not accidental. The coupling graph is healthier, though main.go remains a hotspot.

### 13. Weekend/Off-Hours Agent Autonomy

**Problem:** The data contains timestamps for all commits. If agents run unsupervised on weekends or overnight, their quality during those periods (vs. supervised hours) would reveal whether autonomous agent operation is safe.

**Method:** Classified all commits by hour (Pacific Time, UTC-8) and day of week. Defined "supervised" as agent commits during human business hours (8am-6pm PT weekdays) and "unsupervised" as all other times. Compared quality metrics between the two.

#### Agents Are 1.3x More Weekend-Active Than Humans

|  | Weekday | Weekend | Weekend % |
|--|---------|---------|-----------|
| Agents | 2,992 | 1,894 | 38.8% |
| Humans | 6,316 | 2,698 | 29.9% |

Most weekend-heavy agents: `beads/crew/lizzy` (74.1% weekend), `gastown/refinery` (62.6%), `beads/refinery` (60.3%), `gastown/crew/tom` (64.0%).

#### Supervised vs. Unsupervised Quality

| Metric | Supervised | Unsupervised |
|--------|-----------|-------------|
| Total agent commits | 1,380 | 3,506 |
| Revert rate | 1.09% | 1.31% |
| Fix-after-feat rate | 48.8% | **163.4%** |
| Avg files/commit | 3.2 | 3.2 |

The revert rate is nearly identical, and commit size is the same. But the fix-after-feat rate is dramatically higher for unsupervised commits (163.4% vs 48.8%), meaning features shipped without human oversight generate multiple follow-up fixes per feature. This is the strongest signal in the data: **unsupervised agent features are 3.3x more likely to need rework**.

#### Longest Autonomous Streaks

509 agent-only streaks found. The longest was **2.0 days** in gastown (13 commits by 10 different agents, Jan 22-24). 11 streaks exceeded 24 hours, 28 exceeded 12 hours.

The longest streaks are overwhelmingly fix-heavy (e.g., 11 of 13 commits in the longest streak were fixes). Agents autonomously respond to breakage but rarely ship large new features unsupervised.

#### Steve Yegge Is a Night Owl

29.1% of Steve's commits fall in off-hours (10pm-7am PT), with 27.3% between 10pm and 3am. Peak hours: 16:00 (520 commits), 21:00 (496), 22:00 (483), 23:00 (478). His busiest day is Sunday (1,345 commits). This blurs the supervised/unsupervised boundary since he's often active late at night when agents are also running.

### 14. Tag-Triggered Cascade Response Times

**Problem:** The initial analysis detected 2,007 cascade events and noted the Dec 21 v0.33.0 tag triggered 408+ gastown responses. Understanding the actual lag between beads tags and gastown responses would reveal whether the cross-repo integration is CI-driven (minutes) or human-initiated (hours).

**Method:** For each of 105 beads version tags, found the first gastown commit that touches beads-related files or mentions "beads" in the message, and measured the time lag. Counted total gastown response commits within 48 hours of each tag.

#### Response Is Fast, Human-Driven, and Universal

- **Median lag: 0.6 hours** (36 minutes)
- **Mean lag: 3.3 hours**
- 37 of 54 post-gastown tags (69%) got a response within 1 hour
- Only one tag (v0.49.1) took longer than 48 hours (65.4h)
- **Zero missed tags**: every post-gastown beads tag triggered at least one gastown response

| Lag | Count |
|-----|-------|
| <1 hour | 37 |
| 1-6 hours | 8 |
| 6-24 hours | 8 |
| 1-3 days | 1 |

#### Not Automated

Steve Yegge is the first responder for **20 of 54 tags** (37%). Bot authors (dependabot, renovate) account for only 7 of ~4,900 cascade commits total. The integration is clearly manual, with Steve personally shepherding most beads releases into gastown. Some gastown agents (crew/joe, crew/max, crew/george) are first responders for individual tags, suggesting Steve sometimes delegates the integration to agents.

#### Cascade Volume

The Dec 20-22 period was peak intensity:

| Tag | Date | 48h Response Commits |
|-----|------|---------------------|
| v0.33.0 | Dec 21 | 413 |
| v0.33.1 | Dec 21 | 409 |
| v0.33.2 | Dec 22 | 397 |
| v0.32.0 | Dec 21 | 308 |
| v0.31.0 | Dec 21 | 302 |

Seven beads tags were released on Dec 21 alone, triggering a cascade of 300-413 gastown response commits per tag. This was clearly a major integration push.

### 15. Commit Message Quality as Agent Maturity Proxy

**Problem:** If agent commit messages are getting more descriptive over time, it would indicate prompt/tooling refinement. Conversely, if they're becoming formulaic, it suggests the agent prompts are stale.

**Method:** Tracked message length, conventional commit adoption (`feat:`, `fix:`, etc. prefix), detail score (mentions file paths, function names, or reason clauses), vocabulary diversity, and repeated messages. Compared agents vs humans by month.

#### Agents Adopted Conventional Commits Faster Than Humans

| Month | Agent Conv% | Human Conv% |
|-------|------------|-------------|
| Oct 2025 | 0.0% | 14.6% |
| Nov 2025 | 0.0% | 17.7% |
| Dec 2025 | 42.9% | 40.6% |
| Jan 2026 | 58.2% | 74.7% |
| Feb 2026 | **80.7%** | 66.2% |
| Mar 2026 | 70.6% | 51.1% |

The jump from 0% to 42.9% in December strongly suggests conventional commit tooling or prompt instructions were introduced around that time. By February, agents were more consistent than humans at following the convention.

#### Message Length Is Similar, Both Improving

Agents write slightly longer messages on average (median 62 chars vs 53 for humans). Both improved over time: agents +7.4%, humans +44.4% (humans started very terse).

#### Per-Agent Evolution

| Agent | Dec Med | Jan Med | Feb Med | Mar Med | Conv% Trend |
|-------|---------|---------|---------|---------|-------------|
| mayor | 28 | 57 | 64 | 62 | 36% -> 85% -> 73% |
| beads/crew/emma | 49 | 52 | 61 | **27** | 82% -> 81% -> **43%** |
| beads/refinery | - | 35 | 68 | 69 | 1% -> 41% -> 26% |
| furiosa | 69 | 59 | 73 | 68 | 100% -> 97% -> 93% |
| gastown/crew/max | 51 | 59 | 69 | 70 | 14% -> 100% -> 35% |

`furiosa` is consistently the highest-quality agent for message hygiene: 93-100% conventional adoption throughout, 59-73 char messages. `beads/crew/emma` shows a regression in March (median dropped to 27 chars, conventional to 43%), worth investigating. `mayor` improved dramatically from December (28 chars, 36% conventional) to February (64 chars, 85%).

#### Duplicate Messages Tell Different Stories

Agent duplicates are minimal (max 8 repeats for merge commits). Human duplicates are significant: "bd sync: apply DB changes after import" appears **87 times**, merge commits appear 76 and 45 times. Agents have far better hygiene on duplicate messages.

#### Vocabulary Diversity Inverted Over Time

Agents started with high diversity (3-5 unique words per commit) which dropped to 1.17 in January when agent volume exploded, then recovered to 2.36 by March. Humans show the opposite trend, increasing diversity as individual volume dropped. This suggests agents became more formulaic at scale but are recovering as prompts mature.

---

## Analysis Scripts Reference

All scripts in `/tmp/codecohesion-analysis/`:

| Script | Investigation |
|--------|--------------|
| `agent-quality.js` | Per-agent quality metrics (fix:feat, fix-after-feat, reverts, commit size) |
| `daemon-godobj.js` | daemon.go god-object trajectory with beads comparison |
| `pruning-analysis.js` | February pruning before/after coupling, decomposition map |
| `agent-autonomy.js` | Weekend/off-hours activity, supervised vs unsupervised quality |
| `cascade-timing.js` | Tag-triggered cascade response times and volume |
| `message-quality.js` | Commit message quality evolution, per-agent trends |
| `crossrepo.js` | Cross-repo shared authors, daily correlation, cascades (from initial analysis) |
| `architecture.js` | Architectural evolution, package growth (from initial analysis) |
| `velocity.js` | Velocity and contribution patterns (from initial analysis) |
