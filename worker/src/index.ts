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
 */

export interface Env {
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  SPOTIFY_REFRESH_TOKEN: string;
}

/** Seconds the edge holds a response. Short enough to feel live. */
const CACHE_SECONDS = 30;
/** Seconds the edge holds a "nothing playing" answer — cheaper to repeat. */
const CACHE_SECONDS_IDLE = 60;

type Payload = {
  playing: boolean;
  title?: string;
  artist?: string;
  album?: string;
  art?: string;
  url?: string;
  /** Milliseconds into the track, for a progress bar. Absent for podcasts. */
  progressMs?: number;
  durationMs?: number;
};

function json(body: Payload, maxAge: number): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // s-maxage drives the edge cache; max-age keeps the browser quiet between
      // renders. stale-while-revalidate hides the refresh latency.
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
      // The page is same-origin, so this is belt and braces for anyone
      // fetching it directly.
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function accessToken(env: Env): Promise<string | null> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: env.SPOTIFY_REFRESH_TOKEN,
    }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { access_token?: string };
  return typeof body.access_token === 'string' ? body.access_token : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // The zone route is a wildcard over /api/*, so anything else under it
    // belongs to the static origin. Pass those through rather than swallowing
    // them, which keeps the Worker transparent for everything it does not own.
    if (!url.pathname.endsWith('/now-playing.json')) {
      return fetch(request);
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
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

    let payload: Payload = { playing: false };
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
          const body = (await res.json()) as Record<string, any>;
          const item = body?.item;
          if (body?.is_playing && item?.name) {
            const art =
              item.album?.images?.[0]?.url ?? // track
              item.images?.[0]?.url ?? // podcast episode
              undefined;
            const artist = Array.isArray(item.artists)
              ? item.artists
                  .map((a: { name?: string }) => a?.name)
                  .filter(Boolean)
                  .join(', ')
              : (item.show?.name ?? '');

            payload = {
              playing: true,
              title: String(item.name),
              artist,
              album: item.album?.name ?? item.show?.name ?? undefined,
              art,
              url: item.external_urls?.spotify ?? undefined,
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
    // Cache without blocking the response.
    await cache.put(cacheKey, response.clone());
    return response;
  },
} satisfies ExportedHandler<Env>;
