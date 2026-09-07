/**
 * Build-time feeds: public GitHub activity and recent Letterboxd diary
 * entries.
 *
 * Both are fetched once per build and both are allowed to fail. A network
 * error, a rate limit or a changed payload returns null, the section that
 * would have used it is not rendered, and the build still succeeds — a
 * personal site is not worth a red deploy. Nothing is cached to disk on
 * purpose: a stale "recently pushed" list is worse than no list, and showing
 * each item's own date means the page never has to claim its own freshness.
 *
 * A daily scheduled run in the deploy workflow keeps both current.
 */

const GITHUB_USER = 'samu-el';
const LETTERBOXD_USER = 'rocin4nte';
const TIMEOUT_MS = 8000;

/**
 * Forks are excluded as somebody else's work, but a fork that was taken over
 * and rewritten is not. This site's own repository began in 2019 as a fork of
 * github/personal-website and has since been replaced wholesale, so GitHub
 * still reports `fork: true` for the repository pushed to most often here.
 * Name them explicitly rather than guessing from commit counts.
 */
const OWNED_FORKS = new Set(['personal-website']);

/**
 * Repositories kept out of "recently pushed" regardless of when they were
 * touched. Old coursework and throwaways are still activity by the API's
 * reckoning, but they are not a signal worth showing. Add or remove a name
 * here; nothing else needs to change.
 */
const HIDDEN_REPOS = new Set(['CRM', 'Expense-Tracking', 'Simple-Blog']);

/**
 * A fixed-length list backfills from further down the history every time
 * something is excluded, which is how a five-year-old repository ends up
 * presented as recent activity. Cap the age instead and let the section run
 * short: four current repositories say more than six reaching back years.
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
  url: string;
  playedAt: string;
};

export type Film = {
  title: string;
  year: string | null;
  /** Out of 5, in half-steps. Null when the entry carries no rating. */
  rating: number | null;
  rewatch: boolean;
  watchedAt: string;
  url: string;
};

/** One fetch, bounded, with the API version pinned and the token used when present. */
async function get(url: string, headers: Record<string, string> = {}): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': `${GITHUB_USER}.smr.et build`, ...headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[feeds] ${url} → HTTP ${res.status}`);
      return null;
    }
    return res;
  } catch (error) {
    console.warn(`[feeds] ${url} → ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

let githubOnce: Promise<GitHubActivity | null> | undefined;
let filmsOnce: Promise<Film[] | null> | undefined;
let tracksOnce: Promise<Track[] | null> | undefined;

/** Memoised per build, so two pages reading the same feed cost one request. */
export function githubActivity(): Promise<GitHubActivity | null> {
  githubOnce ??= fetchGitHub();
  return githubOnce;
}

export function recentFilms(): Promise<Film[] | null> {
  filmsOnce ??= fetchFilms();
  return filmsOnce;
}

export function recentTracks(): Promise<Track[] | null> {
  tracksOnce ??= fetchTracks();
  return tracksOnce;
}

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
    get(
      `https://api.github.com/users/${GITHUB_USER}/repos?sort=pushed&per_page=100&type=owner`,
      headers,
    ),
  ]);
  if (!userRes || !reposRes) return null;

  try {
    const user = await userRes.json();
    const repos = await reposRes.json();
    if (typeof user?.public_repos !== 'number' || !Array.isArray(repos)) {
      console.warn('[feeds] unexpected GitHub payload');
      return null;
    }
    return normalizeGitHub(user, repos);
  } catch (error) {
    console.warn(`[feeds] GitHub payload unreadable: ${error}`);
    return null;
  }
}

/**
 * Split out from the fetch so it can be tested against a fixture — the
 * sandbox this is developed in cannot reach the user-level endpoints.
 */
export function normalizeGitHub(
  user: { public_repos: number },
  repos: Array<Record<string, unknown>>,
): GitHubActivity {
  // Archived repositories are not activity, and private ones are not public.
  const own = repos.filter(
    (r) =>
      (!r.fork || OWNED_FORKS.has(String(r.name))) &&
      !r.archived &&
      !r.private &&
      !HIDDEN_REPOS.has(String(r.name)),
  );

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
    console.warn(`[feeds] Letterboxd feed unreadable: ${error}`);
    return null;
  }
}

/**
 * Letterboxd's RSS carries its own namespaced fields alongside the standard
 * ones, which is lucky: the <title> bakes the rating in as star glyphs, while
 * `letterboxd:memberRating` is a plain number. Read the namespaced fields and
 * ignore the title entirely.
 *
 * The feed mixes diary entries with list and review items; only entries with
 * a watched date are diary entries, so everything else is dropped.
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
 * Spotify needs three values, all of them secrets, none of which may ever
 * reach the browser: the client id and secret from the app dashboard, and a
 * refresh token minted once by `scripts/spotify-token.mjs`. They are read from
 * the environment at build time only — Astro inlines nothing into client
 * JavaScript except `PUBLIC_*` variables, so a value read here through
 * `process.env` cannot leak into the output.
 *
 * With none of them set the feed is simply absent, which is the expected state
 * of a fresh clone. With some of them set it warns, because that is a
 * misconfiguration rather than a choice.
 *
 * Note that this app's refresh token expires after 180 days. When it does, the
 * fetch starts failing, the section disappears, and the token has to be minted
 * again — the site keeps building either way.
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

  // The refresh token is long-lived; the access token it mints lasts an hour,
  // which is far longer than a build.
  let accessToken: string;
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        // Client credentials go in the Basic header, never the body.
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh! }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      // 400 here almost always means the refresh token has expired or been revoked.
      console.warn(`[feeds] Spotify token exchange → HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    if (typeof json?.access_token !== 'string') {
      console.warn('[feeds] Spotify token response had no access_token');
      return null;
    }
    accessToken = json.access_token;
  } catch (error) {
    console.warn(
      `[feeds] Spotify token exchange → ${error instanceof Error ? error.message : error}`,
    );
    return null;
  }

  const res = await get('https://api.spotify.com/v1/me/player/recently-played?limit=12', {
    Authorization: `Bearer ${accessToken}`,
  });
  if (!res) return null;

  try {
    const json = await res.json();
    if (!Array.isArray(json?.items)) {
      console.warn('[feeds] unexpected Spotify payload');
      return null;
    }
    return normalizeSpotify(json.items);
  } catch (error) {
    console.warn(`[feeds] Spotify payload unreadable: ${error}`);
    return null;
  }
}

/**
 * Split out from the fetch so it can be tested without credentials.
 *
 * The history returns one entry per play, so the same track appears repeatedly
 * on a repeat listen. Collapse by track, keeping the most recent play of each,
 * or the list becomes one song six times over.
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
    const album = (track.album as { name?: string } | undefined)?.name;

    out.push({
      title: String(track.name),
      artist: artists.join(', '),
      album: album ?? null,
      url:
        (track.external_urls as { spotify?: string } | undefined)?.spotify ??
        'https://open.spotify.com/',
      playedAt,
    });
    if (out.length === 6) break;
  }

  return out.sort((a, b) => b.playedAt.localeCompare(a.playedAt));
}
