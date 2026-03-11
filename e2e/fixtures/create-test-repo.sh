#!/usr/bin/env bash
# Creates a small, deterministic git repository for E2E tests.
# All dates, names, and content are fixed so output is reproducible.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$SCRIPT_DIR/test-repo"

# Clean slate
rm -rf "$REPO_DIR"
mkdir -p "$REPO_DIR"
cd "$REPO_DIR"

git init --quiet
git config user.name "Alice Test"
git config user.email "alice@test.com"

# ---- Commit 1: Initial project structure ----
mkdir -p src lib
cat > src/main.ts << 'CONTENT'
import { greet } from '../lib/greeter';
import { calculate } from '../lib/math';

console.log(greet('World'));
console.log(calculate(2, 3));
CONTENT

cat > lib/greeter.ts << 'CONTENT'
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
CONTENT

cat > lib/math.ts << 'CONTENT'
export function calculate(a: number, b: number): number {
  return a + b;
}
CONTENT

cat > README.md << 'CONTENT'
# Test Project
A small project for E2E testing.
CONTENT

GIT_AUTHOR_DATE="2024-01-10T10:00:00Z" GIT_COMMITTER_DATE="2024-01-10T10:00:00Z" \
  git add -A && git commit --quiet -m "Initial project structure"

# ---- Commit 2: Add config (Alice) ----
cat > config.json << 'CONTENT'
{
  "name": "test-project",
  "version": "1.0.0"
}
CONTENT

GIT_AUTHOR_DATE="2024-01-15T14:00:00Z" GIT_COMMITTER_DATE="2024-01-15T14:00:00Z" \
  git add -A && git commit --quiet -m "Add project config"

# ---- Commit 3: Bob adds utility (coupled: greeter + math change together) ----
git config user.name "Bob Developer"
git config user.email "bob@test.com"

cat > lib/greeter.ts << 'CONTENT'
export function greet(name: string): string {
  return `Hello, ${name}!`;
}

export function farewell(name: string): string {
  return `Goodbye, ${name}!`;
}
CONTENT

cat > lib/math.ts << 'CONTENT'
export function calculate(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}
CONTENT

GIT_AUTHOR_DATE="2024-02-01T09:00:00Z" GIT_COMMITTER_DATE="2024-02-01T09:00:00Z" \
  git add -A && git commit --quiet -m "Add farewell and subtract functions"

# ---- Commit 4: Alice updates main and greeter (coupled) ----
git config user.name "Alice Test"
git config user.email "alice@test.com"

cat > src/main.ts << 'CONTENT'
import { greet, farewell } from '../lib/greeter';
import { calculate, subtract } from '../lib/math';

console.log(greet('World'));
console.log(farewell('World'));
console.log(calculate(2, 3));
console.log(subtract(5, 2));
CONTENT

cat > lib/greeter.ts << 'CONTENT'
export function greet(name: string): string {
  const greeting = `Hello, ${name}!`;
  return greeting;
}

export function farewell(name: string): string {
  return `Goodbye, ${name}!`;
}
CONTENT

GIT_AUTHOR_DATE="2024-02-15T11:00:00Z" GIT_COMMITTER_DATE="2024-02-15T11:00:00Z" \
  git add -A && git commit --quiet -m "Wire up new functions in main"

# ---- Commit 5: Bob updates config and math (coupled) ----
git config user.name "Bob Developer"
git config user.email "bob@test.com"

cat > config.json << 'CONTENT'
{
  "name": "test-project",
  "version": "1.1.0",
  "features": ["math", "greetings"]
}
CONTENT

cat > lib/math.ts << 'CONTENT'
export function calculate(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
CONTENT

GIT_AUTHOR_DATE="2024-03-01T16:00:00Z" GIT_COMMITTER_DATE="2024-03-01T16:00:00Z" \
  git add -A && git commit --quiet -m "Add multiply and update version"

# ---- Commit 6: Alice refactors greeter and main (coupled) ----
git config user.name "Alice Test"
git config user.email "alice@test.com"

cat > lib/greeter.ts << 'CONTENT'
function formatGreeting(prefix: string, name: string): string {
  return `${prefix}, ${name}!`;
}

export function greet(name: string): string {
  return formatGreeting('Hello', name);
}

export function farewell(name: string): string {
  return formatGreeting('Goodbye', name);
}
CONTENT

cat > src/main.ts << 'CONTENT'
import { greet, farewell } from '../lib/greeter';
import { calculate, subtract, multiply } from '../lib/math';

const name = 'World';
console.log(greet(name));
console.log(farewell(name));
console.log('2 + 3 =', calculate(2, 3));
console.log('5 - 2 =', subtract(5, 2));
console.log('4 * 3 =', multiply(4, 3));
CONTENT

GIT_AUTHOR_DATE="2024-03-15T10:00:00Z" GIT_COMMITTER_DATE="2024-03-15T10:00:00Z" \
  git add -A && git commit --quiet -m "Refactor greeter with shared formatter"

# ---- Commit 7: Add tests file (new file, Alice) ----
mkdir -p tests
cat > tests/math.test.ts << 'CONTENT'
import { calculate, subtract, multiply } from '../lib/math';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(calculate(2, 3) === 5, 'calculate failed');
assert(subtract(5, 2) === 3, 'subtract failed');
assert(multiply(4, 3) === 12, 'multiply failed');

console.log('All tests passed!');
CONTENT

GIT_AUTHOR_DATE="2024-04-01T08:00:00Z" GIT_COMMITTER_DATE="2024-04-01T08:00:00Z" \
  git add -A && git commit --quiet -m "Add math unit tests"

echo "Test repo created at $REPO_DIR with $(git log --oneline | wc -l | tr -d ' ') commits"
