/**
 * Unit tests for the build-time feed parsers.
 *
 * These matter more than usual: the GitHub half cannot be exercised from the
 * sandbox this was written in, so the transform is tested against a fixture
 * rather than a live response. All three parsers also have to survive payloads
 * that are merely plausible — a missing field, an entry that is not a diary
 * entry, a repository that is somebody else's fork.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGitHub, normalizeSpotify, parseLetterboxd } from '../src/lib/feeds.ts';

// --- GitHub ---------------------------------------------------------------

const repo = (over = {}) => ({
  name: 'thing',
  html_url: 'https://github.com/samu-el/thing',
  description: 'A thing.',
  language: 'TypeScript',
  stargazers_count: 0,
  pushed_at: '2026-01-01T00:00:00Z',
  fork: false,
  archived: false,
  private: false,
  ...over,
});
const github = (repos) => normalizeGitHub({ public_repos: repos.length }, repos);
const names = (out) => out.recent.map((r) => r.name);
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

/** Which repositories survive the filters, and in what order. */
for (const [what, repos, kept] of [
  [
    'drops forks, archived and private repositories',
    [
      repo({ name: 'mine' }),
      repo({ name: 'someone-elses', fork: true }),
      repo({ name: 'retired', archived: true }),
      repo({ name: 'secret', private: true }),
    ],
    ['mine'],
  ],
  [
    'drops repositories on the exclude list',
    ['CRM', 'Expense-Tracking', 'Simple-Blog', 'telemed'].map((name) => repo({ name })),
    ['telemed'],
  ],
  [
    'skips repositories with no push date',
    [repo({ name: 'ok' }), repo({ name: 'never-pushed', pushed_at: null })],
    ['ok'],
  ],
  [
    'drops repositories older than the age cap',
    [
      repo({ name: 'current', pushed_at: daysAgo(10) }),
      repo({ name: 'still-recent', pushed_at: daysAgo(700) }),
      repo({ name: 'ancient', pushed_at: daysAgo(1800) }),
    ],
    ['current', 'still-recent'],
  ],
  ['returns an empty list rather than throwing on no repos', [], []],
]) {
  test(`normalizeGitHub ${what}`, () => assert.deepEqual(names(github(repos)), kept));
}

/** The language summary is about all public work, not just the recent list. */
for (const [what, repos, languages] of [
  ['dedupes and sorts, ignoring empty ones', ['TypeScript', 'Python', 'TypeScript', null], ['Python', 'TypeScript']],
  ['excludes a repository that the recent list excluded', ['CSS', 'TypeScript'], ['CSS', 'TypeScript']],
]) {
  test(`normalizeGitHub ${what}`, () => {
    const out = github(repos.map((language, i) => repo({ name: `r${i}`, language })));
    assert.deepEqual(out.languages, languages);
  });
}

test('an excluded repository does not contribute a language either', () => {
  const out = github([repo({ name: 'CRM', language: 'CSS' }), repo({ name: 'telemed', language: 'TypeScript' })]);
  assert.deepEqual(out.languages, ['TypeScript']);
});

test('an aged-out repository still counts towards the language summary', () => {
  // The list is about recent activity; the language line is about all of it.
  const out = github([repo({ name: 'ancient', language: 'Swift', pushed_at: new Date(0).toISOString() })]);
  assert.deepEqual(names(out), []);
  assert.deepEqual(out.languages, ['Swift']);
});

test('normalizeGitHub keeps the account repo count verbatim', () => {
  assert.equal(normalizeGitHub({ public_repos: 34 }, [repo()]).publicRepos, 34);
});

test('normalizeGitHub sorts by push date, newest first, and caps at six', () => {
  const out = github(
    Array.from({ length: 9 }, (_, i) => repo({ name: `r${i}`, pushed_at: `2026-0${(i % 9) + 1}-01T00:00:00Z` })),
  );
  assert.equal(out.recent.length, 6);
  assert.equal(out.recent[0].name, 'r8');
  const dates = out.recent.map((r) => r.pushedAt);
  assert.deepEqual(dates, [...dates].sort().reverse());
});

test('normalizeGitHub tolerates a missing description and star count', () => {
  const out = github([repo({ description: null, stargazers_count: undefined })]);
  assert.partialDeepStrictEqual(out.recent[0], { description: null, stars: 0 });
});

// --- Spotify --------------------------------------------------------------

const play = (over = {}) => ({
  played_at: 'played_at' in over ? over.played_at : '2026-09-07T10:00:00.000Z',
  track: {
    id: over.id ?? 't1',
    name: over.name ?? 'Ye Vinger',
    artists: 'artists' in over ? over.artists : [{ name: 'Mulatu Astatke' }],
    album: 'album' in over ? over.album : { name: 'Mulatu of Ethiopia' },
    external_urls: { spotify: over.url ?? 'https://open.spotify.com/track/t1' },
  },
});
const titles = (tracks) => tracks.map((t) => t.title);

test('normalizeSpotify reads title, artist, album and url', () => {
  const [track] = normalizeSpotify([play()]);
  assert.partialDeepStrictEqual(track, {
    title: 'Ye Vinger',
    artist: 'Mulatu Astatke',
    album: 'Mulatu of Ethiopia',
    playedAt: '2026-09-07T10:00:00.000Z',
  });
  assert.match(track.url, /open\.spotify\.com/);
});

test('normalizeSpotify joins multiple artists', () => {
  const [track] = normalizeSpotify([play({ artists: [{ name: 'Rophnan' }, { name: 'Aster Aweke' }] })]);
  assert.equal(track.artist, 'Rophnan, Aster Aweke');
});

