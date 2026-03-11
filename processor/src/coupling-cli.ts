/**
 * CLI tool for generating temporal coupling analysis
 *
 * Usage:
 *   npm run coupling -- output/repo-timeline-full.json
 *
 * Reads existing Timeline V2 JSON files and generates coupling graphs
 * with clustered bounded contexts using Louvain community detection.
 */

import fs from 'fs';
import path from 'path';
import { TimelineDataV2 } from '@codecohesion/shared-types';
import { CouplingAnalyzer } from './coupling-analyzer';

async function main() {
  // Parse command line arguments
  const timelineFile = process.argv[2];

  if (!timelineFile) {
    console.error('❌ Error: Timeline file path required');
    console.error('');
    console.error('Usage:');
    console.error('  npm run coupling -- <timeline-file.json>');
    console.error('');
    console.error('Example:');
    console.error('  npm run coupling -- output/gource-timeline-full.json');
    console.error('');
    console.error('Note: Only Timeline V2 format (-timeline-full.json) is supported');
    process.exit(1);
  }

  // Validate file exists
  if (!fs.existsSync(timelineFile)) {
    console.error(`❌ Error: File not found: ${timelineFile}`);
    process.exit(1);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Temporal Coupling Analysis');
  console.log('  Bounded Context Detection via Co-Change Patterns');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    // Load timeline data
    console.log(`\n📖 Loading timeline: ${path.basename(timelineFile)}`);
    const timelineContent = fs.readFileSync(timelineFile, 'utf-8');
    const timeline: TimelineDataV2 = JSON.parse(timelineContent);

    // Validate format
    if (timeline.format !== 'timeline-v2') {
      console.error(`❌ Error: Invalid format '${timeline.format}'`);
      console.error(`   Expected: 'timeline-v2'`);
      console.error('');
      console.error('   This tool requires Timeline V2 files (*-timeline-full.json)');
      console.error('   Generate with: npm run analyze:full-delta -- /path/to/repo');
      process.exit(1);
    }

    // Show timeline info
    console.log(`   Format: ${timeline.format}`);
    console.log(`   Repository: ${timeline.repositoryPath}`);
    console.log(`   Commits: ${timeline.commits.length.toLocaleString()}`);
    console.log(`   Date range: ${timeline.metadata.dateRange.first.substring(0, 10)} → ${timeline.metadata.dateRange.last.substring(0, 10)}`);

    // Run coupling analysis
    const analyzer = new CouplingAnalyzer();
    const coupling = analyzer.analyze(timeline, path.basename(timelineFile));

    // Generate output filename using base repository name
    // Strip -timeline and -timeline-full suffixes to get base repo name
    // Example: gource-timeline-full.json → gource-coupling.json
    const baseFileName = path.basename(timelineFile, '.json');
    const baseRepoName = baseFileName.replace(/-timeline(-full)?$/, '');
    const outputDir = path.dirname(timelineFile);
    const outputFile = path.join(outputDir, `${baseRepoName}-coupling.json`);

    // Write output
    console.log(`\n💾 Writing coupling graph...`);
    console.log(`   Input:  ${path.basename(timelineFile)}`);
    console.log(`   Output: ${path.basename(outputFile)}`);
    fs.writeFileSync(outputFile, JSON.stringify(coupling, null, 2));

    // Success summary
    console.log('');
    console.log('✓ Analysis complete!');
    console.log('');
    console.log('Results:');
    console.log(`  Files analyzed:    ${coupling.analysis.filesAnalyzed.toLocaleString()}`);
    console.log(`  Coupling edges:    ${coupling.analysis.couplingEdges.toLocaleString()}`);
    console.log(`  Clusters detected: ${coupling.clusters.length}`);
    console.log('');
    console.log('Cluster Summary:');

    // Show top 10 clusters
    coupling.clusters.slice(0, 10).forEach((cluster) => {
      console.log(`  ${cluster.name.padEnd(12)} ${cluster.fileCount.toString().padStart(4)} files  (avg coupling: ${cluster.avgInternalCoupling.toFixed(3)})`);
    });

    if (coupling.clusters.length > 10) {
      console.log(`  ... and ${coupling.clusters.length - 10} more clusters`);
    }

    console.log('');
    console.log(`Output saved to:`);
    console.log(`  ${outputFile}`);
    console.log('');
    console.log('Next steps:');
    console.log(`  1. Copy to viewer: cp ${outputFile} ../viewer/public/data/`);
    console.log(`  2. Reload viewer to see "Bounded Contexts" color mode`);
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Analysis failed:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    console.error('');
    process.exit(1);
  }
}

// Run CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
