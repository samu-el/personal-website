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
 * @property {'playing' | 'paused' | 'recent'} [state] Which of the three a
 *   title came from. `playing` and `paused` are the live player; `recent` is
 *   the last thing that finished. Absent when there is no title at all.
 * @property {string} [playedAt] ISO timestamp, `recent` only.
 * @property {string} [reason] Only set on a ?debug=1 request.
 * @property {object} [secrets] Only set on a ?debug=1 request. Presence, never values.
 * @property {string} [spotifyMessage] Only set on a ?debug=1 request.
 * @property {string} [grantedScopes] Only set on a ?debug=1 request.
 * @property {boolean} [scopeOk] Only set on a ?debug=1 request.
 * @property {string} [recentReason] Only set on a ?debug=1 request, and only
 *   when the recently-played fallback was reached.
 * @property {string} [title]
 * @property {string} [artist]
 * @property {string} [album]
 * @property {string} [art]
 * @property {string} [url]
 * @property {number} [progressMs]
 * @property {number} [durationMs]
 * @property {number} [fetchedAt] Epoch ms at which progressMs was read.
 */

/**
 * Seconds the edge holds a response while playing.
 *
 * This is the whole reason the endpoint can feel stale, so it is deliberately
 * short. At 30s a visitor refreshing the page got the byte-identical cached
 * payload for half a minute and reasonably concluded the thing was broken;
 * measured, `Age` climbed to 28 before a miss. Five seconds is under the time
 * it takes to notice.
 *
 * The cache exists to shield Spotify's rate limit, not to save latency, and it
 * still does: a miss costs two Spotify calls (token exchange, then the player),
 * so the ceiling is 24 calls a minute however much traffic arrives. Spotify
 * counts in a rolling 30-second window, where that is 12 — a small fraction of
 * the allowance, and flat regardless of how many people are watching.
 */
const CACHE_SECONDS = 5;
/**
 * Seconds the edge holds a paused or last-played answer. Slightly longer, since
 * a stopped player is not about to change on its own — but not the old 60s,
 * which is how long "Last played" could outlive you pressing play.
 */
const CACHE_SECONDS_IDLE = 10;

/**
 * The scope the currently-playing endpoint needs. Spotify binds scopes to a
 * refresh token at authorisation time, so a token granted without this one can
 * never mint an access token that has it — re-exchanging is futile, the consent
 * screen has to be approved again.
 */
const REQUIRED_SCOPE = 'user-read-currently-playing';

/**
 * The last thing that finished, for when the player is empty. Needs
 * user-read-recently-played, which is a different grant from the one above —
 * a token may hold either, both, or neither.
 */
const RECENT_ENDPOINT = 'https://api.spotify.com/v1/me/player/recently-played?limit=1';

/**
 * Reads the fields the page needs out of a track or a podcast episode. The
 * two shapes differ enough to be annoying: an episode has no `artists` and no
 * `album`, carrying its show in `show` and its art at the top level.
 *
 * Returns `playing: false`; every caller sets the real state.
 *
 * @param {any} item
 * @returns {Payload}
 */