test('normalizeSpotify tolerates a missing album and artist list', () => {
  const [track] = normalizeSpotify([play({ album: undefined, artists: undefined })]);
  assert.partialDeepStrictEqual(track, { album: null, artist: '' });
});

test('normalizeSpotify collapses a repeated track to its most recent play', () => {
  // The history has one row per play, so a repeat listen would fill the list.
  const tracks = normalizeSpotify([
    play({ id: 'a', played_at: '2026-09-07T12:00:00.000Z' }),
    play({ id: 'a', played_at: '2026-09-07T11:00:00.000Z' }),
    play({ id: 'a', played_at: '2026-09-07T10:00:00.000Z' }),
    play({ id: 'b', name: 'Tizita', played_at: '2026-09-07T09:00:00.000Z' }),
  ]);
  assert.equal(tracks.length, 2);
  assert.equal(tracks[0].playedAt, '2026-09-07T12:00:00.000Z');
});

test('normalizeSpotify sorts by play time, newest first, and caps at six', () => {
  const tracks = normalizeSpotify(
    Array.from({ length: 10 }, (_, i) => play({ id: `t${i}`, played_at: `2026-09-0${(i % 9) + 1}T10:00:00.000Z` })),
  );
  assert.equal(tracks.length, 6);
  const times = tracks.map((t) => t.playedAt);
  assert.deepEqual(times, [...times].sort().reverse());
});

test('normalizeSpotify skips rows with no track or no timestamp', () => {
  const tracks = normalizeSpotify([
    { played_at: '2026-09-07T10:00:00.000Z' },
    { track: { name: 'No timestamp', artists: [] } },
    play({ id: 'ok', name: 'Kept' }),
  ]);
  assert.deepEqual(titles(tracks), ['Kept']);
});

test('normalizeSpotify returns an empty list for an empty history', () => {
  assert.deepEqual(normalizeSpotify([]), []);
});

// --- Letterboxd -----------------------------------------------------------

/** Shape copied from the live feed, including its namespaced fields. */
const diaryItem = (over = {}) => {
  const f = {
    filmTitle: 'Interstellar',
    filmYear: '2014',
    memberRating: '5.0',
    rewatch: 'Yes',
    watchedDate: '2026-09-07',
    link: 'https://letterboxd.com/rocin4nte/film/interstellar/',
    ...over,
  };
  const field = (name, value) => (value ? `<letterboxd:${name}>${value}</letterboxd:${name}>` : '');
  return `<item>
    <title>${f.filmTitle}, ${f.filmYear} - ★★★★★</title>
    <link>${f.link}</link>
    ${field('watchedDate', f.watchedDate)}${field('rewatch', f.rewatch)}${field('filmTitle', f.filmTitle)}
    ${field('filmYear', f.filmYear)}${field('memberRating', f.memberRating)}
  </item>`;
};
const feed = (...items) => `<?xml version='1.0' encoding='utf-8'?>
<rss version="2.0"><channel><title>Letterboxd - rocin4nte</title>${items.join('')}</channel></rss>`;
const one = (over) => parseLetterboxd(feed(diaryItem(over)))[0];

test('parseLetterboxd reads the namespaced fields, not the star glyphs in the title', () => {
  const film = one();
  assert.partialDeepStrictEqual(film, {
    title: 'Interstellar',
    year: '2014',
    rating: 5,
    rewatch: true,
    watchedAt: '2026-09-07',
  });
  assert.match(film.url, /letterboxd\.com/);
});

/** One field at a time, since each has its own way of being absent or odd. */
for (const [what, over, field, expected] of [
  ['keeps half-star ratings as decimals', { memberRating: '3.5' }, 'rating', 3.5],
  ['reports an unrated entry as null, not zero', { memberRating: null }, 'rating', null],
  ['treats a missing rewatch field as a first watch', { rewatch: null }, 'rewatch', false],
  ['decodes escaped characters in a title', { filmTitle: 'Vito &amp; Sons' }, 'title', 'Vito & Sons'],
]) {
  test(`parseLetterboxd ${what}`, () => assert.equal(one(over)[field], expected));
}

test('parseLetterboxd ignores items that are not diary entries', () => {
  // Lists and reviews come through the same feed without a watched date.
  const listItem = `<item><title>My list</title><link>https://letterboxd.com/rocin4nte/list/x/</link></item>`;
  const films = parseLetterboxd(feed(listItem, diaryItem()));
  assert.deepEqual(
    films.map((f) => f.title),
    ['Interstellar'],
  );
});

test('parseLetterboxd sorts by watched date, newest first', () => {
  const films = parseLetterboxd(
    feed(
      diaryItem({ filmTitle: 'Older', watchedDate: '2026-01-02' }),
      diaryItem({ filmTitle: 'Newest', watchedDate: '2026-09-07' }),
      diaryItem({ filmTitle: 'Middle', watchedDate: '2026-05-05' }),
    ),
  );
  assert.deepEqual(
    films.map((f) => f.title),
    ['Newest', 'Middle', 'Older'],
  );
});

test('parseLetterboxd caps the list at six', () => {
  const items = Array.from({ length: 10 }, (_, i) =>
    diaryItem({ filmTitle: `Film ${i}`, watchedDate: `2026-01-${String(i + 1).padStart(2, '0')}` }),
  );
  assert.equal(parseLetterboxd(feed(...items)).length, 6);
});

test('parseLetterboxd returns an empty list for an empty or junk feed', () => {
  assert.deepEqual(parseLetterboxd(feed()), []);
  assert.deepEqual(parseLetterboxd('not xml at all'), []);
});
