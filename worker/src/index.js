/**
 * now-playing — a Cloudflare Worker that answers "what is Samuel listening to
 * right now" without handing Spotify credentials to a browser. Plain
 * JavaScript, one file, no runtime imports, so the same source works with
 * `wrangler deploy` and in the dashboard editor; types come from `types.d.ts`
 * via JSDoc and `tsc` still checks them.
 *
 * The reasoning — the short cache, the module-scope token, 429 handling, the
 * last-good fallback — is in docs/architecture.md, "Now playing".
 *
 * @typedef {import('./types').Env} Env
 * @typedef {import('./types').Payload} Payload
 * @typedef {import('./types').Diag} Diag
 */

/** Seconds the edge holds an answer: playing, then stopped. */
const CACHE_SECONDS = 5;
const CACHE_SECONDS_IDLE = 10;
/** Bound to the refresh token at authorisation time; refreshing cannot add it. */
const REQUIRED_SCOPE = 'user-read-currently-playing';
/** additional_types, or a podcast episode returns a null item mid-play. */
const PLAYER_ENDPOINT = 'https://api.spotify.com/v1/me/player/currently-playing?additional_types=track,episode';
/** A different grant: user-read-recently-played. */
const RECENT_ENDPOINT = 'https://api.spotify.com/v1/me/player/recently-played?limit=1';
/** Stop trusting a token this long before it expires. */
const TOKEN_SKEW_MS = 60_000;
/** How long a remembered payload may still be served after a failure. */
const LAST_GOOD_MAX_MS = 10 * 60_000;

/** Isolate-local, never the edge cache. @type {{ token: string, scope: string, expires: number } | null} */
let cachedToken = null;
/** The last payload that named a track. @type {{ payload: Payload, at: number } | null} */
let lastGood = null;

/**
 * A track or a podcast episode: an episode has no `artists` and no `album`,
 * carrying its show in `show` and its art at the top level.
 *
 * @param {any} item @returns {Payload}
 */
function readTrack(item) {
  const artists = Array.isArray(item.artists)
    ? item.artists.map((/** @type {{ name?: string }} */ a) => a?.name).filter(Boolean)
    : null;
  return {
    playing: false,
    title: String(item.name),
    artist: artists ? artists.join(', ') : (item.show?.name ?? ''),
    album: item.album?.name ?? item.show?.name ?? undefined,
    art: item.album?.images?.[0]?.url ?? item.images?.[0]?.url ?? undefined,
    url: item.external_urls?.spotify ?? undefined,
    durationMs: typeof item.duration_ms === 'number' ? item.duration_ms : undefined,
  };
}

/**
 * No stale-while-revalidate: it serves a known-stale answer past the TTL.
 *
 * @param {Payload} body @param {number} maxAge Seconds; 0 never stores.
 */