function readTrack(item) {
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

  return {
    playing: false,
    title: String(item.name),
    artist,
    album: (item.album && item.album.name) ?? (item.show && item.show.name) ?? undefined,
    art,
    url: (item.external_urls && item.external_urls.spotify) ?? undefined,
    durationMs: typeof item.duration_ms === 'number' ? item.duration_ms : undefined,
  };
}

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
      // between renders. A response carrying a max-age this short is also how
      // you know this Worker answered and not the static fallback at the
      // origin, which sends max-age=600.
      //
      // No stale-while-revalidate. It hides refresh latency by serving a known
      // stale answer, which is the one thing this endpoint must not do — it
      // would stack another window on top of the TTL and put back the
      // staleness the short TTL exists to remove. One Spotify round trip on a
      // miss is the better trade.
      ...(maxAge === 0
        ? {}
        : {
            'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}`,
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
 * @returns {Promise<{ token: string | null, status: number, scope: string }>}
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
  if (!res.ok) return { token: null, status: res.status, scope: '' };
  const body = await res.json();
  return {
    token: body && typeof body.access_token === 'string' ? body.access_token : null,
    status: res.status,
    // Spotify echoes the scopes the refresh token actually carries, which is
    // the only way to see a missing one without waiting for a 401.
    scope: body && typeof body.scope === 'string' ? body.scope : '',
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
    /** Spotify's own words for a rejection — the only thing that separates a
     * missing scope from a non-Premium account, since both answer 401. */
    let spotifyMessage = '';
    let grantedScopes = '';
    /** Set only if the recently-played fallback was reached. */
    let recentReason = '';

    try {
      const { token, status: tokenStatus, scope } = await accessToken(env);
      grantedScopes = scope;
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

        // Read the error body on a rejection. Spotify says things like
        // "Permissions missing" for a scope problem and "Player command
        // failed: Premium required" for a free account — indistinguishable
        // from the status code alone.
        if (res.status >= 400) {
          spotifyMessage = await res
            .clone()
            .text()
            .then((t) => t.slice(0, 300))
            .catch(() => '');
        }

        if (res.status === 200) {
          const body = await res.json();
          const item = body && body.item;
          if (item && item.name) {
            // Paused still counts as something to show: the player reports
            // the track and where it stopped, which beats anything the
            // history endpoint could tell us about it.
            const live = Boolean(body.is_playing);
            payload = {
              ...readTrack(item),
              playing: live,
              state: live ? 'playing' : 'paused',
              progressMs: typeof body.progress_ms === 'number' ? body.progress_ms : undefined,
              // progressMs is a reading, not a running clock, and this response
              // is cached at the edge for CACHE_SECONDS — so by the time a
              // browser sees it the track has moved on by up to that much.
              // Stamping the reading lets the page add the elapsed time back
              // instead of starting the bar half a minute behind. The stamp
              // travels inside the cached body, so it ages with it.
              //
              // Only when playing. A paused track's progress is not advancing,
              // so correcting for cache age there would walk the bar forward
              // through a track nobody is listening to.
              ...(live ? { fetchedAt: Date.now() } : {}),
            };
            maxAge = live ? CACHE_SECONDS : CACHE_SECONDS_IDLE;
            reason = live ? 'ok' : 'paused';
          } else {
            reason = 'no_item';
          }
        }

        // Nothing on the player at all — closed the app, or never opened it
        // today. Fall back to the last thing that finished, so the card has
        // something true to say instead of disappearing.
        //
        // Reached after a rejection too, not just a 204: a token holding only
        // user-read-recently-played gets a 401 or 403 above and can still
        // answer this, which is a strictly better failure than a blank card.
        if (!payload.title) {
          const rec = await fetch(RECENT_ENDPOINT, {
            headers: { Authorization: `Bearer ${token}` },
          });
          recentReason = `recent_${rec.status}`;
          if (rec.status === 200) {
            const recBody = await rec.json();
            const first = recBody && Array.isArray(recBody.items) ? recBody.items[0] : undefined;
            const played = first && first.track;
            if (played && played.name) {
              payload = {
                ...readTrack(played),
                state: 'recent',
                // No progress: this track finished, and where it finished is
                // not something the page should draw a bar for.
                playedAt: typeof first.played_at === 'string' ? first.played_at : undefined,
              };
              maxAge = CACHE_SECONDS_IDLE;
            } else {
              recentReason = 'recent_empty';
            }
          }
        }
      }
    } catch {
      // A Spotify outage or an expired refresh token both mean the same thing
      // to the page: show nothing. Never surface a 500 for this.
    }

    if (debug) {
      return json(
        {
          ...payload,
          reason,
          ...(spotifyMessage ? { spotifyMessage } : {}),
          ...(recentReason ? { recentReason } : {}),
          grantedScopes,
          scopeOk: grantedScopes.split(' ').includes(REQUIRED_SCOPE),
          secrets,
        },
        0,
      );
    }

    const response = json(payload, maxAge);
    await cache.put(cacheKey, response.clone());
    return response;
  },
};
