/**
 * now-playing — a Cloudflare Worker that answers "what is Samuel listening to
 * right now" without handing Spotify credentials to a browser.
 *
 * The site is static HTML on GitHub Pages and cannot hold a secret; this can.
 * It is mounted on a route of the site's own domain, so the page fetch is
 * same-origin. Plain JavaScript in one file with no imports, so the same
 * source works with `wrangler deploy` and in the dashboard editor; types come
 * from JSDoc and `tsc` still checks them.
 *
 * Why the cache is short, why the token is held in module scope, why a 429 is
 * handled the way it is: docs/architecture.md, "Now playing".
 */

/**
 * @typedef {object} Env
 * @property {string} SPOTIFY_CLIENT_ID
 * @property {string} SPOTIFY_CLIENT_SECRET
 * @property {string} SPOTIFY_REFRESH_TOKEN
 */

/**
 * What the page receives. Everything from `reason` down is added only on a
 * `?debug=1` request.
 *
 * @typedef {object} Payload
 * @property {boolean} playing
 * @property {'playing' | 'paused' | 'recent'} [state] Which source the title came from.
 * @property {string} [title]
 * @property {string} [artist]
 * @property {string} [album]
 * @property {string} [art]
 * @property {string} [url]
 * @property {string} [playedAt] ISO timestamp, `recent` only.
 * @property {number} [progressMs]
 * @property {number} [durationMs]
 * @property {number} [fetchedAt] Epoch ms at which progressMs was read.
 * @property {boolean} [stale] A remembered answer, served because the live read failed.
 * @property {string} [reason]
 * @property {object} [secrets] Presence, never values.
 * @property {string} [spotifyMessage]
 * @property {string} [grantedScopes]
 * @property {boolean} [scopeOk]
 * @property {string} [recentReason]
 * @property {number} [retryAfter]
 * @property {boolean} [tokenCached]
 */

/**
 * The diagnostics gathered while answering, plus two flags the handler needs
 * that never reach the page.
 *
 * @typedef {Payload & { failed?: boolean, rateLimited?: boolean }} Diag
 */

/** Seconds the edge holds an answer. Short on purpose: it shields Spotify's
 *  rate limit, it is not there to save latency. */
const CACHE_SECONDS = 5;
/** A stopped player is not about to change on its own. */
const CACHE_SECONDS_IDLE = 10;

/** Bound to the refresh token at authorisation time, so a token without it can
 *  never acquire it by being refreshed — the consent screen has to run again. */
const REQUIRED_SCOPE = 'user-read-currently-playing';

/** additional_types surfaces podcast episodes, which otherwise come back as a
 *  null item while something is plainly playing. */
const PLAYER_ENDPOINT = 'https://api.spotify.com/v1/me/player/currently-playing?additional_types=track,episode';
/** Needs user-read-recently-played, a different grant from the one above. */
const RECENT_ENDPOINT = 'https://api.spotify.com/v1/me/player/recently-played?limit=1';

/** Stop trusting a token this long before it expires. */
const TOKEN_SKEW_MS = 60_000;
/** How long a remembered payload may still be served after a failure. */
const LAST_GOOD_MAX_MS = 10 * 60_000;

/**
 * The access token, reused across requests in this isolate — not the edge
 * cache, which is keyed by URL on a real zone and no place for a credential.
 *
 * @type {{ token: string, scope: string, expires: number } | null}
 */
let cachedToken = null;

/**
 * The last payload that named a track, so a rate limit degrades to "slightly
 * stale" rather than blanking a card that was right a second earlier.
 *
 * @type {{ payload: Payload, at: number } | null}
 */
let lastGood = null;

/**
 * Reads the fields the page needs out of a track or a podcast episode. An
 * episode has no `artists` and no `album`, carrying its show in `show` and its
 * art at the top level.
 *
 * @param {any} item
 * @returns {Payload}
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
 * No stale-while-revalidate: it would serve a known-stale answer past the TTL,
 * which is the staleness the short TTL exists to remove.
 *
 * @param {Payload} body
 * @param {number} maxAge Seconds; 0 means never store this answer.
 * @returns {Response}
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
 * Trades the refresh token for an access token good for an hour, or hands back
 * the one this isolate is already holding.
 *
 * @param {Env} env
 * @returns {Promise<{ token: string | null, status: number, scope: string, cached: boolean }>}
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
  // Spotify echoes the scopes the refresh token carries, the only way to see a
  // missing one without waiting for a 401.
  const scope = typeof body?.scope === 'string' ? body.scope : '';
  if (token) {
    const ttl = typeof body.expires_in === 'number' ? body.expires_in : 3600;
    cachedToken = { token, scope, expires: Date.now() + ttl * 1000 };
  }
  return { token, status: res.status, scope, cached: false };
}

/**
 * Seconds Spotify asked us to wait, from a 429's Retry-After. Bounded, because
 * a bad value would otherwise pin the card to one answer indefinitely.
 *
 * @param {Response} res
 */
