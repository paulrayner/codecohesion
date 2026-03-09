/**
 * Pure functions for building process API request payloads and parsing SSE events.
 * Co-located test file: process-client.test.ts
 */

export type ProcessMode = 'head' | 'timeline-v1' | 'timeline-v2' | 'coupling';

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

export interface ProcessResponse {
  jobId: string;
  status: string;
  _links: {
    progress: { href: string };
  };
}

/**
 * Detect whether input is a URL or a local path.
 * URLs start with http:// or https://
 */
export function isRemoteUrl(input: string): boolean {
  return /^https?:\/\//.test(input.trim());
}

/**
 * Build a ProcessRequest from UI form values
 */
export function buildProcessRequest(
  repoInput: string,
  mode: ProcessMode,
  targetCommits?: number
): ProcessRequest {
  const trimmedInput = repoInput.trim();
  const request: ProcessRequest = { mode };

  if (isRemoteUrl(trimmedInput)) {
    request.repoUrl = trimmedInput;
  } else {
    request.repoPath = trimmedInput;
  }

  if (mode === 'timeline-v1' && targetCommits !== undefined) {
    request.targetCommits = targetCommits;
  }

  return request;
}

/**
 * Validate form inputs before submission.
 * Returns null if valid, or an error message string.
 */
export function validateProcessInput(repoInput: string, mode: string): string | null {
  if (!repoInput.trim()) {
    return 'Repository path or URL is required';
  }

  const validModes: ProcessMode[] = ['head', 'timeline-v1', 'timeline-v2', 'coupling'];
  if (!validModes.includes(mode as ProcessMode)) {
    return `Invalid mode: ${mode}. Must be one of: ${validModes.join(', ')}`;
  }

  return null;
}

/**
 * Parse a Server-Sent Events (SSE) data line into a ProgressEvent.
 * SSE format: "data: {json}\n\n"
 */
export function parseSSEData(dataLine: string): ProgressEvent | null {
  const trimmed = dataLine.trim();
  if (!trimmed.startsWith('data: ')) {
    return null;
  }

  try {
    const jsonString = trimmed.substring(6); // Remove "data: " prefix
    return JSON.parse(jsonString) as ProgressEvent;
  } catch {
    return null;
  }
}

/**
 * Extract repo name from a path or URL for display purposes.
 * "/home/user/repos/my-project" → "my-project"
 * "https://github.com/owner/repo" → "repo"
 * "https://github.com/owner/repo.git" → "repo"
 */
export function extractRepoName(input: string): string {
  const trimmed = input.trim();

  if (isRemoteUrl(trimmed)) {
    const urlPath = trimmed.replace(/\.git$/, '');
    const parts = urlPath.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'unknown';
  }

  // Local path: take the last directory name
  const parts = trimmed.replace(/[/\\]+$/, '').split(/[/\\]/);
  return parts[parts.length - 1] || 'unknown';
}

/**
 * Build the API base URL from the current window location.
 * In dev: viewer is on :3000, API is on :3001
 * In prod: both served from same origin
 */
export function getApiBaseUrl(): string {
  const currentPort = window.location.port;
  // Dev mode: viewer on port 3000, API on port 3001
  if (currentPort === '3000' || currentPort === '5173') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  // Production: same origin
  return window.location.origin;
}

/**
 * Start a processing job by POSTing to the API.
 * Returns the job response with jobId and progress link.
 */
export async function startProcessJob(request: ProcessRequest): Promise<ProcessResponse> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorBody.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Subscribe to SSE progress events for a job.
 * Calls onProgress for each event, returns a cleanup function to close the connection.
 */
export function subscribeToProgress(
  jobId: string,
  onProgress: (event: ProgressEvent) => void
): () => void {
  const baseUrl = getApiBaseUrl();
  const eventSource = new EventSource(`${baseUrl}/api/process/${jobId}/progress`);

  eventSource.onmessage = (event: MessageEvent) => {
    try {
      const progressEvent = JSON.parse(event.data) as ProgressEvent;
      onProgress(progressEvent);

      // Auto-close on terminal events
      if (progressEvent.type === 'complete' || progressEvent.type === 'error') {
        eventSource.close();
      }
    } catch {
      // Ignore malformed events
    }
  };

  eventSource.onerror = () => {
    eventSource.close();
    onProgress({ type: 'error', message: 'Connection to server lost' });
  };

  return () => eventSource.close();
}
