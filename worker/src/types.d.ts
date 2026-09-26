/** Shapes for the Worker's JSDoc. Types only — nothing is imported at runtime. */

export interface Env {
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  SPOTIFY_REFRESH_TOKEN: string;
  /** Unlocks `?debug=<key>`. Unset, debug is off. */
  DEBUG_KEY?: string;
}

/** What the page receives. `reason` and below are added only on `?debug=<DEBUG_KEY>`. */
export interface Payload {
  playing: boolean;
  /** Which source the title came from. */
  state?: 'playing' | 'paused' | 'recent';
  title?: string;
  artist?: string;
  album?: string;
  art?: string;
  url?: string;
  /** ISO timestamp, `recent` only. */
  playedAt?: string;
  progressMs?: number;
  durationMs?: number;
  /** Epoch ms at which progressMs was read. */
  fetchedAt?: number;
  /** A remembered answer, served because the live read failed. */
  stale?: boolean;
  reason?: string;
  /** Presence, never values. */
  secrets?: object;
  spotifyMessage?: string;
  grantedScopes?: string;
  scopeOk?: boolean;
  recentReason?: string;
  retryAfter?: number;
  tokenCached?: boolean;
}

/** Diagnostics for one request, plus two flags that never reach the page. */
export type Diag = Payload & { failed?: boolean; rateLimited?: boolean };
