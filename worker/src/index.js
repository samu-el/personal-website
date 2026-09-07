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
      // s-maxage drives the edge cache; max-age keeps the browser quiet
      // between renders. stale-while-revalidate hides the refresh latency.
      // A response carrying max-age=30 is how you know this Worker answered
      // and not the static fallback at the origin, which sends max-age=600.
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
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
  if (!res.ok) return null;
  const body = await res.json();
  return body && typeof body.access_token === 'string' ? body.access_token : null;
}

export default {
  /**
   * @param {Request} request
   * @param {Env} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    const url = new URL(request.url);

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
    if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET || !env.SPOTIFY_REFRESH_TOKEN) {
      return json({ playing: false }, CACHE_SECONDS_IDLE);
    }

    // Cache on the request URL. The edge serves repeat visitors without this
    // Worker touching Spotify at all.
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: 'GET' });
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    /** @type {Payload} */
    let payload = { playing: false };
    let maxAge = CACHE_SECONDS_IDLE;

    try {
      const token = await accessToken(env);
      if (token) {
        const res = await fetch(
          // additional_types surfaces podcast episodes, which otherwise come
          // back as a null item while something is plainly playing.
          'https://api.spotify.com/v1/me/player/currently-playing?additional_types=track,episode',
          { headers: { Authorization: `Bearer ${token}` } },
        );

        // 204 is Spotify's "nothing is playing" — a success, not a failure.
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
          }
        }
      }
    } catch {
      // A Spotify outage or an expired refresh token both mean the same thing
      // to the page: show nothing. Never surface a 500 for this.
    }

    const response = json(payload, maxAge);
    await cache.put(cacheKey, response.clone());
    return response;
  },
};