function retryAfter(res) {
  const raw = Number(res.headers.get('Retry-After'));
  return Number.isFinite(raw) && raw > 0 ? Math.min(Math.round(raw), 300) : 0;
}

/**
 * Asks the player what is on now. 204 is Spotify's "nothing is playing" — a
 * success, and proof that both the token and its scope are good. 401 is a bad
 * token, 403 a token without the scope, 429 a rate limit.
 *
 * @param {string} token
 * @param {Diag} diag Mutated with the diagnostics a debug request reports.
 * @returns {Promise<Payload | null>}
 */
async function readPlayer(token, diag) {
  const res = await fetch(PLAYER_ENDPOINT, { headers: { Authorization: `Bearer ${token}` } });
  diag.reason = { 200: 'spotify_200', 204: 'spotify_204_nothing_playing' }[res.status] ?? `spotify_${res.status}`;

  if (res.status >= 400) {
    diag.failed = true;
    // Spotify's own words separate a missing scope ("Permissions missing") from
    // a free account ("Premium required"); the status cannot.
    diag.spotifyMessage = await res
      .clone()
      .text()
      .then((t) => t.slice(0, 300))
      .catch(() => '');
    // A rate limit is the one rejection answered by making fewer calls, so hold
    // what Spotify asked for and skip the history endpoint below.
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

  // Paused still counts: the player reports the track and where it stopped,
  // which beats anything the history endpoint could say about it.
  const live = Boolean(body.is_playing);
  diag.reason = live ? 'ok' : 'paused';
  return {
    ...readTrack(item),
    playing: live,
    state: live ? 'playing' : 'paused',
    progressMs: typeof body.progress_ms === 'number' ? body.progress_ms : undefined,
    /* progressMs is a reading, not a running clock, and this response is
       cached — so stamp it and let the page add the elapsed time back. Only
       while playing: correcting a paused track would walk the bar forward
       through something nobody is listening to. */
    ...(live ? { fetchedAt: Date.now() } : {}),
  };
}

/**
 * The last thing that finished, for when the player is empty. Reached after a
 * rejection too: a token holding only user-read-recently-played gets a 401 or
 * 403 above and can still answer this, which beats a blank card. No progress is
 * reported — this track finished, and the page must not draw a bar for it.
 *
 * @param {string} token
 * @param {Diag} diag
 * @returns {Promise<Payload | null>}
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
 * Everything the endpoint knows, for one request. A Spotify outage and an
 * expired token mean the same to the page — show nothing new — so neither
 * surfaces as an error.
 *
 * @param {Env} env
 * @returns {Promise<{ payload: Payload, diag: Diag }>}
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
    // Nothing on the player at all — closed the app, or never opened it today.
    // A rate limit is the exception: another call spends the same limit for
    // nothing.
    if (!payload.title && !diag.rateLimited) {
      payload = (await readRecent(token, diag)) ?? payload;
    }
  } catch {
    diag.failed = true;
  }
  return { payload, diag };
}

export default {
  /**
   * @param {Request} request
   * @param {Env} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    /* `?debug=1` explains a false rather than asserting it: "nothing is
       playing", "the refresh token expired" and "the token lacks the scope"
       look identical from outside otherwise. It reports statuses and whether
       each secret is set, never a value, so there is nothing to hide behind
       auth. */
    const debug = url.searchParams.has('debug');

    /* Answers on its own root as well as the .json path: behind the zone route
       only the latter is reached, but on a workers.dev URL the root is the
       obvious thing to open. Anything else belongs to the static origin. */
    if (url.pathname !== '/' && !url.pathname.endsWith('/now-playing.json')) return fetch(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }

    // Missing secrets read as "nothing playing", not as an error the page has
    // to handle differently.
    const secrets = {
      SPOTIFY_CLIENT_ID: Boolean(env.SPOTIFY_CLIENT_ID),
      SPOTIFY_CLIENT_SECRET: Boolean(env.SPOTIFY_CLIENT_SECRET),
      SPOTIFY_REFRESH_TOKEN: Boolean(env.SPOTIFY_REFRESH_TOKEN),
    };
    if (!Object.values(secrets).every(Boolean)) {
      const body = debug ? { playing: false, reason: 'missing_secrets', secrets } : { playing: false };
      return json(body, debug ? 0 : CACHE_SECONDS_IDLE);
    }

    // The edge serves repeat visitors without this Worker touching Spotify at
    // all. A debug read must be live, or it reports on a minute-old answer.
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
      /* Something true from a moment ago beats nothing. `stale` marks it, and
         the fetchedAt stamp is dropped: a remembered position must not be
         corrected for cache age as though it had just been read. A clean
         "nothing is playing" is not a failure and does not come here. */
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

    // Under a rate limit, hold the answer for as long as Spotify asked: the
    // alternative is to keep asking a service that has just said stop.
    if (diag.retryAfter) maxAge = Math.max(maxAge, diag.retryAfter);

    const response = json(payload, maxAge);
    await cache.put(cacheKey, response.clone());
    return response;
  },
};
