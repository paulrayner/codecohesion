/**
 * Browser detection and WebGL error help message utilities.
 *
 * All functions are pure — no DOM or navigator access. Callers are responsible
 * for passing `navigator.userAgent` so this module remains unit-testable.
 */

export type BrowserType = 'chrome' | 'firefox' | 'edge' | 'safari' | 'unknown';

export const WEBGL_HELP_MESSAGES: Record<BrowserType, string> = {
  chrome: `
    <strong style="color: #ccc;">To fix in Chrome:</strong><br>
    1. Go to <code style="background: #333; padding: 2px 6px; border-radius: 3px;">chrome://settings/system</code><br>
    2. Enable "Use hardware acceleration when available"<br>
    3. Restart Chrome
  `,
  firefox: `
    <strong style="color: #ccc;">To fix in Firefox:</strong><br>
    1. Go to <code style="background: #333; padding: 2px 6px; border-radius: 3px;">about:preferences</code><br>
    2. Scroll to Performance<br>
    3. Enable "Use hardware acceleration when available"<br>
    4. Restart Firefox
  `,
  edge: `
    <strong style="color: #ccc;">To fix in Edge:</strong><br>
    1. Go to <code style="background: #333; padding: 2px 6px; border-radius: 3px;">edge://settings/system</code><br>
    2. Enable "Use hardware acceleration when available"<br>
    3. Restart Edge
  `,
  safari: `
    <strong style="color: #ccc;">To fix in Safari:</strong><br>
    WebGL should be enabled by default. Try restarting Safari or your Mac.<br>
    If the issue persists, check System Settings → Displays for GPU issues.
  `,
  unknown: `
    <strong style="color: #ccc;">To fix:</strong><br>
    Enable hardware acceleration in your browser settings and restart the browser.
  `,
};

/**
 * Detect the browser type from a user-agent string.
 *
 * Edge must be checked before Chrome because Edge's UA string also contains
 * "Chrome".
 */
export function detectBrowser(userAgent: string): BrowserType {
  if (userAgent.includes('Edg')) return 'edge';
  if (userAgent.includes('Chrome')) return 'chrome';
  if (userAgent.includes('Firefox')) return 'firefox';
  if (userAgent.includes('Safari')) return 'safari';
  return 'unknown';
}

/**
 * Return browser-specific WebGL troubleshooting HTML for the given user-agent
 * string.
 *
 * Pass `navigator.userAgent` at the call site; this function never reads
 * navigator directly so it remains pure and testable.
 */
export function getBrowserSpecificWebGLHelp(userAgent: string): string {
  const browser = detectBrowser(userAgent);
  return WEBGL_HELP_MESSAGES[browser];
}
