/**
 * Build-time feeds: public GitHub activity and recent Letterboxd diary
 * entries.
 *
 * Both are fetched once per build and both are allowed to fail — a personal
 * site is not worth a red deploy. Nothing is cached to disk: a stale
 * "recently pushed" list is worse than none. See docs/architecture.md.
 */

const GITHUB_USER = 'samu-el';
const LETTERBOXD_USER = 'rocin4nte';
const TIMEOUT_MS = 8000;

/** Old coursework and throwaways: activity by the API's reckoning, not a signal. */
const HIDDEN_REPOS = new Set(['CRM', 'Expense-Tracking', 'Simple-Blog']);

/**
 * Cap the age rather than the count. A fixed-length list backfills from
 * further down the history every time something is excluded, which is how a
 * five-year-old repository ends up presented as recent activity.
 */
const MAX_REPO_AGE_DAYS = 730;

export type Repo = {
  name: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  pushedAt: string;
};

export type GitHubActivity = {
  publicRepos: number;
  /** Distinct primary languages across public, non-fork repositories. */
  languages: string[];
  recent: Repo[];
};

export type Track = {
  title: string;
  artist: string;
  album: string | null;
  /** Album art, hotlinked from Spotify's CDN. Null when the payload omits it. */
  art: string | null;
  url: string;
  playedAt: string;
};

export type Film = {
  title: string;
  year: string | null;
  /** Poster, hotlinked from Letterboxd's CDN. Null when the item has no image. */
  poster: string | null;
  /** Out of 5, in half-steps. Null when the entry carries no rating. */
  rating: number | null;
  rewatch: boolean;
  watchedAt: string;
  url: string;
};

const why = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** One fetch, bounded, with the user agent set. Failure is a warning, not a throw. */
async function get(url: string, headers: Record<string, string> = {}, body?: BodyInit): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'User-Agent': `${GITHUB_USER}.smr.et build`, ...headers },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return res;
    console.warn(`[feeds] ${url} → HTTP ${res.status}`);
  } catch (error) {
    console.warn(`[feeds] ${url} → ${why(error)}`);
  }
  return null;
}

/**
 * Reads a response body and hands it to `shape`, which returns null when the
 * payload is not what it claims to be. Every feed below fails the same way.
 */
async function read<T>(res: Response | null, what: string, shape: (body: any) => T | null): Promise<T | null> {
  if (!res) return null;
  try {
    const out = shape(await res.json());
    if (out === null) console.warn(`[feeds] unexpected ${what} payload`);
    return out;
  } catch (error) {
    console.warn(`[feeds] ${what} payload unreadable: ${why(error)}`);
    return null;
  }
}

/** Memoised per build, so two pages reading the same feed cost one request. */
function once<T>(load: () => Promise<T | null>): () => Promise<T | null> {
  let pending: Promise<T | null> | undefined;
  return () => (pending ??= load());
}

export const githubActivity = once(fetchGitHub);
export const recentFilms = once(fetchFilms);
export const recentTracks = once(fetchTracks);

async function fetchGitHub(): Promise<GitHubActivity | null> {
  // Unauthenticated works but is capped at 60 requests an hour per IP, which
  // a busy shared CI runner can exhaust. Actions supplies a token.
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const [userRes, reposRes] = await Promise.all([
    get(`https://api.github.com/users/${GITHUB_USER}`, headers),
    get(`https://api.github.com/users/${GITHUB_USER}/repos?sort=pushed&per_page=100&type=owner`, headers),
  ]);
  if (!userRes || !reposRes) return null;
  const user = await read(userRes, 'GitHub', (b) => (typeof b?.public_repos === 'number' ? b : null));
  const repos = await read(reposRes, 'GitHub', (b) => (Array.isArray(b) ? b : null));
  return user && repos ? normalizeGitHub(user, repos) : null;
}

/**
 * Split out from the fetch so it can be tested against a fixture — the
 * sandbox this is developed in cannot reach the user-level endpoints.
 */
export function normalizeGitHub(user: { public_repos: number }, repos: Array<Record<string, unknown>>): GitHubActivity {
  // Archived repositories are not activity, and private ones are not public.
  const own = repos.filter((r) => !r.fork && !r.archived && !r.private && !HIDDEN_REPOS.has(String(r.name)));

  const cutoff = Date.now() - MAX_REPO_AGE_DAYS * 86_400_000;

  return {
    publicRepos: user.public_repos,
    languages: [...new Set(own.map((r) => r.language).filter((l): l is string => !!l))].sort(),
    recent: own
      .filter((r) => typeof r.pushed_at === 'string')
      .filter((r) => new Date(String(r.pushed_at)).getTime() >= cutoff)
      .sort((a, b) => String(b.pushed_at).localeCompare(String(a.pushed_at)))
      .slice(0, 6)
      .map((r) => ({
        name: String(r.name),
        url: String(r.html_url),
        description: (r.description as string) ?? null,
        language: (r.language as string) ?? null,
        stars: Number(r.stargazers_count ?? 0),
        pushedAt: String(r.pushed_at),
      })),
  };
}

