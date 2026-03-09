import { describe, it, expect } from 'vitest';
import {
  isRemoteUrl,
  buildProcessRequest,
  validateProcessInput,
  parseSSEData,
  extractRepoName,
} from './process-client';

describe('isRemoteUrl', () => {
  it('returns true for https URLs', () => {
    expect(isRemoteUrl('https://github.com/owner/repo')).toBe(true);
  });

  it('returns true for http URLs', () => {
    expect(isRemoteUrl('http://github.com/owner/repo')).toBe(true);
  });

  it('returns false for local paths', () => {
    expect(isRemoteUrl('/home/user/repos/my-project')).toBe(false);
    expect(isRemoteUrl('C:\\Users\\project')).toBe(false);
    expect(isRemoteUrl('./relative/path')).toBe(false);
  });

  it('handles leading whitespace', () => {
    expect(isRemoteUrl('  https://github.com/owner/repo')).toBe(true);
  });
});

describe('buildProcessRequest', () => {
  it('builds request with local path', () => {
    const request = buildProcessRequest('/home/user/repo', 'head');
    expect(request).toEqual({
      mode: 'head',
      repoPath: '/home/user/repo',
    });
  });

  it('builds request with remote URL', () => {
    const request = buildProcessRequest('https://github.com/owner/repo', 'timeline-v2');
    expect(request).toEqual({
      mode: 'timeline-v2',
      repoUrl: 'https://github.com/owner/repo',
    });
  });

  it('includes targetCommits only for timeline-v1', () => {
    const v1Request = buildProcessRequest('/path', 'timeline-v1', 200);
    expect(v1Request.targetCommits).toBe(200);

    const v2Request = buildProcessRequest('/path', 'timeline-v2', 200);
    expect(v2Request.targetCommits).toBeUndefined();
  });

  it('trims whitespace from input', () => {
    const request = buildProcessRequest('  /home/user/repo  ', 'head');
    expect(request.repoPath).toBe('/home/user/repo');
  });
});

describe('validateProcessInput', () => {
  it('returns null for valid inputs', () => {
    expect(validateProcessInput('/some/path', 'head')).toBeNull();
    expect(validateProcessInput('https://github.com/o/r', 'timeline-v2')).toBeNull();
  });

  it('returns error for empty repo input', () => {
    expect(validateProcessInput('', 'head')).toBe('Repository path or URL is required');
    expect(validateProcessInput('  ', 'head')).toBe('Repository path or URL is required');
  });

  it('returns error for invalid mode', () => {
    const result = validateProcessInput('/path', 'invalid');
    expect(result).toContain('Invalid mode');
  });
});

describe('parseSSEData', () => {
  it('parses valid SSE data line', () => {
    const event = parseSSEData('data: {"type":"progress","message":"Working...","percent":50}');
    expect(event).toEqual({
      type: 'progress',
      message: 'Working...',
      percent: 50,
    });
  });

  it('parses complete event', () => {
    const event = parseSSEData('data: {"type":"complete","message":"Done"}');
    expect(event?.type).toBe('complete');
  });

  it('returns null for non-data lines', () => {
    expect(parseSSEData('event: message')).toBeNull();
    expect(parseSSEData('')).toBeNull();
    expect(parseSSEData('retry: 5000')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseSSEData('data: not-json')).toBeNull();
  });
});

describe('extractRepoName', () => {
  it('extracts name from local path', () => {
    expect(extractRepoName('/home/user/repos/my-project')).toBe('my-project');
  });

  it('extracts name from GitHub URL', () => {
    expect(extractRepoName('https://github.com/facebook/react')).toBe('react');
  });

  it('strips .git suffix from URL', () => {
    expect(extractRepoName('https://github.com/owner/repo.git')).toBe('repo');
  });

  it('handles trailing slashes', () => {
    expect(extractRepoName('/home/user/project/')).toBe('project');
  });

  it('handles Windows paths', () => {
    expect(extractRepoName('C:\\Users\\dev\\project')).toBe('project');
  });
});
