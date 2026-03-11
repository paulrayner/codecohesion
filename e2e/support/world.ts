import { World, setWorldConstructor } from '@cucumber/cucumber';
import type { Server } from 'http';

export class CodeCohesionWorld extends World {
  /** Base URL for the API server (set in BeforeAll hook) */
  apiBaseUrl: string = '';

  /** Path to the test fixture repository */
  fixtureRepoPath: string = '';

  /** Path to a temp output directory for the current scenario */
  outputDir: string = '';

  /** Last CLI exit code */
  lastExitCode: number = 0;

  /** Last CLI stdout */
  lastStdout: string = '';

  /** Last CLI stderr */
  lastStderr: string = '';

  /** Last HTTP response status code */
  lastResponseStatus: number = 0;

  /** Last HTTP response body (parsed JSON) */
  lastResponseBody: unknown = null;

  /** Shared API server instance (static, shared across all scenarios) */
  static server: Server | null = null;
  static serverPort: number = 0;
}

setWorldConstructor(CodeCohesionWorld);