async function fetchFilms(): Promise<Film[] | null> {
  const res = await get(`https://letterboxd.com/${LETTERBOXD_USER}/rss/`);
  if (!res) return null;
  try {
    return parseLetterboxd(await res.text());
  } catch (error) {
    console.warn(`[feeds] Letterboxd feed unreadable: ${why(error)}`);
    return null;
  }
}

/**
 * Letterboxd's RSS carries namespaced fields alongside the standard ones:
 * the <title> bakes the rating in as star glyphs, while
 * `letterboxd:memberRating` is a plain number, so read those and ignore the
 * title. Only items with a watched date are diary entries.
 */
export function parseLetterboxd(xml: string): Film[] {
  const field = (item: string, tag: string) =>
    item.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1]?.trim() ?? null;

  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map(([, item]) => {
      const watchedAt = field(item, 'letterboxd:watchedDate');
      const title = field(item, 'letterboxd:filmTitle');
      if (!watchedAt || !title) return null;
      const rating = field(item, 'letterboxd:memberRating');
      return {
        title: decodeEntities(title),
        year: field(item, 'letterboxd:filmYear'),
        poster: item.match(/<img\s+src="([^"]+)"/)?.[1] ?? null,
        rating: rating === null ? null : Number(rating),
        rewatch: field(item, 'letterboxd:rewatch') === 'Yes',
        watchedAt,
        url: field(item, 'link') ?? `https://letterboxd.com/${LETTERBOXD_USER}/`,
      } satisfies Film;
    })
    .filter((f): f is Film => f !== null)
    .sort((a, b) => b.watchedAt.localeCompare(a.watchedAt))
    .slice(0, 6);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Three secrets, none of which may reach the browser, read from the
 * environment at build time only — Astro inlines nothing into client JS
 * except `PUBLIC_*`. Absent on a fresh clone, which is expected; partially
 * set is a misconfiguration, so that warns. The refresh token expires after
 * 180 days, after which the section disappears until it is minted again.
 */
async function fetchTracks(): Promise<Track[] | null> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const refresh = process.env.SPOTIFY_REFRESH_TOKEN;

  const present = [id, secret, refresh].filter(Boolean).length;
  if (present === 0) return null;
  if (present < 3) {
    console.warn('[feeds] Spotify partially configured — need client id, secret and refresh token');
    return null;
  }

  /* The refresh token is long-lived; the access token it mints lasts an hour,
     which is far longer than a build. A 400 here almost always means the
     refresh token has expired or been revoked. */
  const tokenRes = await get(
    'https://accounts.spotify.com/api/token',
    {
      // Client credentials go in the Basic header, never the body.
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh! }),
  );
  const token = await read(tokenRes, 'Spotify token', (b) =>
    typeof b?.access_token === 'string' ? (b.access_token as string) : null,
  );
  if (!token) return null;

  const res = await get('https://api.spotify.com/v1/me/player/recently-played?limit=12', {
    Authorization: `Bearer ${token}`,
  });
  return read(res, 'Spotify', (b) => (Array.isArray(b?.items) ? normalizeSpotify(b.items) : null));
}

/**
 * Split out from the fetch so it can be tested without credentials. The
 * history returns one entry per play, so collapse by track and keep the most
 * recent, or a repeat listen becomes one song six times over.
 */
export function normalizeSpotify(items: Array<Record<string, unknown>>): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];

  for (const item of items) {
    const track = item?.track as Record<string, unknown> | undefined;
    const playedAt = item?.played_at;
    if (!track?.name || typeof playedAt !== 'string') continue;

    const id = String(track.id ?? track.name);
    if (seen.has(id)) continue;
    seen.add(id);

    const artists = Array.isArray(track.artists)
      ? track.artists.map((a: { name?: string }) => a?.name).filter(Boolean)
      : [];
    const album = track.album as { name?: string; images?: Array<Record<string, unknown>> } | undefined;
    const images = Array.isArray(album?.images) ? album.images : [];
    // Spotify returns 640/300/64. The smallest at or above 200px is plenty for
    // a list thumbnail and a fraction of the bytes of the original.
    const art =
      images
        .filter((i) => typeof i.url === 'string')
        .sort((a, b) => Number(a.width ?? 0) - Number(b.width ?? 0))
        .find((i) => Number(i.width ?? 0) >= 200) ?? images[0];

    out.push({
      title: String(track.name),
      artist: artists.join(', '),
      album: album?.name ?? null,
      art: typeof art?.url === 'string' ? art.url : null,
      url: (track.external_urls as { spotify?: string } | undefined)?.spotify ?? 'https://open.spotify.com/',
      playedAt,
    });
    if (out.length === 6) break;
  }

  return out.sort((a, b) => b.playedAt.localeCompare(a.playedAt));
}
