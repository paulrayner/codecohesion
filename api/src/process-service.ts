import { EventEmitter } from 'events';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  RepositoryAnalyzer,
  TimelineAnalyzer,
  FullDeltaAnalyzer,
  CouplingAnalyzer,
  StructureAnalyzer,
  Logger,
} from 'codecohesion-processor';
import type { RepositorySnapshot } from './types';

const execFileAsync = promisify(execFile);

// Resolved at module load time relative to this file's location (api/src/).
// In production (dist/), __dirname is api/dist/ so we step up two levels to reach
// viewer/public/data/. In development (ts-node), __dirname is api/src/ — same result.
const DEFAULT_DATA_DIR = path.join(__dirname, '../../viewer/public/data');
const CLONE_BASE_DIR = path.join(os.tmpdir(), 'codecohesion-clones');

export type ProcessMode = 'head' | 'timeline-v1' | 'timeline-v2' | 'coupling' | 'structure';

const VALID_MODES = new Set<ProcessMode>(['head', 'timeline-v1', 'timeline-v2', 'coupling', 'structure']);

export interface ProcessJob {
  id: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  mode: ProcessMode;
  repoPath: string;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  outputFile?: string;
  emitter: EventEmitter;
}

export interface ProcessRequest {
  repoPath?: string;
  repoUrl?: string;
  mode: ProcessMode;
  targetCommits?: number;
}

export interface ProgressEvent {
  type: 'progress' | 'complete' | 'error';
  message: string;
  percent?: number;
}

/**
 * Parse a progress message to estimate completion percentage.
 * Recognises patterns like "Processed 50/100 commits" or "Analyzing 3/10 files".
 * Returns undefined when no numeric progress can be extracted.
 */
function parseProgressPercent(message: string): number | undefined {
  const match = message.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return undefined;

  const current = Number(match[1]);
  const total = Number(match[2]);

  if (isNaN(current) || isNaN(total) || total === 0) return undefined;

  return Math.round((current / total) * 100);
}

/**
 * Build a Logger that forwards all messages as ProgressEvents on the given emitter.
 * Warnings and errors are forwarded at the 'progress' level so the SSE stream
 * stays open; a separate 'error' event is emitted for error-level messages.
 */
function buildProgressLogger(emitter: EventEmitter): Logger {
  return {
    log(message: string): void {
      const event: ProgressEvent = {
        type: 'progress',
        message,
        percent: parseProgressPercent(message),
      };
      emitter.emit('progress', event);
    },

    warn(message: string): void {
      const event: ProgressEvent = {
        type: 'progress',
        message: `[warn] ${message}`,
      };
      emitter.emit('progress', event);
    },

    error(message: string): void {
      const event: ProgressEvent = {
        type: 'error',
        message,
      };
      emitter.emit('progress', event);
    },
  };
}

/**
 * Derive a safe filesystem-friendly repo name from a path or URL.
 * Examples:
 *   "/home/user/my-project"  → "my-project"
 *   "https://github.com/org/repo.git" → "repo"
 */
function repoNameFromPath(repoPath: string): string {
  const base = repoPath.replace(/\.git\/?$/, '').replace(/\/$/, '');
  return path.basename(base);
}

/**
 * Deterministic hash of a URL used as a clone directory name.
 * Keeps clone dirs stable across restarts so we can reuse them.
 */
function urlToCloneDir(url: string): string {
  const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 12);
  const repoName = repoNameFromPath(url);
  return path.join(CLONE_BASE_DIR, `${repoName}-${hash}`);
}

/**
 * Clone a remote URL to a local directory, reusing an existing clone when
 * the target directory already contains a git repository.
 */
