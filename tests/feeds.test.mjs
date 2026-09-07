/**
 * Unit tests for the build-time feed parsers.
 *
 * These matter more than usual: the GitHub half cannot be exercised from the
 * sandbox this was written in (the user-level endpoints are blocked there), so
 * the transform is tested against a fixture instead of a live response. Both
 * parsers also have to survive payloads that are merely plausible — a missing
 * field, an entry that is not a diary entry, a repository that is somebody
 * else's fork.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGitHub, parseLetterboxd } from '../src/lib/feeds.ts';

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

test('normalizeGitHub keeps the account repo count verbatim', () => {
  const out = normalizeGitHub({ public_repos: 34 }, [repo()]);
  assert.equal(out.publicRepos, 34);
});

test('normalizeGitHub drops forks, archived and private repositories', () => {
  const out = normalizeGitHub({ public_repos: 4 }, [
    repo({ name: 'mine' }),
    repo({ name: 'someone-elses', fork: true }),
    repo({ name: 'retired', archived: true }),
    repo({ name: 'secret', private: true }),
  ]);
  assert.deepEqual(
    out.recent.map((r) => r.name),
    ['mine'],
  );
});

test('normalizeGitHub sorts by push date, newest first, and caps at six', () => {
  const repos = Array.from({ length: 9 }, (_, i) =>
    repo({ name: `r${i}`, pushed_at: `2026-0${(i % 9) + 1}-01T00:00:00Z` }),
  );
  const out = normalizeGitHub({ public_repos: 9 }, repos);
  assert.equal(out.recent.length, 6);
  assert.equal(out.recent[0].name, 'r8');
  const dates = out.recent.map((r) => r.pushedAt);
  assert.deepEqual(dates, [...dates].sort().reverse());
});

test('normalizeGitHub skips repositories with no push date', () => {
  const out = normalizeGitHub({ public_repos: 2 }, [
    repo({ name: 'ok' }),
    repo({ name: 'never-pushed', pushed_at: null }),
  ]);
  assert.deepEqual(
    out.recent.map((r) => r.name),
    ['ok'],
  );
});

test('normalizeGitHub dedupes and sorts languages, ignoring empty ones', () => {
  const out = normalizeGitHub({ public_repos: 4 }, [
    repo({ name: 'a', language: 'TypeScript' }),
    repo({ name: 'b', language: 'Python' }),
    repo({ name: 'c', language: 'TypeScript' }),
    repo({ name: 'd', language: null }),
  ]);
  assert.deepEqual(out.languages, ['Python', 'TypeScript']);
});

test('normalizeGitHub tolerates a missing description and star count', () => {
  const out = normalizeGitHub({ public_repos: 1 }, [
    repo({ description: null, stargazers_count: undefined }),
  ]);
  assert.equal(out.recent[0].description, null);
  assert.equal(out.recent[0].stars, 0);
});

test('normalizeGitHub returns an empty list rather than throwing on no repos', () => {
  const out = normalizeGitHub({ public_repos: 0 }, []);
  assert.deepEqual(out.recent, []);
  assert.deepEqual(out.languages, []);
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
  return `<item>
    <title>${f.filmTitle}, ${f.filmYear} - ★★★★★</title>
    <link>${f.link}</link>
    ${f.watchedDate ? `<letterboxd:watchedDate>${f.watchedDate}</letterboxd:watchedDate>` : ''}
    ${f.rewatch ? `<letterboxd:rewatch>${f.rewatch}</letterboxd:rewatch>` : ''}
    ${f.filmTitle ? `<letterboxd:filmTitle>${f.filmTitle}</letterboxd:filmTitle>` : ''}
    ${f.filmYear ? `<letterboxd:filmYear>${f.filmYear}</letterboxd:filmYear>` : ''}
    ${f.memberRating ? `<letterboxd:memberRating>${f.memberRating}</letterboxd:memberRating>` : ''}
  </item>`;
};

const feed = (...items) => `<?xml version='1.0' encoding='utf-8'?>
<rss version="2.0"><channel><title>Letterboxd - rocin4nte</title>${items.join('')}</channel></rss>`;

test('parseLetterboxd reads the namespaced fields, not the star glyphs in the title', () => {
  const [film] = parseLetterboxd(feed(diaryItem()));
  assert.equal(film.title, 'Interstellar');
  assert.equal(film.year, '2014');
  assert.equal(film.rating, 5);
  assert.equal(film.rewatch, true);
  assert.equal(film.watchedAt, '2026-09-07');
  assert.match(film.url, /letterboxd\.com/);
});

test('parseLetterboxd keeps half-star ratings as decimals', () => {
  const [film] = parseLetterboxd(feed(diaryItem({ memberRating: '3.5' })));
  assert.equal(film.rating, 3.5);
});

test('parseLetterboxd reports an unrated entry as null, not zero', () => {
  const [film] = parseLetterboxd(feed(diaryItem({ memberRating: null })));
  assert.equal(film.rating, null);
});

test('parseLetterboxd treats a missing rewatch field as a first watch', () => {
  const [film] = parseLetterboxd(feed(diaryItem({ rewatch: null })));
  assert.equal(film.rewatch, false);
});

test('parseLetterboxd ignores items that are not diary entries', () => {
  // Lists and reviews come through the same feed without a watched date.
  const listItem = `<item><title>My list</title><link>https://letterboxd.com/rocin4nte/list/x/</link></item>`;
  const films = parseLetterboxd(feed(listItem, diaryItem()));
  assert.equal(films.length, 1);
  assert.equal(films[0].title, 'Interstellar');
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

test('parseLetterboxd decodes escaped characters in a title', () => {
  const [film] = parseLetterboxd(feed(diaryItem({ filmTitle: 'Vito &amp; Sons' })));
  assert.equal(film.title, 'Vito & Sons');
});

test('parseLetterboxd returns an empty list for an empty or junk feed', () => {
  assert.deepEqual(parseLetterboxd(feed()), []);
  assert.deepEqual(parseLetterboxd('not xml at all'), []);
});
