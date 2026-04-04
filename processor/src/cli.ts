#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { RepositoryAnalyzer } from './analyze';
import { TimelineAnalyzer } from './timeline-analyzer';
import { FullDeltaAnalyzer } from './full-delta-analyzer';
import { CouplingAnalyzer } from './coupling-analyzer';

async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  let timelineMode = false;
  let fullDeltaMode = false;
  let targetCommitCount = 200;
  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--timeline') {
      timelineMode = true;
    } else if (arg === '--full-delta') {
      fullDeltaMode = true;
    } else if (arg === '--target-commits') {
      targetCommitCount = parseInt(args[++i], 10);
    } else if (!arg.startsWith('--')) {
      positionalArgs.push(arg);
    }
  }

  const repoPath = positionalArgs[0] || process.cwd();
  const outputPath = positionalArgs[1] || path.join(__dirname, '../output/repo-data.json');

  try {
    if (fullDeltaMode) {
      // Full Delta mode: Generate timeline-v2 with ALL commits as deltas
      console.log('=== FULL DELTA MODE (Timeline V2) ===\n');

      const analyzer = new FullDeltaAnalyzer(repoPath);
      const v2Data = await analyzer.analyzeFullDelta();

      // Determine output path
      const repoName = path.basename(repoPath);
      const v2OutputPath = path.join(__dirname, `../output/${repoName}-timeline-full.json`);

      // Ensure output directory exists
      const outputDir = path.dirname(v2OutputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Write output
      fs.writeFileSync(v2OutputPath, JSON.stringify(v2Data, null, 2));

      const fileSizeMB = (fs.statSync(v2OutputPath).size / (1024 * 1024)).toFixed(2);
      console.log(`\nOutput written to: ${v2OutputPath}`);
      console.log(`File size: ${fileSizeMB} MB`);
      console.log(`\nTimeline V2 Stats:`);
      console.log(`  Format: ${v2Data.format}`);
      console.log(`  Total commits: ${v2Data.metadata.totalCommits}`);
      console.log(`  Date range: ${v2Data.metadata.dateRange.first.substring(0, 10)} to ${v2Data.metadata.dateRange.last.substring(0, 10)}`);
      console.log(`  Version tags: ${v2Data.metadata.tags.length}`);
      console.log(`  Commits with deltas: ${v2Data.commits.length}`);

      if (v2Data.metadata.tags.length > 0) {
        console.log(`\nTags: ${v2Data.metadata.tags.slice(0, 5).join(', ')}${v2Data.metadata.tags.length > 5 ? '...' : ''}`);
      }

      // Run coupling analysis on the full-delta timeline
      console.log('\n=== COUPLING ANALYSIS ===\n');
      const couplingAnalyzer = new CouplingAnalyzer();
      const couplingData = couplingAnalyzer.analyze(v2Data, v2OutputPath);

      const couplingOutputPath = path.join(outputDir, `${repoName}-coupling.json`);
      fs.writeFileSync(couplingOutputPath, JSON.stringify(couplingData, null, 2));

      const couplingSizeMB = (fs.statSync(couplingOutputPath).size / (1024 * 1024)).toFixed(2);
      console.log(`\nCoupling output written to: ${couplingOutputPath}`);
      console.log(`File size: ${couplingSizeMB} MB`);
      console.log(`  Coupling edges: ${couplingData.edges.length}`);
      console.log(`  Clusters detected: ${couplingData.clusters.length}`);

    } else if (timelineMode) {
      // Timeline mode: Generate adaptive timeline with HEAD snapshot (V1)
      console.log('=== TIMELINE MODE (V1) ===');
      console.log(`Target commits: ${targetCommitCount}\n`);

      // First generate HEAD snapshot
      const analyzer = new RepositoryAnalyzer(repoPath);
      const headSnapshot = await analyzer.analyze();

      // Then generate timeline data
      const timelineAnalyzer = new TimelineAnalyzer(repoPath);
      const timelineData = await timelineAnalyzer.analyzeTimeline(targetCommitCount, headSnapshot);

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Write output
      fs.writeFileSync(outputPath, JSON.stringify(timelineData, null, 2));
      console.log(`Output written to: ${outputPath}`);
      console.log(`\nTimeline Stats:`);
      console.log(`  Total commits in repo: ${timelineData.timeline.totalCommits}`);
      console.log(`  Commits in base sampling: ${timelineData.timeline.baseSampling.actualCount}`);
      console.log(`  Date range: ${timelineData.timeline.dateRange.first} to ${timelineData.timeline.dateRange.last}`);
      console.log(`\nHEAD Snapshot Stats:`);
      console.log(`  Total files: ${timelineData.headSnapshot.stats.totalFiles}`);
      console.log(`  Total LOC: ${timelineData.headSnapshot.stats.totalLoc}`);
    } else {
      // Static mode: Generate HEAD snapshot only (backward compatible)
      const analyzer = new RepositoryAnalyzer(repoPath);
      const snapshot = await analyzer.analyze();

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Write output
      fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2));
      console.log(`\nOutput written to: ${outputPath}`);
      console.log(`\nStats:`);
      console.log(`  Total files: ${snapshot.stats.totalFiles}`);
      console.log(`  Total LOC: ${snapshot.stats.totalLoc}`);
      console.log(`  Files by extension:`, snapshot.stats.filesByExtension);
    }
  } catch (error) {
    console.error('Error analyzing repository:', error);
    process.exit(1);
  }
}

main();
