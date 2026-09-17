/**
 * When to ask the now-playing endpoint again.
 *
 * The rules used to be spread across `poll()` as three expressions and were
 * only reachable through a browser with a stubbed endpoint, which cost about
 * seventy seconds of wall clock to assert loosely. They are one pure function
 * here, so the exact numbers are unit-tested instead.
 *
 * The poll follows the endpoint rather than a clock: the Worker says how long
 * its answer holds and how much of that the edge has already spent, so asking
 * earlier only re-reads a byte-identical body.
 */

/** Never hammer, whatever the headers claim. */
export const MIN_MS = 4000;
/** No usable freshness header, and something is playing. */
export const FALLBACK_MS = 10000;
/** A paused or finished track is not about to change on its own. */
export const IDLE_MS = 30000;
export const BACKOFF_MS = 5000;
export const BACKOFF_MAX_MS = 5 * 60000;

/**
 * How long the answer just received stays true, in ms: its TTL less the Age it
 * has already spent, plus a beat of slack so the next ask lands just after it
 * turns over rather than just before. 0 when the headers say nothing usable.
 */
export function freshnessLeft(cacheControl: string | null, age: string | null) {
  const cc = cacheControl ?? '';
  const ttl = Number((cc.match(/s-maxage=(\d+)/) ?? cc.match(/max-age=(\d+)/) ?? [])[1]);
  if (!Number.isFinite(ttl) || ttl <= 0) return 0;
  return Math.max(0, ttl - (Number(age) || 0)) * 1000 + 100;
}

interface Answer {
  /** The response headers, or null when the request failed outright. */
  cacheControl?: string | null;
  age?: string | null;
  playing?: boolean;
  /** The Worker served a remembered answer, so it could not reach Spotify. */
  stale?: boolean;
  /** Consecutive failures, including this one. 0 means the read succeeded. */
  failures: number;
}

/** Milliseconds until the next poll. */
export function nextPoll({ cacheControl, age, playing, stale, failures }: Answer) {
  // Geometric and capped: an endpoint that is down does not get better for
  // being asked twice a second.
  if (failures > 0) return Math.min(BACKOFF_MS * 2 ** (failures - 1), BACKOFF_MAX_MS);
  const idle = !playing || stale;
  return Math.max(MIN_MS, freshnessLeft(cacheControl ?? null, age ?? null) || (idle ? IDLE_MS : FALLBACK_MS));
}
