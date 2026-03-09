#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import {
  RepositoryAnalyzer,
  TimelineAnalyzer,
  FullDeltaAnalyzer,
  CouplingAnalyzer,
} from 'codecohesion-processor';

const VERSION = '0.1.0';

function printUsage(): void {
  console.log(`
codecohesion v${VERSION} — Code cohesion analysis CLI

Usage:
  codecohesion analyze <path> [options]    Analyze a git repository
  codecohesion view [options]              Start the viewer dev server
  codecohesion serve [options]             Start the API server

Analyze options:
  --timeline         Generate Timeline V1 (adaptive sampling)
  --full-delta       Generate Timeline V2 (all commits)
  --coupling         Generate temporal coupling analysis
  --output <dir>     Output directory (default: ./output)
  --view             Open viewer after analysis

View options:
  --port <n>         Dev server port (default: 3000)

Serve options:
  --port <n>         API server port (default: 3001)
`);
}

async function analyzeCommand(args: string[]): Promise<void> {
  let repoPath = '';
  let timelineMode = false;
  let fullDeltaMode = false;
  let couplingMode = false;
  let outputDir = './output';
  let openViewer = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--timeline') {
      timelineMode = true;
    } else if (arg === '--full-delta') {
      fullDeltaMode = true;
    } else if (arg === '--coupling') {
      couplingMode = true;
    } else if (arg === '--output' && i + 1 < args.length) {
      outputDir = args[++i];
    } else if (arg === '--view') {
      openViewer = true;
    } else if (!arg.startsWith('--')) {
      repoPath = arg;
    }
  }

  if (!repoPath) {
    console.error('Error: repository path is required');
    console.error('Usage: codecohesion analyze <path> [--timeline|--full-delta|--coupling]');
    process.exit(1);
  }

  const resolvedRepoPath = path.resolve(repoPath);
  const resolvedOutputDir = path.resolve(outputDir);

  // Ensure output directory exists
  if (!fs.existsSync(resolvedOutputDir)) {
    fs.mkdirSync(resolvedOutputDir, { recursive: true });
  }

  const repoName = path.basename(resolvedRepoPath);

  if (couplingMode) {
    // Coupling requires full-delta first
    console.log('=== COUPLING ANALYSIS ===\n');
    console.log('Step 1: Generating full-delta timeline...');

    const fullDeltaAnalyzer = new FullDeltaAnalyzer(resolvedRepoPath);
    const v2Data = await fullDeltaAnalyzer.analyzeFullDelta();

    const timelinePath = path.join(resolvedOutputDir, `${repoName}-timeline-full.json`);
    fs.writeFileSync(timelinePath, JSON.stringify(v2Data, null, 2));
    console.log(`Timeline written to: ${timelinePath}`);

    console.log('\nStep 2: Analyzing temporal coupling...');
    const couplingAnalyzer = new CouplingAnalyzer();
    const couplingGraph = couplingAnalyzer.analyze(v2Data, timelinePath);

    const couplingPath = path.join(resolvedOutputDir, `${repoName}-coupling.json`);
    fs.writeFileSync(couplingPath, JSON.stringify(couplingGraph, null, 2));
    console.log(`Coupling analysis written to: ${couplingPath}`);
    console.log(`Clusters detected: ${couplingGraph.clusters.length}`);

  } else if (fullDeltaMode) {
    console.log('=== FULL DELTA MODE (Timeline V2) ===\n');

    const analyzer = new FullDeltaAnalyzer(resolvedRepoPath);
    const v2Data = await analyzer.analyzeFullDelta();

    const outputPath = path.join(resolvedOutputDir, `${repoName}-timeline-full.json`);
    fs.writeFileSync(outputPath, JSON.stringify(v2Data, null, 2));

    const fileSizeMB = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
    console.log(`Output written to: ${outputPath} (${fileSizeMB} MB)`);
    console.log(`Total commits: ${v2Data.metadata.totalCommits}`);

  } else if (timelineMode) {
    console.log('=== TIMELINE MODE (V1) ===\n');

    const analyzer = new RepositoryAnalyzer(resolvedRepoPath);
    const headSnapshot = await analyzer.analyze();

    const timelineAnalyzer = new TimelineAnalyzer(resolvedRepoPath);
    const timelineData = await timelineAnalyzer.analyzeTimeline(200, headSnapshot);

    const outputPath = path.join(resolvedOutputDir, `${repoName}-timeline.json`);
    fs.writeFileSync(outputPath, JSON.stringify(timelineData, null, 2));
    console.log(`Output written to: ${outputPath}`);
    console.log(`Selected ${timelineData.timeline.baseSampling.actualCount} of ${timelineData.timeline.totalCommits} commits`);

  } else {
    // Static HEAD snapshot
    const analyzer = new RepositoryAnalyzer(resolvedRepoPath);
    const snapshot = await analyzer.analyze();

    const outputPath = path.join(resolvedOutputDir, `${repoName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2));
    console.log(`Output written to: ${outputPath}`);
    console.log(`${snapshot.stats.totalFiles} files, ${snapshot.stats.totalLoc} LOC`);
  }

  if (openViewer) {
    console.log('\nStarting viewer...');
    viewCommand([]);
  }
}

function viewCommand(args: string[]): void {
  let port = '3000';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && i + 1 < args.length) {
      port = args[++i];
    }
  }

  const viewerDir = path.resolve(__dirname, '../../../viewer');
  if (!fs.existsSync(path.join(viewerDir, 'package.json'))) {
    console.error(`Viewer directory not found at: ${viewerDir}`);
    process.exit(1);
  }

  console.log(`Starting viewer on port ${port}...`);
  const child = spawn('npx', ['vite', '--port', port], {
    cwd: viewerDir,
    stdio: 'inherit',
    shell: true,
  });
  child.on('error', (error) => {
    console.error(`Failed to start viewer: ${error.message}`);
  });
}

function serveCommand(args: string[]): void {
  let port = '3001';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && i + 1 < args.length) {
      port = args[++i];
    }
  }

  const apiDir = path.resolve(__dirname, '../../../api');
  if (!fs.existsSync(path.join(apiDir, 'package.json'))) {
    console.error(`API directory not found at: ${apiDir}`);
    process.exit(1);
  }

  console.log(`Starting API server on port ${port}...`);
  const child = spawn('npx', ['ts-node', 'src/server.ts'], {
    cwd: apiDir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PORT: port },
  });
  child.on('error', (error) => {
    console.error(`Failed to start API server: ${error.message}`);
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case 'analyze':
      await analyzeCommand(subArgs);
      break;
    case 'view':
      viewCommand(subArgs);
      break;
    case 'serve':
      serveCommand(subArgs);
      break;
    case '--help':
    case '-h':
    case undefined:
      printUsage();
      break;
    case '--version':
    case '-v':
      console.log(`codecohesion v${VERSION}`);
      break;
    default:
      console.error(`Unknown command: ${subcommand}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
