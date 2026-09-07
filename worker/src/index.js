/**
 * now-playing — a Cloudflare Worker that answers "what is Samuel listening to
 * right now" without ever handing Spotify credentials to a browser.
 *
 * The site is static HTML on GitHub Pages, so it cannot hold a secret. This
 * Worker can: the client id, client secret and refresh token are Worker
 * secrets, encrypted at rest and not readable back once set. The browser only
 * ever sees the trimmed JSON below.
 *
 * Mounted on a route of the site's own domain (smr.et/api/*), so the page
 * fetch is same-origin: no CORS preflight, no third-party request, and
 * nothing for an ad blocker to object to.
 *
 * Responses are cached at the edge for a short window. That keeps Spotify's
 * rate limit comfortable however much traffic arrives, and means the answer
 * is "roughly now" rather than a live feed of your listening to every visitor.
 *
 * Deliberately plain JavaScript in one file with no imports, so the same
 * source works with `wrangler deploy` and can be pasted verbatim into the
 * dashboard editor. Types come from JSDoc, and `tsc` still checks them.
 */

/**
 * @typedef {object} Env
 * @property {string} SPOTIFY_CLIENT_ID
 * @property {string} SPOTIFY_CLIENT_SECRET
 * @property {string} SPOTIFY_REFRESH_TOKEN
 */

/**
 * @typedef {object} Payload
 * @property {boolean} playing
 * @property {string} [reason] Only set on a ?debug=1 request.
 * @property {object} [secrets] Only set on a ?debug=1 request. Presence, never values.
 * @property {string} [title]
 * @property {string} [artist]
 * @property {string} [album]
 * @property {string} [art]
 * @property {string} [url]
 * @property {number} [progressMs]
 * @property {number} [durationMs]
 */

/** Seconds the edge holds a response while playing. Short enough to feel live. */
const CACHE_SECONDS = 30;
/** Seconds the edge holds a "nothing playing" answer — cheaper to repeat. */
const CACHE_SECONDS_IDLE = 60;

/**
 * @param {Payload} body
 * @param {number} maxAge
 * @returns {Response}
 */
