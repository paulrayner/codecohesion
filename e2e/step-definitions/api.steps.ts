import { Given, When, Then } from '@cucumber/cucumber';
import { CodeCohesionWorld } from '../support/world';
import assert from 'assert';

/** First repo ID, cached after discovery */
let firstRepoId: string = '';

Given('I know the first repo ID', async function (this: CodeCohesionWorld) {
  if (firstRepoId) return;

  const response = await fetch(`${this.apiBaseUrl}/api/repos`);
  const body = await response.json() as { repos: Array<{ id: string; format?: string }> };
  assert.ok(body.repos && body.repos.length > 0, 'No repos found — fixture data missing?');
  // Prefer our test-repo fixture (static format), fall back to any static repo
  const testRepo = body.repos.find(r => r.id.includes('test-repo'));
  const staticRepo = testRepo || body.repos.find(r => r.format === 'static');
  firstRepoId = (staticRepo || body.repos[0]).id;
});

When('I send a GET request to {string}', async function (this: CodeCohesionWorld, urlPath: string) {
  const resolvedPath = urlPath.replace('{repoId}', firstRepoId);
  const response = await fetch(`${this.apiBaseUrl}${resolvedPath}`);
  this.lastResponseStatus = response.status;
  this.lastResponseBody = await response.json();
});

Then('the response status should be {int}', function (this: CodeCohesionWorld, expectedStatus: number) {
  assert.strictEqual(
    this.lastResponseStatus,
    expectedStatus,
    `Expected status ${expectedStatus} but got ${this.lastResponseStatus}. Body: ${JSON.stringify(this.lastResponseBody, null, 2)}`
  );
});

Then('the response body should have {string} equal to {string}', function (this: CodeCohesionWorld, property: string, expectedValue: string) {
  const body = this.lastResponseBody as Record<string, unknown>;
  assert.strictEqual(
    body[property],
    expectedValue,
    `Expected "${property}" to be "${expectedValue}" but got "${body[property]}"`
  );
});

Then('the response body should have a {string} property', function (this: CodeCohesionWorld, property: string) {
  const body = this.lastResponseBody as Record<string, unknown>;
  assert.ok(
    property in body,
    `Expected response to have property "${property}". Keys: ${Object.keys(body).join(', ')}`
  );
});

Then('the response body should have an {string} property', function (this: CodeCohesionWorld, property: string) {
  const body = this.lastResponseBody as Record<string, unknown>;
  assert.ok(
    property in body,
    `Expected response to have property "${property}". Keys: ${Object.keys(body).join(', ')}`
  );
});

Then('the response body {string} should have a {string} property', function (this: CodeCohesionWorld, parentProp: string, childProp: string) {
  const body = this.lastResponseBody as Record<string, Record<string, unknown>>;
  assert.ok(body[parentProp], `Expected "${parentProp}" in response`);
  assert.ok(
    childProp in body[parentProp],
    `Expected "${parentProp}.${childProp}" in response. Keys: ${Object.keys(body[parentProp]).join(', ')}`
  );
});

Then('the response body should have a {string} array', function (this: CodeCohesionWorld, property: string) {
  const body = this.lastResponseBody as Record<string, unknown>;
  assert.ok(
    Array.isArray(body[property]),
    `Expected "${property}" to be an array, got ${typeof body[property]}`
  );
});

Then('the repos array should have at least {int} entry', function (this: CodeCohesionWorld, minEntries: number) {
  const body = this.lastResponseBody as { repos: unknown[] };
  assert.ok(
    body.repos.length >= minEntries,
    `Expected repos to have at least ${minEntries} entries, got ${body.repos.length}`
  );
});

Then('each repo should have {string} and {string} properties', function (this: CodeCohesionWorld, prop1: string, prop2: string) {
  const body = this.lastResponseBody as { repos: Array<Record<string, unknown>> };
  for (const repo of body.repos) {
    assert.ok(prop1 in repo, `Expected repo to have "${prop1}"`);
    assert.ok(prop2 in repo, `Expected repo to have "${prop2}"`);
  }
});

Then('the response body should have {string} greater than {int}', function (this: CodeCohesionWorld, property: string, minValue: number) {
  const body = this.lastResponseBody as Record<string, unknown>;
  const actualValue = body[property] as number;
  assert.ok(
    actualValue > minValue,
    `Expected "${property}" > ${minValue}, got ${actualValue}`
  );
});

Then('the response stats should have {string} greater than {int}', function (this: CodeCohesionWorld, field: string, minValue: number) {
  const body = this.lastResponseBody as { stats: Record<string, unknown> };
  const stats = body.stats;
  assert.ok(stats, 'Expected "stats" in response body');
  const actualValue = stats[field] as number;
  assert.ok(
    actualValue > minValue,
    `Expected stats.${field} > ${minValue}, got ${actualValue}`
  );
});
