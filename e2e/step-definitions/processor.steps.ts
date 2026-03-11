import { Given, When, Then } from '@cucumber/cucumber';
import { CodeCohesionWorld } from '../support/world';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import assert from 'assert';

const execFileAsync = promisify(execFile);

const ROOT_DIR = path.resolve(__dirname, '../..');
const FIXTURE_REPO = path.resolve(__dirname, '../fixtures/test-repo');
const PROCESSOR_CLI = path.resolve(ROOT_DIR, 'processor/src/cli.ts');
const COUPLING_CLI = path.resolve(ROOT_DIR, 'processor/src/coupling-cli.ts');

/** Shared state for processor output across steps */
let parsedJson: Record<string, unknown> = {};
let couplingJson: Record<string, unknown> = {};
let timelineV2FilePath: string = '';

Given('a test fixture repository exists', function (this: CodeCohesionWorld) {
  const gitDir = path.join(FIXTURE_REPO, '.git');
  if (!fs.existsSync(gitDir)) {
    throw new Error(
      `Test fixture repo not found at ${FIXTURE_REPO}. ` +
      'Run: bash e2e/fixtures/create-test-repo.sh'
    );
  }
  this.fixtureRepoPath = FIXTURE_REPO;
  this.outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codecohesion-e2e-'));
});

When('I run the processor CLI with the test repo', async function (this: CodeCohesionWorld) {
  const outputFile = path.join(this.outputDir, 'output.json');
  try {
    const result = await execFileAsync(
      'npx',
      ['tsx', PROCESSOR_CLI, this.fixtureRepoPath, outputFile],
      { cwd: ROOT_DIR, timeout: 60000 }
    );
    this.lastStdout = result.stdout;
    this.lastStderr = result.stderr;
    this.lastExitCode = 0;
  } catch (error: unknown) {
    const execError = error as { code?: number; stdout?: string; stderr?: string };
    this.lastExitCode = execError.code ?? 1;
    this.lastStdout = execError.stdout ?? '';
    this.lastStderr = execError.stderr ?? '';
  }
});

When(
  'I run the processor CLI with the test repo and {string} flag',
  async function (this: CodeCohesionWorld, flag: string) {
    const outputFile = path.join(this.outputDir, 'output.json');
    try {
      const result = await execFileAsync(
        'npx',
        ['tsx', PROCESSOR_CLI, this.fixtureRepoPath, outputFile, flag],
        { cwd: ROOT_DIR, timeout: 120000 }
      );
      this.lastStdout = result.stdout;
      this.lastStderr = result.stderr;
      this.lastExitCode = 0;
    } catch (error: unknown) {
      const execError = error as { code?: number; stdout?: string; stderr?: string };
      this.lastExitCode = execError.code ?? 1;
      this.lastStdout = execError.stdout ?? '';
      this.lastStderr = execError.stderr ?? '';
    }
  }
);

Given(
  'a timeline V2 file has been generated for the test repo',
  async function (this: CodeCohesionWorld) {
    this.fixtureRepoPath = FIXTURE_REPO;
    this.outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codecohesion-e2e-'));
    const outputFile = path.join(this.outputDir, 'output.json');

    await execFileAsync(
      'npx',
      ['tsx', PROCESSOR_CLI, this.fixtureRepoPath, outputFile, '--full-delta'],
      { cwd: ROOT_DIR, timeout: 120000 }
    );

    // full-delta writes to processor/output/<reponame>-timeline-full.json
    // but we passed an explicit output path — however the CLI ignores the 2nd arg for full-delta mode.
    // It writes to processor/output/<basename>-timeline-full.json. Find it.
    const processorOutputDir = path.join(ROOT_DIR, 'processor/output');
    const files = fs.readdirSync(processorOutputDir);
    const timelineFile = files.find(f => f.includes('test-repo') && f.includes('timeline-full'));
    if (!timelineFile) {
      throw new Error('Timeline V2 file was not generated');
    }
    timelineV2FilePath = path.join(processorOutputDir, timelineFile);
  }
);

When(
  'I run the coupling CLI with the timeline V2 file',
  async function (this: CodeCohesionWorld) {
    try {
      const result = await execFileAsync(
        'npx',
        ['tsx', COUPLING_CLI, timelineV2FilePath],
        { cwd: ROOT_DIR, timeout: 60000 }
      );
      this.lastStdout = result.stdout;
      this.lastStderr = result.stderr;
      this.lastExitCode = 0;
    } catch (error: unknown) {
      const execError = error as { code?: number; stdout?: string; stderr?: string };
      this.lastExitCode = execError.code ?? 1;
      this.lastStdout = execError.stdout ?? '';
      this.lastStderr = execError.stderr ?? '';
    }
  }
);