async function ensureCloned(url: string, logger: Logger): Promise<string> {
  const cloneDir = urlToCloneDir(url);

  try {
    await fs.access(path.join(cloneDir, '.git'));
    logger.log(`Reusing existing clone at ${cloneDir}`);
    return cloneDir;
  } catch (err) {
    // Only proceed with a fresh clone when the path does not exist (ENOENT).
    // Re-throw other errors (e.g. permission denied) so the job fails explicitly.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }

  await fs.mkdir(cloneDir, { recursive: true });
  logger.log(`Cloning ${url} into ${cloneDir}…`);

  // Full clone required for timeline analysis (needs full history).
  // Using execFile with args array to prevent command injection via URL.
  await execFileAsync('git', ['clone', url, cloneDir]);

  logger.log(`Clone complete.`);
  return cloneDir;
}

/**
 * Read repos.json from the data directory, add the repo name if absent, and
 * write it back. Creates the file from scratch when it does not yet exist.
 */
async function updateReposJson(dataDir: string, repoName: string): Promise<void> {
  const reposJsonPath = path.join(dataDir, 'repos.json');

  let repos: string[] = [];

  try {
    const raw = await fs.readFile(reposJsonPath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    // Viewer expects { repos: [...] } format
    if (parsed && typeof parsed === 'object' && 'repos' in parsed && Array.isArray((parsed as { repos: unknown }).repos)) {
      repos = (parsed as { repos: string[] }).repos.filter((entry): entry is string => typeof entry === 'string');
    } else if (Array.isArray(parsed)) {
      repos = parsed.filter((entry): entry is string => typeof entry === 'string');
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // File does not yet exist — start with an empty list.
    } else {
      // File exists but could not be read or parsed; log a warning and start fresh
      // rather than propagating an error that would abort the analysis job.
      console.warn('updateReposJson: could not read repos.json, starting fresh:', err);
    }
  }

  if (!repos.includes(repoName)) {
    repos.push(repoName);
    await fs.writeFile(reposJsonPath, JSON.stringify({ repos }, null, 2), 'utf-8');
  }
}

/**
 * Validate a ProcessRequest, throwing descriptive errors for invalid input.
 * Per the "explicit error handling" standard, each case is checked individually.
 */
async function validateRequest(request: ProcessRequest): Promise<void> {
  const { repoPath, repoUrl, mode } = request;

  if (repoPath != null && repoUrl != null) {
    throw new Error('Provide either repoPath or repoUrl, not both.');
  }

  if (repoPath == null && repoUrl == null) {
    throw new Error('Either repoPath or repoUrl must be provided.');
  }

  if (!VALID_MODES.has(mode)) {
    throw new Error(
      `Invalid mode '${mode}'. Valid modes are: ${[...VALID_MODES].join(', ')}.`
    );
  }

  if (repoPath != null) {
    try {
      const stat = await fs.stat(repoPath);
      if (!stat.isDirectory()) {
        throw new Error(`repoPath '${repoPath}' exists but is not a directory.`);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`repoPath '${repoPath}' does not exist.`);
      }
      throw err;
    }
  }
}

/**
 * ProcessService orchestrates processor library calls, manages job lifecycle,
 * and exposes an EventEmitter per job for SSE progress streaming.
 */
export class ProcessService {
  private readonly jobs = new Map<string, ProcessJob>();
  private readonly dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir ?? process.env.DATA_DIR ?? DEFAULT_DATA_DIR;
  }

  /**
   * Validate the request, create a job record, and kick off async processing.
   * Returns the job ID immediately — callers subscribe via getJobEmitter().
   */
  async startJob(request: ProcessRequest): Promise<string> {
    await validateRequest(request);

    const jobId = crypto.randomUUID();
    const emitter = new EventEmitter();

    // repoPath is guaranteed non-null after validation (either directly provided
    // or resolved from repoUrl during execution).
    const job: ProcessJob = {
      id: jobId,
      status: 'pending',
      mode: request.mode,
      repoPath: request.repoPath ?? request.repoUrl ?? '',
      startedAt: new Date(),
      emitter,
    };

    this.jobs.set(jobId, job);

    // Run asynchronously so startJob returns without blocking.
    this.runJob(jobId, request).catch((err: unknown) => {
      // Catch unhandled rejections that escape runJob's own error handling.
      console.error(`Unhandled error in job ${jobId}:`, err);
    });

    return jobId;
  }

  /**
   * Return the EventEmitter for a job so callers can subscribe to progress events.
   * Returns undefined when the job ID is not recognised.
   */
  getJobEmitter(jobId: string): EventEmitter | undefined {
    return this.jobs.get(jobId)?.emitter;
  }

  /**
   * Return a snapshot of a job's current state (without the emitter).
   * Returns undefined when the job ID is not recognised.
   */
  getJob(jobId: string): Omit<ProcessJob, 'emitter'> | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    const { emitter: _emitter, ...rest } = job;
    return rest;
  }

  // ---------------------------------------------------------------------------
  // Private implementation
  // ---------------------------------------------------------------------------

  private async runJob(jobId: string, request: ProcessRequest): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'running';
    const logger = buildProgressLogger(job.emitter);

    try {
      await fs.mkdir(this.dataDir, { recursive: true });

      // Resolve local path — clone if a remote URL was supplied.
      const localPath = request.repoUrl
        ? await ensureCloned(request.repoUrl, logger)
        : (request.repoPath as string);

      // Keep job.repoPath up to date with the resolved local path.
      job.repoPath = localPath;

      const repoName = repoNameFromPath(localPath);
      const outputFile = await this.runAnalysis(job, localPath, repoName, request, logger);

      await updateReposJson(this.dataDir, repoName);

      job.status = 'complete';
      job.completedAt = new Date();
      job.outputFile = outputFile;

      const completeEvent: ProgressEvent = {
        type: 'complete',
        message: `Processing complete. Output written to ${outputFile}`,
        percent: 100,
      };
      job.emitter.emit('progress', completeEvent);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      job.status = 'error';
      job.completedAt = new Date();
      job.error = message;

      const errorEvent: ProgressEvent = {
        type: 'error',
        message,
      };
      job.emitter.emit('progress', errorEvent);
    }
  }

  /**
   * Dispatch to the correct analyzer based on the job mode and write output.
   * Returns the absolute path of the written output file.
   */
  private async runAnalysis(
    job: ProcessJob,
    localPath: string,
    repoName: string,
    request: ProcessRequest,
    logger: Logger
  ): Promise<string> {
    switch (job.mode) {
      case 'head':
        return this.runHeadAnalysis(localPath, repoName, logger);

      case 'timeline-v1':
        return this.runTimelineV1Analysis(localPath, repoName, request, logger);

      case 'timeline-v2':
        return this.runTimelineV2Analysis(localPath, repoName, logger);

      case 'coupling':
        return this.runCouplingAnalysis(localPath, repoName, logger);

      case 'structure':
        return this.runStructureAnalysis(localPath, repoName, logger);
    }
  }

  private async runHeadAnalysis(
    localPath: string,
    repoName: string,
    logger: Logger
  ): Promise<string> {
    const analyzer = new RepositoryAnalyzer(localPath, logger);
    const snapshot = await analyzer.analyze();
    return this.writeOutput(repoName, snapshot);
  }

  private async runTimelineV1Analysis(
    localPath: string,
    repoName: string,
    request: ProcessRequest,
    logger: Logger
  ): Promise<string> {
    // Timeline V1 requires a HEAD snapshot first.
    const headAnalyzer = new RepositoryAnalyzer(localPath, logger);
    const headSnapshot: RepositorySnapshot = await headAnalyzer.analyze();

    const timelineAnalyzer = new TimelineAnalyzer(localPath, logger);

    // analyzeTimeline(targetCommitCount, headSnapshot)
    const targetCommits = request.targetCommits ?? 200;
    const timelineData = await timelineAnalyzer.analyzeTimeline(targetCommits, headSnapshot);

    // Timeline V1 output uses the same filename as HEAD — it includes headSnapshot.
    return this.writeOutput(repoName, timelineData);
  }

  private async runTimelineV2Analysis(
    localPath: string,
    repoName: string,
    logger: Logger
  ): Promise<string> {
    const analyzer = new FullDeltaAnalyzer(localPath, logger);
    const data = await analyzer.analyzeFullDelta();
    return this.writeOutput(`${repoName}-timeline-full`, data);
  }

  private async runCouplingAnalysis(
    localPath: string,
    repoName: string,
    logger: Logger
  ): Promise<string> {
    // Coupling analysis requires a full-delta timeline first
    logger.log('Generating full-delta timeline for coupling analysis...');
    const deltaAnalyzer = new FullDeltaAnalyzer(localPath, logger);
    const timelineData = await deltaAnalyzer.analyzeFullDelta();

    // Write timeline first (needed as input file path for coupling)
    const timelinePath = await this.writeOutput(`${repoName}-timeline-full`, timelineData);

    // Run coupling analysis on the timeline data
    const couplingAnalyzer = new CouplingAnalyzer(logger);
    const couplingData = couplingAnalyzer.analyze(timelineData, timelinePath);
    return this.writeOutput(`${repoName}-coupling`, couplingData);
  }

  private async runStructureAnalysis(
    localPath: string,
    repoName: string,
    logger: Logger
  ): Promise<string> {
    const analyzer = new StructureAnalyzer(localPath, logger);
    const structureData = await analyzer.analyze();
    return this.writeOutput(`${repoName}-structure`, structureData);
  }

  /**
   * Serialise data to JSON and write to the data directory.
   * Returns the absolute path of the written file.
   */
  private async writeOutput(baseName: string, data: unknown): Promise<string> {
    const outputFile = path.join(this.dataDir, `${baseName}.json`);
    await fs.writeFile(outputFile, JSON.stringify(data, null, 2), 'utf-8');
    return outputFile;
  }
}
