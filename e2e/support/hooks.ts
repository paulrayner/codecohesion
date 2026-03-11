import { BeforeAll, AfterAll, Before, After } from '@cucumber/cucumber';
import { CodeCohesionWorld } from './world';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

const ROOT_DIR = path.resolve(__dirname, '../..');
const FIXTURE_REPO = path.resolve(__dirname, '../fixtures/test-repo');
const PROCESSOR_CLI = path.resolve(ROOT_DIR, 'processor/src/cli.ts');
const API_DATA_DIR = path.resolve(ROOT_DIR, 'api/data');

/** Track whether we created the api/data directory so we can clean it up */
let createdApiDataDir = false;

BeforeAll(async function () {
  // Ensure test fixture repo exists
  if (!fs.existsSync(path.join(FIXTURE_REPO, '.git'))) {
    const createScript = path.resolve(__dirname, '../fixtures/create-test-repo.sh');
    execFileSync('bash', [createScript], { cwd: ROOT_DIR });
  }

  // Generate fixture data for the API by running the processor on the test repo
  if (!fs.existsSync(API_DATA_DIR)) {
    fs.mkdirSync(API_DATA_DIR, { recursive: true });
    createdApiDataDir = true;
  }

  const outputFile = path.join(API_DATA_DIR, 'test-repo-static.json');
  if (!fs.existsSync(outputFile)) {
    execFileSync('npx', ['tsx', PROCESSOR_CLI, FIXTURE_REPO, outputFile], {
      cwd: ROOT_DIR,
      timeout: 60000,
    });
  }

  // Start the API server on an ephemeral port
  // Dynamic import to avoid top-level side effects
  const { createApp } = await import('../../api/src/server');
  const app = createApp();

  await new Promise<void>((resolve) => {
    CodeCohesionWorld.server = app.listen(0, () => {
      const address = CodeCohesionWorld.server!.address();
      if (address && typeof address === 'object') {
        CodeCohesionWorld.serverPort = address.port;
      }
      resolve();
    });
  });
});

AfterAll(async function () {
  // Stop the API server
  if (CodeCohesionWorld.server) {
    await new Promise<void>((resolve) => {
      CodeCohesionWorld.server!.close(() => resolve());
    });
    CodeCohesionWorld.server = null;
  }

  // Clean up generated fixture data
  const outputFile = path.join(API_DATA_DIR, 'test-repo-static.json');
  if (fs.existsSync(outputFile)) {
    fs.unlinkSync(outputFile);
  }
  if (createdApiDataDir) {
    // Only remove if we created it and it's empty
    try {
      fs.rmdirSync(API_DATA_DIR);
    } catch {
      // Directory not empty — leave it alone
    }
  }
});

Before({ tags: '@api' }, function (this: CodeCohesionWorld) {
  this.apiBaseUrl = `http://localhost:${CodeCohesionWorld.serverPort}`;
});

After(function (this: CodeCohesionWorld) {
  // Clean up temp output dirs from CLI scenarios
  if (this.outputDir && fs.existsSync(this.outputDir)) {
    fs.rmSync(this.outputDir, { recursive: true, force: true });
  }
});
