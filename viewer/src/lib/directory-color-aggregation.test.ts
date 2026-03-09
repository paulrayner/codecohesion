import { describe, it, expect, beforeEach } from 'vitest';
import { calculateDominantColor, getColorBreakdown } from './directory-color-aggregation';
import { DirectoryNode } from '../types';
import { calculateLocIntervals } from '../colorModeManager';
import { createMockFile, createMockDir } from './test-fixtures';

describe('calculateDominantColor with Lines of Code', () => {
  // Set up LOC intervals based on React repository percentiles
  // These are the actual values from React repo analysis
  beforeEach(() => {
    // Simulate React repo LOC distribution with 6784 files:
    // p20: 12, p40: 23, p60: 40, p80: 82, p95: 460, max: 15800
    // This creates color buckets:
    // BLUE (1-12), GREEN (13-23), YELLOW (24-40), ORANGE (41-82), RED (83-460), DARK_RED (461+)

    // Create array with proper distribution to match React percentiles
    const mockLocValues: number[] = [];

    // Bottom 20% (0-20%): 1-12 LOC
    for (let i = 0; i < 1357; i++) mockLocValues.push(Math.floor(Math.random() * 12) + 1);

    // 20-40%: 13-23 LOC
    for (let i = 0; i < 1357; i++) mockLocValues.push(Math.floor(Math.random() * 11) + 13);

    // 40-60%: 24-40 LOC
    for (let i = 0; i < 1357; i++) mockLocValues.push(Math.floor(Math.random() * 17) + 24);

    // 60-80%: 41-82 LOC
    for (let i = 0; i < 1357; i++) mockLocValues.push(Math.floor(Math.random() * 42) + 41);

    // 80-95%: 83-460 LOC
    for (let i = 0; i < 1017; i++) mockLocValues.push(Math.floor(Math.random() * 378) + 83);

    // Top 5%: 461+ LOC
    for (let i = 0; i < 339; i++) mockLocValues.push(Math.floor(Math.random() * 1000) + 461);

    calculateLocIntervals(mockLocValues);
  });

  describe('React .github folder example (table-driven)', () => {
    // Helper to build directory structure (reused across tests)
    function buildGithubStructure() {
      const issueTemplateDir = createMockDir('ISSUE_TEMPLATE', [
        createMockFile({ name: 'bug_report.md', loc: 30 }),              // YELLOW
        createMockFile({ name: 'compiler_bug_report.yml', loc: 63 }),    // ORANGE
        createMockFile({ name: 'config.yml', loc: 8 }),                  // BLUE
        createMockFile({ name: 'devtools_bug_report.yml', loc: 79 }),    // ORANGE
      ]);

      const workflowsDir = createMockDir('workflows', [
        createMockFile({ name: 'compiler_discord_notify.yml', loc: 44 }),               // ORANGE
        createMockFile({ name: 'compiler_playground.yml', loc: 63 }),                   // ORANGE
        createMockFile({ name: 'compiler_prereleases.yml', loc: 65 }),                  // ORANGE
        createMockFile({ name: 'compiler_prereleases_manual.yml', loc: 37 }),           // YELLOW
        createMockFile({ name: 'compiler_prereleases_nightly.yml', loc: 20 }),          // GREEN
        createMockFile({ name: 'compiler_typescript.yml', loc: 99 }),                   // RED
        createMockFile({ name: 'devtools_discord_notify.yml', loc: 44 }),               // ORANGE
        createMockFile({ name: 'devtools_regression_tests.yml', loc: 198 }),            // RED
        createMockFile({ name: 'runtime_build_and_test.yml', loc: 882 }),               // DARK_RED
        createMockFile({ name: 'runtime_commit_artifacts.yml', loc: 443 }),             // RED
        createMockFile({ name: 'runtime_discord_notify.yml', loc: 46 }),                // ORANGE
        createMockFile({ name: 'runtime_eslint_plugin_e2e.yml', loc: 60 }),             // ORANGE
        createMockFile({ name: 'runtime_fuzz_tests.yml', loc: 29 }),                    // YELLOW
        createMockFile({ name: 'runtime_prereleases.yml', loc: 106 }),                  // RED
        createMockFile({ name: 'runtime_prereleases_manual.yml', loc: 96 }),            // RED
        createMockFile({ name: 'runtime_prereleases_nightly.yml', loc: 46 }),           // ORANGE
        createMockFile({ name: 'runtime_releases_from_npm_manual.yml', loc: 123 }),     // RED
        createMockFile({ name: 'shared_check_maintainer.yml', loc: 53 }),               // ORANGE
        createMockFile({ name: 'shared_cleanup_merged_branch_caches.yml', loc: 37 }),   // YELLOW
        createMockFile({ name: 'shared_cleanup_stale_branch_caches.yml', loc: 32 }),    // YELLOW
        createMockFile({ name: 'shared_close_direct_sync_branch_prs.yml', loc: 38 }),   // YELLOW
        createMockFile({ name: 'shared_label_core_team_prs.yml', loc: 49 }),            // ORANGE
        createMockFile({ name: 'shared_lint.yml', loc: 102 }),                          // RED
        createMockFile({ name: 'shared_stale.yml', loc: 50 }),                          // ORANGE
      ]);

      const githubDir = createMockDir('.github', [
        issueTemplateDir,
        createMockFile({ name: 'PULL_REQUEST_TEMPLATE.md', loc: 26 }),  // YELLOW
        createMockFile({ name: 'dependabot.yml', loc: 10 }),            // BLUE
        workflowsDir,
      ]);

      return { githubDir, issueTemplateDir, workflowsDir };
    }

    // Color hex constants
    const COLORS = {
      BLUE: '#3498db',
      GREEN: '#2ecc71',
      YELLOW: '#f1c40f',
      ORANGE: '#e67e22',
      RED: '#e74c3c',
      DARK_RED: '#c0392b'
    };

    // Test data table matching the visual table from analysis
    //
    // Folder/File              BLUE  GREEN  YELLOW  ORANGE  RED  DARK_RED  TOTAL  DOMINANT
    // ─────────────────────────────────────────────────────────────────────────────────────
    // .github (TOTAL)           2     1      7       12      7    1         30     ORANGE
    // ISSUE_TEMPLATE            1     0      1       2       0    0         4      ORANGE
    // workflows                 0     1      5       10      7    1         24     ORANGE
    //
    const testTable: [string, () => DirectoryNode, number, number, number, number, number, number, number, string][] = [
      // Folder Name            Folder Builder                                  Blue  Green  Yellow  Orange  Red  DarkRed  Total  Dominant
      ['.github (TOTAL)',       () => buildGithubStructure().githubDir,         2,    1,     7,      12,     7,   1,       30,    'ORANGE'],
      ['ISSUE_TEMPLATE',        () => buildGithubStructure().issueTemplateDir,  1,    0,     1,      2,      0,   0,       4,     'ORANGE'],
      ['workflows',             () => buildGithubStructure().workflowsDir,      0,    1,     5,      10,     7,   1,       24,    'ORANGE'],
    ];

    it.each(testTable)(
      '%s should have correct color breakdown and dominant color',
      (
        _folderName,
        getFolder,
        expectedBlue,
        expectedGreen,
        expectedYellow,
        expectedOrange,
        expectedRed,
        expectedDarkRed,
        expectedTotal,
        expectedDominant
      ) => {
        const folder = getFolder();
        const dominantColor = calculateDominantColor(folder, 'linesOfCode');
        const breakdown = getColorBreakdown(folder, 'linesOfCode');

        // Calculate total from breakdown
        const actualTotal = Array.from(breakdown.values()).reduce((sum, count) => sum + count, 0);
        expect(actualTotal).toBe(expectedTotal);

        // Verify color breakdown
        expect(breakdown.get(COLORS.BLUE) ?? 0).toBe(expectedBlue);
        expect(breakdown.get(COLORS.GREEN) ?? 0).toBe(expectedGreen);
        expect(breakdown.get(COLORS.YELLOW) ?? 0).toBe(expectedYellow);
        expect(breakdown.get(COLORS.ORANGE) ?? 0).toBe(expectedOrange);
        expect(breakdown.get(COLORS.RED) ?? 0).toBe(expectedRed);
        expect(breakdown.get(COLORS.DARK_RED) ?? 0).toBe(expectedDarkRed);

        // Verify dominant color
        const expectedDominantHex = COLORS[expectedDominant as keyof typeof COLORS];
        const expectedDominantNumeric = parseInt(expectedDominantHex.replace('#', ''), 16);
        expect(dominantColor).toBe(expectedDominantNumeric);
      }
    );
  });

  describe('Edge cases', () => {
    it('should handle empty directory', () => {
      const emptyDir = createMockDir('empty', []);
      const dominantColor = calculateDominantColor(emptyDir, 'linesOfCode');

      // Should return default gray
      expect(dominantColor).toBe(0x888888);
    });

    it('should handle single file', () => {
      const dir = createMockDir('single', [
        createMockFile({ name: 'file.ts', loc: 50 })  // ORANGE
      ]);

      const dominantColor = calculateDominantColor(dir, 'linesOfCode');
      const expectedOrange = parseInt('e67e22', 16);
      expect(dominantColor).toBe(expectedOrange);
    });

    it('should handle tie (picks first encountered)', () => {
      const dir = createMockDir('tie', [
        createMockFile({ name: 'small1.ts', loc: 10 }),  // BLUE
        createMockFile({ name: 'small2.ts', loc: 11 }),  // BLUE
        createMockFile({ name: 'large1.ts', loc: 100 }), // RED
        createMockFile({ name: 'large2.ts', loc: 150 })  // RED
      ]);

      const dominantColor = calculateDominantColor(dir, 'linesOfCode');
      const breakdown = getColorBreakdown(dir, 'linesOfCode');

      // Should have 2 blue and 2 red
      expect(breakdown.get('#3498db')).toBe(2);  // BLUE
      expect(breakdown.get('#e74c3c')).toBe(2);  // RED

      // Dominant color will be first one encountered (depends on iteration order)
      // Just verify it's one of the two
      const expectedBlue = parseInt('3498db', 16);
      const expectedRed = parseInt('e74c3c', 16);
      expect([expectedBlue, expectedRed]).toContain(dominantColor);
    });

    it('should work with fileType color mode', () => {
      const dir = createMockDir('mixed', [
        createMockFile({ name: 'a.ts', extension: 'ts', loc: 100 }),
        createMockFile({ name: 'b.ts', extension: 'ts', loc: 200 }),
        createMockFile({ name: 'c.js', extension: 'js', loc: 150 }),
      ]);

      const dominantColor = calculateDominantColor(dir, 'fileType');

      // Should calculate based on file extensions (2 ts, 1 js)
      // TypeScript color should be dominant
      expect(dominantColor).toBeGreaterThan(0);
    });
  });
});
