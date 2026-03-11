# CodeCohesion Timeline Format Documentation

## Overview

The CodeCohesion timeline format is an extension of the static repository snapshot format that adds temporal evolution data. It maintains backward compatibility by including a complete `headSnapshot` object while adding adaptive sampling of historical commits.

**Format Version:** `timeline-v1`

**Key Features:**
- Adaptive commit sampling (adaptive-v2 algorithm)
- Delta-based commit representation (file changes only)
- Full HEAD snapshot for compatibility
- Support for git tags, merge commits, and importance scoring
- Designed for visualization of repository evolution over time

## File Structure

### Root Level

```json
{
  "format": "timeline-v1",
  "repositoryPath": "/Users/paul/Documents/react",
  "headSnapshot": { ... },
  "timeline": { ... }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `format` | string | Format identifier (`"timeline-v1"`) |
| `repositoryPath` | string | Absolute path to the analyzed repository |
| `headSnapshot` | RepositorySnapshot | Complete snapshot of repository at HEAD |
| `timeline` | Timeline | Historical commit sampling and metadata |

---

## headSnapshot Object

The `headSnapshot` contains the complete current state of the repository, identical to the static format. This ensures timeline files can be displayed in static mode.

### Example (React, October 2025)

```json
{
  "commit": "1324e1bb1f867e8b2108ca52a1d4e2d4ef56d2d9",
  "timestamp": "2025-10-16T13:08:57-07:00",
  "author": "Joseph Savona",
  "message": "[compiler] Cleanup and enable validateNoVoidUseMemo (#34882)",
  "tree": {
    "path": "",
    "name": "root",
    "type": "directory",
    "children": [ ... ]
  },
  "commitMessages": { ... },
  "stats": {
    "totalFiles": 6784,
    "totalLoc": 918533,
    "filesByExtension": {
      "js": 3762,
      "md": 1850,
      "ts": 408,
      "tsx": 121,
      "json": 140,
      "css": 108,
      ...
    }
  }
}
```

### Tree Structure

The `tree` field contains a recursive directory structure with file metadata:

```json
{
  "path": ".codesandbox",
  "name": ".codesandbox",
  "type": "directory",
  "children": [
    {
      "path": ".codesandbox/ci.json",
      "name": "ci.json",
      "type": "file",
      "loc": 13,
      "extension": "json",
      "lastModified": "2025-08-29T04:03:12+05:30",
      "lastAuthor": "Smruti Ranjan Badatya",
      "lastCommitHash": "6b49c449b6d32dcfb846559fd422ff67055b8923",
      "commitCount": 15,
      "contributorCount": 10,
      "firstCommitDate": "2019-10-31T18:44:48+01:00",
      "recentLinesChanged": null,
      "avgLinesPerCommit": null,
      "daysSinceLastModified": null
    }
  ]
}
```

**File Metrics:**
- `loc` - Lines of code (current)
- `commitCount` - Total commits that touched this file (churn)
- `contributorCount` - Number of unique contributors
- `firstCommitDate` - When the file was created
- `recentLinesChanged` - Lines changed in last 90 days (volatility)
- `avgLinesPerCommit` - Average change size
- `daysSinceLastModified` - Age metric

---

## timeline Object

Contains metadata about the repository history and adaptive sampling results.

### Structure

```json
{
  "totalCommits": 21078,
  "dateRange": {
    "first": "2013-05-28T17:04:45.000Z",
    "last": "2025-10-17T18:37:28.000Z"
  },
  "baseSampling": {
    "algorithm": "adaptive-v2",
    "targetCount": 200,
    "actualCount": 200,
    "commits": [ ... ]
  },
  "drillDownLayers": [ ... ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `totalCommits` | number | Total commits in repository history |
| `dateRange.first` | string | ISO 8601 timestamp of first commit |
| `dateRange.last` | string | ISO 8601 timestamp of last (HEAD) commit |
| `baseSampling.algorithm` | string | Sampling algorithm identifier |
| `baseSampling.targetCount` | number | Requested number of commits to sample |
| `baseSampling.actualCount` | number | Actual commits selected (may exceed target) |
| `baseSampling.commits` | CommitSnapshot[] | Array of selected commits |
| `drillDownLayers` | DrillDownLayer[] | *(Optional)* Future feature for time-range zooming |

### Adaptive Sampling Algorithm (v2)

The `adaptive-v2` algorithm selects commits based on:
1. **Repository-specific percentile thresholds** - Adapts to project size and commit patterns
2. **Milestone detection** - Version tags, first/last commits, merge commits
3. **Temporal spread** - Ensures even distribution across time periods
4. **Significance scoring** - File changes, line changes, directory impact

This approach successfully captures **100% of version tags** in test repositories while maintaining temporal continuity.

---

## CommitSnapshot Object

Each selected commit is represented as a delta (changes only), not a full tree snapshot.

### Example: Tagged Release Commit

```json
{
  "hash": "a54333842fff597986ec686ed46c91007e76fa18",
  "date": "2013-07-17T18:25:30.000Z",
  "author": "Paul O'Shannessy",
  "message": "Bump version for v0.4.0",
  "tags": ["v0.4.0"],
  "isMergeCommit": false,
  "importanceScore": 130,
  "changes": {
    "filesAdded": [],
    "filesModified": [
      "docs/_config.yml",
      "package.json"
    ],
    "filesDeleted": [],
    "totalFilesChanged": 2,
    "linesAdded": 32,
    "linesDeleted": 33
  }
}
```

### Example: Merge Commit with Deletions

```json
{
  "hash": "e829f8f71faa98f235701a098a4819c9451b4211",
  "date": "2013-06-03T17:58:01.000Z",
  "author": "Ben Newman",
  "message": "Merge pull request #1 from benjamn/run-tests-in-iframes",
  "tags": [],
  "isMergeCommit": true,
  "importanceScore": 128,
  "changes": {
    "filesAdded": [
      "Gruntfile.js",
      "grunt/tasks/phantom.js",
      "src/utils/__tests__/ImmutableObject-test.js",
      "test/frame.html",
      "vendor/jasmine/all.js",
      "vendor/jasmine/jasmine-html.js"
    ],
    "filesModified": [
      "grunt/config/browserify.js",
      "grunt/tasks/browserify.js",
      "src/test/all.js",
      "test/index.html"
    ],
    "filesDeleted": [
      "{src/test => vendor/jasmine}/phantom.js"
    ],
    "totalFilesChanged": 22,
    "linesAdded": 241,
    "linesDeleted": 79
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `hash` | string | Full git commit SHA-1 hash |
| `date` | string | ISO 8601 commit timestamp |
| `author` | string | Commit author name |
| `message` | string | Full commit message |
| `tags` | string[] | Git tags at this commit (e.g., `["v1.0.0"]`) |
| `isMergeCommit` | boolean | Whether this is a merge commit |
| `importanceScore` | number | Calculated significance (0-200+, higher = more important) |
| `changes.filesAdded` | string[] | Paths of files created in this commit |
| `changes.filesModified` | string[] | Paths of files changed in this commit |
| `changes.filesDeleted` | string[] | Paths of files removed in this commit |
| `changes.totalFilesChanged` | number | Sum of added + modified + deleted |
| `changes.linesAdded` | number | Lines inserted across all files |
| `changes.linesDeleted` | number | Lines removed across all files |
| `tree` | DirectoryNode | *(Optional)* Full tree snapshot - **not currently implemented** |

---

## Design Decisions

### 1. Delta-Based Representation

**Current Approach:**
- Only store file change lists (`filesAdded`, `filesModified`, `filesDeleted`)
- Include line change counts for context
- No historical directory tree snapshots

**Rationale:**
- Minimal file size (8.2MB for 21K React commits → 200 samples)
- Fast generation and transfer
- Sufficient for "change highlighting" visualization

**Trade-off:**
- Cannot reconstruct historical file structure
- Cannot show deleted files in 3D visualization
- Cannot display accurate historical LOC/metrics

### 2. Keyframe Architecture (Planned, Not Implemented)

The optional `tree` field in `CommitSnapshot` is reserved for future "keyframe" functionality:

```typescript
tree?: DirectoryNode;  // Optional - full tree for keyframes only
```

**Future Implementation:**
- Store full tree snapshots at strategic commits (e.g., every 10th commit, version tags)
- Enable "time machine" mode that reconstructs historical file structures
- Support accurate historical metrics and deleted file visualization

**Current Status:**
```typescript
// processor/src/timeline-analyzer.ts:106
// tree: undefined - will be added in future phase for keyframes
```

### 3. Backward Compatibility

Including `headSnapshot` ensures timeline files work in static mode:
- Viewers can fall back to displaying only HEAD
- File size impact is minimal (same data needed anyway)
- Simplifies tooling and testing

---

## Current Limitations

### Cannot Visualize Historical Tree Structure

**Problem:** Without `tree` snapshots in commits, the viewer cannot reconstruct the directory structure as it existed at historical points.

**Current Behavior:**
- Timeline playback shows the **current** (HEAD) tree structure
- Highlights files that changed in each commit
- Shows warning if changed files don't exist in HEAD

**What This Means:**
- ✅ Can see **which files changed** at each commit
- ✅ Can highlight changed files **if they still exist**
- ❌ Cannot show files that were **deleted between that commit and HEAD**
- ❌ Cannot display **accurate historical LOC/size** data
- ❌ Cannot render the **3D tree as it actually looked** in the past

**Warning Example (Timeline Viewer):**
```
⚠️ Cannot highlight changes - 12 files not in current view
```

This occurs when commits modified files that no longer exist in HEAD.

---

## File Organization

### Processor (Generation)

**Command:**
```bash
cd processor
npm run analyze:timeline -- /path/to/repo
```

**Output:**
- File: `processor/output/<repo-name>-timeline.json`
- Format: `timeline-v1`
- Algorithm: `adaptive-v2`
- Default target: 200 commits

**Type Definitions:**
- [processor/src/types.ts](../processor/src/types.ts) - `TimelineData`, `CommitSnapshot`, `DrillDownLayer`

**Implementation:**
- [processor/src/timeline-analyzer.ts](../processor/src/timeline-analyzer.ts) - Adaptive sampling logic
- [processor/src/analyze.ts](../processor/src/analyze.ts) - CLI integration

### Viewer (Consumption)

**Location:** `viewer/public/data/<repo-name>-timeline.json` (symlinked from processor output)

**Type Definitions:**
- [viewer/src/types.ts](../viewer/src/types.ts) - Mirror of processor types

**Implementation:**
- [viewer/src/main.ts](../viewer/src/main.ts) - Timeline playback controls, file highlighting
- [viewer/src/TreeVisualizer.ts](../viewer/src/TreeVisualizer.ts) - 3D rendering, visual feedback

### Naming Convention

| File Name | Format | Description |
|-----------|--------|-------------|
| `repo-name.json` | Static | HEAD-only snapshot |
| `repo-name-timeline.json` | Timeline | HEAD + historical commits |

---

## Example Repositories

The following timeline analyses are available in the project:

| Repository | Total Commits | Sampled | Date Range | Tags |
|------------|---------------|---------|------------|------|
| **React** | 21,078 | 200 | 2013-2025 (12 years) | 69 |
| **cBioPortal** | 22,854 | 325 | 2011-2025 (14 years) | Multiple |
| **cBioPortal Frontend** | ~10,000 | 200 | 2015-2025 (10 years) | Multiple |
| **Gource** | 988 | 50 | 2009-2025 (16 years) | 22 |
| **codecohesion** | ~100 | 50 | 2024-2025 (1 year) | 0 |

All timeline files maintain 100% version tag capture in testing.

---

## Future Enhancements

### 1. Keyframe Tree Snapshots
- Store full `tree` for every Nth commit (configurable)
- Enable true "time machine" visualization
- Support deleted file rendering

### 2. Drill-Down Layers
- Implement `drillDownLayers` for time-range zooming
- Allow detailed exploration of specific periods
- Dynamic loading for performance

### 3. Incremental Updates
- Support updating existing timeline files with new commits
- Avoid full re-analysis of large repositories
- Maintain sampling consistency

### 4. Compression
- Investigate tree diff compression for keyframes
- Reduce file size for very large repositories
- Maintain fast decompression for viewer

---

## Related Documentation

- [CLAUDE.md](../.claude/CLAUDE.md) - Project conventions and development notes
- [processor/src/types.ts](../processor/src/types.ts) - Type definitions
- [processor/src/timeline-analyzer.ts](../processor/src/timeline-analyzer.ts) - Implementation details