Then('the exit code should be {int}', function (this: CodeCohesionWorld, expectedCode: number) {
  if (this.lastExitCode !== expectedCode) {
    throw new Error(
      `Expected exit code ${expectedCode} but got ${this.lastExitCode}.\n` +
      `stdout: ${this.lastStdout}\nstderr: ${this.lastStderr}`
    );
  }
});

Then('the output file should contain valid JSON', function (this: CodeCohesionWorld) {
  // For HEAD snapshot mode, the output file is at outputDir/output.json
  const outputFile = path.join(this.outputDir, 'output.json');
  if (fs.existsSync(outputFile)) {
    const content = fs.readFileSync(outputFile, 'utf-8');
    parsedJson = JSON.parse(content);
    return;
  }

  // For full-delta mode, check processor/output/ for test-repo timeline files
  const processorOutputDir = path.join(ROOT_DIR, 'processor/output');
  if (fs.existsSync(processorOutputDir)) {
    const files = fs.readdirSync(processorOutputDir);
    // Pick the timeline-full file specifically, not coupling
    const repoFile = files.find(f => f.includes('test-repo') && f.includes('timeline-full'));
    if (repoFile) {
      const content = fs.readFileSync(path.join(processorOutputDir, repoFile), 'utf-8');
      parsedJson = JSON.parse(content);
      return;
    }
  }

  throw new Error('No output file found');
});

Then('the JSON should have a {string} property', function (property: string) {
  assert.ok(
    property in parsedJson,
    `Expected JSON to have property "${property}". Keys: ${Object.keys(parsedJson).join(', ')}`
  );
});

Then('the JSON should have a {string} of {string}', function (property: string, expectedValue: string) {
  assert.strictEqual(
    (parsedJson as Record<string, unknown>)[property],
    expectedValue,
    `Expected "${property}" to be "${expectedValue}" but got "${(parsedJson as Record<string, unknown>)[property]}"`
  );
});

Then('the stats should have {string} greater than {int}', function (field: string, minValue: number) {
  const stats = parsedJson['stats'] as Record<string, unknown>;
  assert.ok(stats, 'Expected "stats" in JSON');
  const actualValue = stats[field] as number;
  assert.ok(
    actualValue > minValue,
    `Expected stats.${field} > ${minValue}, got ${actualValue}`
  );
});

Then('the stats should have a {string} object', function (field: string) {
  const stats = parsedJson['stats'] as Record<string, unknown>;
  assert.ok(stats, 'Expected "stats" in JSON');
  assert.ok(
    typeof stats[field] === 'object' && stats[field] !== null,
    `Expected stats.${field} to be an object`
  );
});

Then(
  'the JSON should have a {string} array with at least {int} entry',
  function (property: string, minEntries: number) {
    const arr = (parsedJson as Record<string, unknown>)[property];
    assert.ok(Array.isArray(arr), `Expected "${property}" to be an array`);
    assert.ok(
      (arr as unknown[]).length >= minEntries,
      `Expected "${property}" to have at least ${minEntries} entries, got ${(arr as unknown[]).length}`
    );
  }
);

Then('the coupling output file should contain valid JSON', function () {
  // coupling writes to same dir as input, with -coupling suffix
  const dir = path.dirname(timelineV2FilePath);
  const files = fs.readdirSync(dir);
  const couplingFile = files.find(f => f.includes('test-repo') && f.includes('coupling'));
  if (!couplingFile) {
    throw new Error(`No coupling output file found in ${dir}. Files: ${files.join(', ')}`);
  }
  const content = fs.readFileSync(path.join(dir, couplingFile), 'utf-8');
  couplingJson = JSON.parse(content);
});

Then('the coupling JSON should have a {string} of {string}', function (property: string, expectedValue: string) {
  assert.strictEqual(
    (couplingJson as Record<string, unknown>)[property],
    expectedValue,
    `Expected coupling "${property}" to be "${expectedValue}"`
  );
});

Then('the coupling JSON should have an {string} array', function (property: string) {
  const value = (couplingJson as Record<string, unknown>)[property];
  assert.ok(Array.isArray(value), `Expected coupling "${property}" to be an array`);
});

Then('the coupling JSON should have a {string} array', function (property: string) {
  const value = (couplingJson as Record<string, unknown>)[property];
  assert.ok(Array.isArray(value), `Expected coupling "${property}" to be an array`);
});
