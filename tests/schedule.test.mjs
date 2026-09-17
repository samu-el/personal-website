/**
 * The poll cadence, asserted exactly.
 *
 * This used to be an interaction test: a stubbed endpoint, a real browser, and
 * about seventy seconds of wall clock to establish that some gaps fell inside
 * some windows. The rules are a pure function now, so the numbers are checked
 * directly and interact.mjs only has to prove the page is wired to them.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACKOFF_MAX_MS, FALLBACK_MS, IDLE_MS, MIN_MS, freshnessLeft, nextPoll } from '../src/lib/client/schedule.ts';

/** What the Worker actually sends, and what is left of it. */
for (const [what, cc, age, left] of [
  ['what the Worker sends while playing, one second spent', 'public, max-age=5, s-maxage=5', '1', 4100],
  ['the idle window, untouched', 'public, max-age=10, s-maxage=10', null, 10100],
  ['s-maxage in preference to max-age', 'public, max-age=600, s-maxage=5', '0', 5100],
  ['an answer the edge has already outlived', 'public, s-maxage=5', '9', 100],
  ['no cache header at all', null, null, 0],
  ['a header with no number in it', 'no-store', null, 0],
  ['a zero TTL', 'public, s-maxage=0', null, 0],
]) {
  test(`freshnessLeft reads ${what}`, () => assert.equal(freshnessLeft(cc, age), left));
}

test('a playing answer is asked again when its freshness runs out', () => {
  assert.equal(nextPoll({ cacheControl: 'public, s-maxage=5', age: '1', playing: true, failures: 0 }), 4100);
});

test('a paused answer is checked far less often', () => {
  // Nothing is advancing, so the endpoint's own window is the floor, not the cadence.
  assert.equal(nextPoll({ cacheControl: null, playing: false, failures: 0 }), IDLE_MS);
});

test('a remembered answer is treated as idle however it was headed', () => {
  // `stale` means the Worker could not reach Spotify; polling harder will not help.
  assert.equal(nextPoll({ cacheControl: null, playing: true, stale: true, failures: 0 }), IDLE_MS);
});

test('a playing answer with no usable header falls back rather than hammering', () => {
  assert.equal(nextPoll({ cacheControl: 'no-store', playing: true, failures: 0 }), FALLBACK_MS);
});

test('a freshness shorter than the floor is raised to it', () => {
  // A misconfigured edge must never turn into a request per second.
  assert.equal(nextPoll({ cacheControl: 'public, s-maxage=1', playing: true, failures: 0 }), MIN_MS);
});

test('failures back off geometrically and then stop growing', () => {
  const gaps = [1, 2, 3, 4, 5, 6, 7, 8].map((failures) => nextPoll({ failures }));
  assert.deepEqual(gaps.slice(0, 4), [5000, 10000, 20000, 40000]);
  assert.ok(
    gaps.every((gap, i) => i === 0 || gap >= gaps[i - 1]),
    'never shortens',
  );
  assert.equal(gaps.at(-1), BACKOFF_MAX_MS);
});

test('a success after failures returns to the endpoint cadence at once', () => {
  assert.equal(nextPoll({ cacheControl: 'public, s-maxage=5', age: '0', playing: true, failures: 0 }), 5100);
});
