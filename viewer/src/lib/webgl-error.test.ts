import { describe, it, expect } from 'vitest';
import { detectBrowser, getBrowserSpecificWebGLHelp, WEBGL_HELP_MESSAGES } from './webgl-error';

describe('detectBrowser', () => {
  it('detects Chrome', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(detectBrowser(ua)).toBe('chrome');
  });

  it('detects Firefox', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0';
    expect(detectBrowser(ua)).toBe('firefox');
  });

  it('detects Edge (before Chrome match)', () => {
    // Edge UA contains both "Edg" and "Chrome" — Edge must win
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
    expect(detectBrowser(ua)).toBe('edge');
  });

  it('detects Safari', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
    expect(detectBrowser(ua)).toBe('safari');
  });

  it('returns unknown for unrecognised UA', () => {
    expect(detectBrowser('SomeOtherBrowser/1.0')).toBe('unknown');
  });

  it('returns unknown for empty string', () => {
    expect(detectBrowser('')).toBe('unknown');
  });
});

describe('getBrowserSpecificWebGLHelp', () => {
  it('returns the Chrome help message for a Chrome UA', () => {
    const ua = 'Mozilla/5.0 Chrome/120.0.0.0';
    expect(getBrowserSpecificWebGLHelp(ua)).toBe(WEBGL_HELP_MESSAGES['chrome']);
  });

  it('returns the Firefox help message for a Firefox UA', () => {
    const ua = 'Mozilla/5.0 Firefox/120.0';
    expect(getBrowserSpecificWebGLHelp(ua)).toBe(WEBGL_HELP_MESSAGES['firefox']);
  });

  it('returns the Edge help message for an Edge UA', () => {
    const ua = 'Mozilla/5.0 Chrome/120.0.0.0 Edg/120.0.0.0';
    expect(getBrowserSpecificWebGLHelp(ua)).toBe(WEBGL_HELP_MESSAGES['edge']);
  });

  it('returns the Safari help message for a Safari UA', () => {
    const ua = 'Mozilla/5.0 Version/17.0 Safari/605.1.15';
    expect(getBrowserSpecificWebGLHelp(ua)).toBe(WEBGL_HELP_MESSAGES['safari']);
  });

  it('returns the unknown help message for an unrecognised UA', () => {
    expect(getBrowserSpecificWebGLHelp('UnknownBot/1.0')).toBe(WEBGL_HELP_MESSAGES['unknown']);
  });

  it('returned messages are non-empty strings', () => {
    const ua = 'Mozilla/5.0 Chrome/120.0.0.0';
    const help = getBrowserSpecificWebGLHelp(ua);
    expect(typeof help).toBe('string');
    expect(help.length).toBeGreaterThan(0);
  });
});
