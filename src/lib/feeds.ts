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

/** Memoised per build, so two pages reading the same feed cost one request. */
export function githubActivity(): Promise<GitHubActivity | null> {
  githubOnce ??= fetchGitHub();
  return githubOnce;
}

export function recentFilms(): Promise<Film[] | null> {
  filmsOnce ??= fetchFilms();
  return filmsOnce;
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
  // Forks are someone else's work and archived repositories are not activity.
  const own = repos.filter((r) => !r.fork && !r.archived && !r.private);

  return {
    publicRepos: user.public_repos,
    languages: [...new Set(own.map((r) => r.language).filter((l): l is string => !!l))].sort(),
    recent: own
      .filter((r) => typeof r.pushed_at === 'string')
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