function json(body, maxAge) {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(maxAge === 0 ? { 'Cache-Control': 'no-store' } : {}),
      // s-maxage drives the edge cache; max-age keeps the browser quiet
      // between renders. stale-while-revalidate hides the refresh latency.
      // A response carrying max-age=30 is how you know this Worker answered
      // and not the static fallback at the origin, which sends max-age=600.
      ...(maxAge === 0
        ? {}
        : {
            'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
          }),
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/**
 * Trades the long-lived refresh token for an access token good for an hour.
 * @param {Env} env
 * @returns {Promise<string | null>}
 */
/**
 * @param {Env} env
 * @returns {Promise<{ token: string | null, status: number }>}
 */
async function accessToken(env) {
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
  if (!res.ok) return { token: null, status: res.status };
  const body = await res.json();
  return {
    token: body && typeof body.access_token === 'string' ? body.access_token : null,
    status: res.status,
  };
}

export default {
  /**
   * @param {Request} request
   * @param {Env} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    /**
     * `?debug=1` explains a false rather than just asserting it. "Nothing is
     * playing", "the refresh token has expired" and "the token lacks
     * user-read-currently-playing" are three different problems that otherwise
     * look identical from outside, which is not a debuggable design.
     *
     * It reports HTTP statuses and whether each secret is set — never a value —
     * so there is nothing here worth hiding behind auth.
     */
    const debug = url.searchParams.has('debug');

    // The endpoint answers on its own root as well as the .json path. Behind
    // the smr.et/api/* route only the latter is ever reached, but on a
    // workers.dev URL or a dedicated subdomain the root is the obvious thing
    // to open — and passing that through to a non-existent origin just yields
    // Cloudflare's "there is nothing here yet" page, which looks broken.
    const isEndpoint = url.pathname === '/' || url.pathname.endsWith('/now-playing.json');

    // Anything else can only be reached via the zone route, where it belongs
    // to the static origin. Pass those through so the Worker stays transparent
    // for everything it does not own.
    if (!isEndpoint) {
      return fetch(request);
    }
    // HEAD is a safe method and costs nothing to support.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { Allow: 'GET, HEAD' },
      });
    }

    // Missing secrets should read as "nothing playing", not as an error the
    // page has to handle differently.
    const secrets = {
      SPOTIFY_CLIENT_ID: Boolean(env.SPOTIFY_CLIENT_ID),
      SPOTIFY_CLIENT_SECRET: Boolean(env.SPOTIFY_CLIENT_SECRET),
      SPOTIFY_REFRESH_TOKEN: Boolean(env.SPOTIFY_REFRESH_TOKEN),
    };
    if (
      !secrets.SPOTIFY_CLIENT_ID ||
      !secrets.SPOTIFY_CLIENT_SECRET ||
      !secrets.SPOTIFY_REFRESH_TOKEN
    ) {
      return json(
        debug ? { playing: false, reason: 'missing_secrets', secrets } : { playing: false },
        debug ? 0 : CACHE_SECONDS_IDLE,
      );
    }

    // Cache on the request URL. The edge serves repeat visitors without this
    // Worker touching Spotify at all.

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: 'GET' });
    // A debug read must be live, or it reports on a minute-old answer.
    if (!debug) {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    }

    /** @type {Payload} */
    let payload = { playing: false };
    let maxAge = CACHE_SECONDS_IDLE;
    let reason = 'unknown';

    try {
      const { token, status: tokenStatus } = await accessToken(env);
      if (!token) {
        // 400 here is almost always an expired or revoked refresh token.
        reason = `token_exchange_failed_${tokenStatus}`;
      }
      if (token) {
        const res = await fetch(
          // additional_types surfaces podcast episodes, which otherwise come
          // back as a null item while something is plainly playing.
          'https://api.spotify.com/v1/me/player/currently-playing?additional_types=track,episode',
          { headers: { Authorization: `Bearer ${token}` } },
        );

        // 204 is Spotify's "nothing is playing" — a success, not a failure,
        // and proof that both the token and its scope are good.
        // 401 is a bad token; 403 is a token without
        // user-read-currently-playing; 429 is a rate limit.
        reason =
          res.status === 204
            ? 'spotify_204_nothing_playing'
            : res.status === 200
              ? 'spotify_200'
              : `spotify_${res.status}`;

        if (res.status === 200) {
          const body = await res.json();
          const item = body && body.item;
          if (body && body.is_playing && item && item.name) {
            const art =
              (item.album && item.album.images && item.album.images[0]?.url) ?? // track
              (item.images && item.images[0]?.url) ?? // podcast episode
              undefined;
            const artist = Array.isArray(item.artists)
              ? item.artists
                  .map((/** @type {{ name?: string }} */ a) => a && a.name)
                  .filter(Boolean)
                  .join(', ')
              : ((item.show && item.show.name) ?? '');

            payload = {
              playing: true,
              title: String(item.name),
              artist,
              album: (item.album && item.album.name) ?? (item.show && item.show.name) ?? undefined,
              art,
              url: (item.external_urls && item.external_urls.spotify) ?? undefined,
              progressMs: typeof body.progress_ms === 'number' ? body.progress_ms : undefined,
              durationMs: typeof item.duration_ms === 'number' ? item.duration_ms : undefined,
            };
            maxAge = CACHE_SECONDS;
            reason = 'ok';
          } else {
            reason = item ? 'paused' : 'no_item';
          }
        }
      }
    } catch {
      // A Spotify outage or an expired refresh token both mean the same thing
      // to the page: show nothing. Never surface a 500 for this.
    }

    if (debug) {
      return json({ ...payload, reason, secrets }, 0);
    }

    const response = json(payload, maxAge);
    await cache.put(cacheKey, response.clone());
    return response;
  },
};