function json(body, maxAge) {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': maxAge === 0 ? 'no-store' : `public, max-age=${maxAge}, s-maxage=${maxAge}`,
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/**
 * An access token good for an hour, or the one this isolate already holds.
 *
 * @param {Env} env
 * @returns {Promise<{ token: string|null, status: number, scope: string, cached: boolean }>}
 */
async function accessToken(env) {
  if (cachedToken && cachedToken.expires - TOKEN_SKEW_MS > Date.now()) {
    return { token: cachedToken.token, status: 200, scope: cachedToken.scope, cached: true };
  }
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      // Client credentials go in the Basic header, never the body.
      Authorization: `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: env.SPOTIFY_REFRESH_TOKEN,
    }),
  });
  if (!res.ok) {
    // A revoked refresh token must not keep answering from memory.
    cachedToken = null;
    return { token: null, status: res.status, scope: '', cached: false };
  }
  const body = await res.json();
  const token = typeof body?.access_token === 'string' ? body.access_token : null;
  // Spotify echoes the token's scopes — the only way to see a missing one early.
  const scope = typeof body?.scope === 'string' ? body.scope : '';
  if (token) {
    const ttl = typeof body.expires_in === 'number' ? body.expires_in : 3600;
    cachedToken = { token, scope, expires: Date.now() + ttl * 1000 };
  }
  return { token, status: res.status, scope, cached: false };
}

/** Seconds from a 429's Retry-After, bounded so a bad value cannot pin the card. */
function retryAfter(/** @type {Response} */ res) {
  const raw = Number(res.headers.get('Retry-After'));
  return Number.isFinite(raw) && raw > 0 ? Math.min(Math.round(raw), 300) : 0;
}

/**
 * What is on now. 204 means nothing is playing — a success, and proof the token
 * and its scope are good. 401 bad token, 403 missing scope, 429 rate limit.
 *
 * @param {string} token @param {Diag} diag Mutated for `?debug=1`.
 * @returns {Promise<Payload | null>}
 */
async function readPlayer(token, diag) {
  const res = await fetch(PLAYER_ENDPOINT, { headers: { Authorization: `Bearer ${token}` } });
  diag.reason = { 200: 'spotify_200', 204: 'spotify_204_nothing_playing' }[res.status] ?? `spotify_${res.status}`;

  if (res.status >= 400) {
    diag.failed = true;
    // "Permissions missing" vs "Premium required" — the status cannot say which.
    diag.spotifyMessage = await res
      .clone()
      .text()
      .then((t) => t.slice(0, 300))
      .catch(() => '');
    // The one rejection answered by making fewer calls: skip the history read.
    if (res.status === 429) {
      diag.rateLimited = true;
      diag.retryAfter = retryAfter(res);
    }
    if (res.status === 401) cachedToken = null;
    return null;
  }
  if (res.status !== 200) return null;

  const body = await res.json();
  const item = body?.item;
  if (!item?.name) {
    diag.reason = 'no_item';
    return null;
  }

  // Paused still counts: it reports the track and where it stopped.
  const live = Boolean(body.is_playing);
  diag.reason = live ? 'ok' : 'paused';
  return {
    ...readTrack(item),
    playing: live,
    state: live ? 'playing' : 'paused',
    progressMs: typeof body.progress_ms === 'number' ? body.progress_ms : undefined,
    // Stamped so the page can add cache age back. Playing only.
    ...(live ? { fetchedAt: Date.now() } : {}),
  };
}

/**
 * The last thing that finished, for an empty player — and for a token that
 * holds only the history scope. No progress: the page must draw no bar.
 *
 * @param {string} token @param {Diag} diag @returns {Promise<Payload | null>}
 */
async function readRecent(token, diag) {
  const res = await fetch(RECENT_ENDPOINT, { headers: { Authorization: `Bearer ${token}` } });
  diag.recentReason = `recent_${res.status}`;
  if (res.status !== 200) return null;

  const played = (await res.json())?.items?.[0];
  if (!played?.track?.name) {
    diag.recentReason = 'recent_empty';
    return null;
  }
  return {
    ...readTrack(played.track),
    state: 'recent',
    playedAt: typeof played.played_at === 'string' ? played.played_at : undefined,
  };
}

/**
 * Everything the endpoint knows, for one request. An outage and an expired
 * token mean the same to the page, so neither surfaces as an error.
 *
 * @param {Env} env @returns {Promise<{ payload: Payload, diag: Diag }>}
 */
async function answer(env) {
  /** @type {Diag} */
  const diag = { playing: false, reason: 'unknown', grantedScopes: '' };
  /** @type {Payload} */
  let payload = { playing: false };

  try {
    const { token, status, scope, cached } = await accessToken(env);
    diag.grantedScopes = scope;
    diag.tokenCached = cached;
    if (!token) {
      // 400 here is almost always an expired or revoked refresh token.
      diag.reason = `token_exchange_failed_${status}`;
      diag.failed = true;
      return { payload, diag };
    }

    payload = (await readPlayer(token, diag)) ?? payload;
    // Nothing on the player. Under a rate limit, another call buys nothing.
    if (!payload.title && !diag.rateLimited) {
      payload = (await readRecent(token, diag)) ?? payload;
    }
  } catch {
    diag.failed = true;
  }
  return { payload, diag };
}

export default {
  /** @param {Request} request @param {Env} env @returns {Promise<Response>} */
  async fetch(request, env) {
    const url = new URL(request.url);
    // Explains a false rather than asserting it. Statuses only, never values.
    const debug = url.searchParams.has('debug');

    // The root too, for workers.dev. Anything else is the static origin's.
    if (url.pathname !== '/' && !url.pathname.endsWith('/now-playing.json')) return fetch(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }

    // Missing secrets read as "nothing playing", not as an error.
    const secrets = {
      SPOTIFY_CLIENT_ID: Boolean(env.SPOTIFY_CLIENT_ID),
      SPOTIFY_CLIENT_SECRET: Boolean(env.SPOTIFY_CLIENT_SECRET),
      SPOTIFY_REFRESH_TOKEN: Boolean(env.SPOTIFY_REFRESH_TOKEN),
    };
    if (!Object.values(secrets).every(Boolean)) {
      const body = debug ? { playing: false, reason: 'missing_secrets', secrets } : { playing: false };
      return json(body, debug ? 0 : CACHE_SECONDS_IDLE);
    }

    // The edge serves repeat visitors. A debug read must be live.
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: 'GET' });
    if (!debug) {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    }

    let { payload, diag } = await answer(env);
    let maxAge = payload.playing ? CACHE_SECONDS : CACHE_SECONDS_IDLE;

    if (payload.title) {
      lastGood = { payload, at: Date.now() };
    } else if (diag.failed && lastGood && Date.now() - lastGood.at < LAST_GOOD_MAX_MS) {
      // Marked `stale`, stamp dropped: a remembered position is not corrected.
      const { fetchedAt: _drop, ...rest } = lastGood.payload;
      payload = { ...rest, stale: true };
      diag.reason = `${diag.reason}_served_last_good`;
      maxAge = Math.max(maxAge, diag.retryAfter || CACHE_SECONDS_IDLE);
    }

    if (debug) {
      const { failed: _f, rateLimited: _r, playing: _p, ...rest } = diag;
      const scopeOk = (diag.grantedScopes ?? '').split(' ').includes(REQUIRED_SCOPE);
      return json({ ...payload, ...rest, scopeOk, secrets }, 0);
    }

    // Hold for as long as Spotify asked rather than keep asking.
    if (diag.retryAfter) maxAge = Math.max(maxAge, diag.retryAfter);

    const response = json(payload, maxAge);
    await cache.put(cacheKey, response.clone());
    return response;
  },
};
