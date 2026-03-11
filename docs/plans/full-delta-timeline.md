# Full Delta Timeline: Remaining Work

**Original Plan Date:** 2025-10-20
**Status:** Phases 1-3 mostly implemented (v0.9.0). This document tracks remaining items only.

**What's been built:** TreeBuilder, DeltaReplayController, keyframe-based seeking, VCR playback controls (play/pause/step/scrub), variable speed (1x-1000x), ghost file rendering, commit info overlay, tag markers, mode switcher. See `viewer/src/TreeBuilder.ts`, `viewer/src/DeltaReplayController.ts`, `processor/src/full-delta-analyzer.ts`.

---

## Remaining Phase 3 Items

### File Rename/Move Detection
- [ ] Detect git rename patterns (`{old => new}`) and animate smooth file transitions
- [ ] Detect directory moves (matching deletion + addition sets) and animate subtree slides

### Camera Auto-Tracking
- [ ] Option to auto-pan camera to follow areas of change during playback
- [ ] Auto-zoom to keep all files in view as tree grows

### Video Export
- [ ] Export timeline playback as WebM/MP4 video
- [ ] Screenshot current view

---

## Phase 4: Enhanced Per-File Metrics

**Goal:** Add per-file historical LOC tracking for accurate file size evolution.

- [ ] Extend `CommitSnapshot` format with per-file line stats (`linesAdded`, `linesDeleted`, `locAfter`)
- [ ] Update processor to extract per-file LOC changes via `git log --numstat`
- [ ] Implement file size growth animation (files grow/shrink visually over time)
- [ ] Add churn heatmap over time (which files are "hottest" at each point)
- [ ] Show contributor territories evolving
- [ ] Display "hottest files" changing throughout history

**Trade-off:** ~40% file size increase (path + 3 numbers per file vs path only). Consider as "Timeline V3" format.

---

## Open Questions

1. Should keyframes be generated on-demand and cached (IndexedDB) rather than embedded in JSON?
2. Optimal keyframe density — current: every 100 commits. Worth profiling for different repo sizes.

---

## Related Documents

- [Timeline format reference](../reference/timeline-format.md)
- [Gource comparison](../research/gource-comparison.md)
