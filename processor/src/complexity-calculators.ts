/**
 * Pure calculator functions for cyclomatic and cognitive complexity.
 *
 * Cyclomatic complexity: counts branching nodes (if, for, while, switch case,
 * catch, &&, ||, ??) plus 1 base per function.
 *
 * Cognitive complexity (Sonar algorithm): structural control-flow increments
 * that carry a nesting depth bonus. Each nesting control-flow keyword scores
 * (1 + current_depth). Sequential flat ifs each score 1.
 */

/**
 * Token patterns for cyclomatic branching nodes.
 * Each match contributes +1 to the branch count.
 */
const CYCLOMATIC_PATTERNS: RegExp[] = [
  /\bif\s*\(/g,
  /\bfor\s*\(/g,
  /\bwhile\s*\(/g,
  /\bcase\s+[^:]+:/g,
  /\bcatch\s*\(/g,
  /&&/g,
  /\|\|/g,
  /\?\?/g,
];

/**
 * Calculate the cyclomatic complexity of a function body string.
 * Returns (branch count + 1) for the base path.
 */
export function calculateCyclomatic(body: string): number {
  let branches = 0;

  for (const pattern of CYCLOMATIC_PATTERNS) {
    // Reset lastIndex since patterns use global flag
    pattern.lastIndex = 0;
    const matches = body.match(pattern);
    if (matches) {
      branches += matches.length;
    }
  }

  return branches + 1;
}

/**
 * Structural keywords that increase nesting depth in the Sonar cognitive model.
 * Each occurrence scores (1 + current_nesting_depth).
 */
const NESTING_KEYWORDS = ['if', 'for', 'while', 'switch', 'catch', 'try'];

/**
 * Calculate the cognitive complexity of a function body string using the
 * Sonar algorithm: each nesting control-flow keyword scores (1 + depth),
 * where depth is the number of enclosing nesting structures at that point.
 *
 * This implementation uses brace counting as a proxy for structural depth.
 * The function body string includes the outer function braces, so depth
 * starts at -1 to cancel out the function's own opening brace — keywords
 * directly inside the function body therefore score at depth 0.
 */
export function calculateCognitive(body: string): number {
  let score = 0;

  // Start depth at -1 so that when the function's opening brace is
  // encountered, depth becomes 0. Keywords at the top level of the
  // function body then correctly score (1 + 0).
  let depth = -1;
  let i = 0;

  while (i < body.length) {
    const char = body[i];

    if (char === '{') {
      depth++;
      i++;
      continue;
    }

    if (char === '}') {
      if (depth > -1) depth--;
      i++;
      continue;
    }

    // Try to match a nesting keyword at this position
    let matched = false;
    for (const keyword of NESTING_KEYWORDS) {
      if (body.startsWith(keyword, i)) {
        // Ensure it is a whole word (not part of a longer identifier)
        const charBefore = i > 0 ? body[i - 1] : ' ';
        const charAfter = body[i + keyword.length] ?? ' ';
        const isWord =
          !/[a-zA-Z0-9_$]/.test(charBefore) &&
          !/[a-zA-Z0-9_$]/.test(charAfter);

        if (isWord) {
          // Cognitive score: 1 + depth of enclosing structures
          // depth reflects number of nesting constructs enclosing this keyword.
          const nestingDepth = Math.max(0, depth);
          score += 1 + nestingDepth;
          matched = true;
          i += keyword.length;
          break;
        }
      }
    }

    if (!matched) {
      i++;
    }
  }

  return score;
}
