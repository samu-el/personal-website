/**
 * Exercises the Worker's fetch handler against stubbed Spotify responses.
 * Run with: npm test  (from worker/)
 *
 * Each test gets a fresh module instance: the access token and the last-good
 * payload live in module scope on purpose, and that persistence would
 * otherwise leak between tests the way it is meant to persist between
 * requests. See docs/architecture.md, "Testing".
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/** @type {typeof import('../src/index.js').default} */
let worker;
let load = 0;
beforeEach(async () => {
  worker = (await import(`../src/index.js?fresh=${load++}`)).default;
});

// Minimal Workers runtime surface. The Cache API is a no-op so every call is a
// live read; `btoa` exists in Workers but not in Node's global scope.
globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
globalThis.btoa ??= (v) => Buffer.from(v, 'binary').toString('base64');

const ENV = { SPOTIFY_CLIENT_ID: 'id', SPOTIFY_CLIENT_SECRET: 'secret', SPOTIFY_REFRESH_TOKEN: 'refresh' };
const SCOPES = 'user-read-recently-played user-read-currently-playing';

const TRACK = {
  name: 'Yèkèrmo Sèw',
  duration_ms: 200000,
  artists: [{ name: 'Mulatu Astatke' }],
  album: { name: 'Mulatu of Ethiopia', images: [{ url: 'https://i.scdn.co/x' }] },
  external_urls: { spotify: 'https://open.spotify.com/x' },
};
const PLAYING = { playBody: { is_playing: true, progress_ms: 1000, item: TRACK } };
const RECENT = {
  items: [
    {
      played_at: '2026-09-07T10:00:00.000Z',
      track: {
        name: 'Tezeta',
        duration_ms: 240000,
        artists: [{ name: 'Mulatu Astatke' }],
        album: { name: 'Ethiopiques 4', images: [{ url: 'https://i.scdn.co/t' }] },
        external_urls: { spotify: 'https://open.spotify.com/t' },
      },
    },
  ],
};

/** Calls the Worker made, per test. */
let calls;

/**
 * Replaces global fetch with canned Spotify answers. `recentStatus` defaults
 * to failing, so a test only reaches the history endpoint when it asks to.
 */
function stub({
  tokenStatus = 200,
  playStatus = 200,
  playBody = null,
  errorBody = null,
  tokenScope = SCOPES,
  recentStatus = 404,
  recentBody = null,
  retryAfter = null,
  expiresIn = 3600,
} = {}) {
  calls = { token: 0, play: 0, recent: 0 };
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('accounts.spotify.com')) {
      calls.token++;
      const ok = JSON.stringify({ access_token: 'tok', scope: tokenScope, expires_in: expiresIn });
      return new Response(tokenStatus === 200 ? ok : 'no', { status: tokenStatus });
    }
    // Checked first: both endpoints live on api.spotify.com.
    if (url.includes('recently-played')) {
      calls.recent++;
      const body = recentStatus === 200 ? JSON.stringify(recentBody ?? RECENT) : 'no';
      return new Response(body, { status: recentStatus });
    }
    if (url.includes('api.spotify.com')) {
      calls.play++;
      if (playStatus >= 400) {
        return new Response(errorBody ?? JSON.stringify({ error: { status: playStatus } }), {
          status: playStatus,
          headers: retryAfter === null ? {} : { 'Retry-After': String(retryAfter) },
        });
      }
      return new Response(playStatus === 204 ? null : JSON.stringify(playBody ?? {}), { status: playStatus });
    }
    return new Response('origin', { status: 200 }); // the pass-through
  };
}

const get = (path, env = ENV) => worker.fetch(new Request(`https://w.example${path}`, { method: 'GET' }), env);
/** Stub, ask, and hand back the parsed body. */
const body = async (opts, path = '/now-playing.json', env = ENV) => {
  stub(opts);
  return (await get(path, env)).json();
};
const debug = (opts, env = ENV) => body(opts, '/?debug=1', env);

test('debug reports missing secrets without revealing values', async () => {
  const out = await debug({}, {});
  assert.equal(out.reason, 'missing_secrets');
  assert.deepEqual(out.secrets, {
    SPOTIFY_CLIENT_ID: false,
    SPOTIFY_CLIENT_SECRET: false,
    SPOTIFY_REFRESH_TOKEN: false,
  });
  // Booleans only — a value here would be a credential leak.
  for (const v of Object.values(out.secrets)) assert.equal(typeof v, 'boolean');
});

/* Each of these answers an identical `{ playing: false }` in normal operation.
   The debug reason is the only thing that tells them apart, and telling them
   apart by hand cost two rounds of guessing — so each is pinned. */
for (const [what, opts, reason] of [
  ['an expired refresh token', { tokenStatus: 400 }, 'token_exchange_failed_400'],
  ['nothing playing, which proves token and scope are good', { playStatus: 204 }, 'spotify_204_nothing_playing'],
  ['a token without user-read-currently-playing', { playStatus: 403 }, 'spotify_403'],
  ['an invalid access token', { playStatus: 401 }, 'spotify_401'],
  ['a rate limit', { playStatus: 429 }, 'spotify_429'],
  [
    'paused playback, which is not "nothing playing"',
    { playBody: { is_playing: false, item: { name: 'x' } } },
    'paused',
  ],
]) {
  test(`debug distinguishes ${what}`, async () => assert.equal((await debug(opts)).reason, reason));
}

/** What each source puts in the payload. One table, five shapes. */
for (const [what, opts, expected] of [
  [
    'a playing track is reported in full',
    PLAYING,
    {
      playing: true,
      title: 'Yèkèrmo Sèw',
      artist: 'Mulatu Astatke',
      album: 'Mulatu of Ethiopia',
      art: 'https://i.scdn.co/x',
      progressMs: 1000,
      durationMs: 200000,
    },
  ],
  [
    // The position is what makes paused worth showing over the history endpoint.
    'a paused track is reported with its position, not hidden',
    { playBody: { is_playing: false, progress_ms: 61234, item: TRACK } },
    { state: 'paused', playing: false, title: 'Yèkèrmo Sèw', progressMs: 61234, durationMs: 200000 },
  ],
  [
    'an empty player falls back to the last track played',
    { playStatus: 204, recentStatus: 200 },
    {
      state: 'recent',
      playing: false,
      title: 'Tezeta',
      artist: 'Mulatu Astatke',
      art: 'https://i.scdn.co/t',
      url: 'https://open.spotify.com/t',
      playedAt: '2026-09-07T10:00:00.000Z',
    },
  ],
]) {
  test(what, async () => assert.partialDeepStrictEqual(await body(opts), expected));
}

test('a finished track carries no position, so the page draws no bar', async () => {
  assert.equal((await body({ playStatus: 204, recentStatus: 200 })).progressMs, undefined);
});

test('a playing track is stamped so the page can correct for cache age', async () => {
  // Without the stamp the page cannot tell a fresh reading from one the edge
  // has been serving for half a minute.
  stub(PLAYING);
  const before = Date.now();
  const out = await (await get('/now-playing.json')).json();
  assert.equal(typeof out.fetchedAt, 'number');
  assert.ok(out.fetchedAt >= before && out.fetchedAt <= Date.now());
});

test('a payload that is not advancing carries no stamp to correct against', async () => {
  // Neither a paused nor a finished track is advancing, so applying the stamp
  // would walk the bar forward through music nobody is listening to.
  const paused = { playBody: { is_playing: false, progress_ms: 5000, item: { name: 'x', duration_ms: 9 } } };
  assert.equal((await body(paused)).fetchedAt, undefined);
  assert.equal((await body({ playStatus: 204, recentStatus: 200 })).fetchedAt, undefined);
});

test('a token holding only the history scope still fills the card', async () => {
  // The shape of the bug that cost two rounds of guessing: scopes are bound at
  // authorisation time, so such a token answers 401 on the player forever.
  const opts = { tokenScope: 'user-read-recently-played', playStatus: 401, recentStatus: 200 };
  assert.partialDeepStrictEqual(await body(opts), { state: 'recent', title: 'Tezeta' });
  // The underlying problem stays visible rather than being papered over.
  assert.partialDeepStrictEqual(await debug(opts), {
    reason: 'spotify_401',
    scopeOk: false,
    recentReason: 'recent_200',
  });
});

test('the fallback reports its own failure separately', async () => {
  assert.partialDeepStrictEqual(await debug({ playStatus: 204, recentStatus: 403 }), {
    reason: 'spotify_204_nothing_playing',
    recentReason: 'recent_403',
    playing: false,
  });
});

test('the fallback is not consulted while something is playing', async () => {
  // An extra Spotify call per request against a rate limit, for an answer that
  // would be discarded.
  stub(PLAYING);
  await get('/now-playing.json');
  assert.equal(calls.recent, 0);
});

test('an empty history is not mistaken for a track', async () => {
  const out = await debug({ playStatus: 204, recentStatus: 200, recentBody: { items: [] } });
  assert.partialDeepStrictEqual(out, { recentReason: 'recent_empty', playing: false });
  assert.equal(out.title, undefined);
});

test("debug relays Spotify's own message on a rejection", async () => {
  // 401 alone cannot distinguish a missing scope from a non-Premium account.
  const errorBody = JSON.stringify({ error: { status: 401, message: 'Permissions missing' } });
  const out = await debug({ playStatus: 401, errorBody });
  assert.equal(out.reason, 'spotify_401');
  assert.match(out.spotifyMessage, /Permissions missing/);
});

test('no spotifyMessage is attached when nothing was rejected', async () => {
  const out = await debug({ playStatus: 204 });
  assert.equal(out.reason, 'spotify_204_nothing_playing');
  assert.equal(out.spotifyMessage, undefined);
});

test('debug reports the scopes the refresh token actually carries', async () => {
  // A token granted without user-read-currently-playing can never acquire it by
  // being refreshed. This makes that visible without waiting for a 401.
  const bad = await debug({ tokenScope: 'user-read-recently-played', playStatus: 401 });
  assert.partialDeepStrictEqual(bad, { grantedScopes: 'user-read-recently-played', scopeOk: false });
  const good = await debug({ playStatus: 204 });
  assert.match(good.grantedScopes, /user-read-currently-playing/);
  assert.equal(good.scopeOk, true);
});

test('the normal payload carries no diagnostics', async () => {
  // reason and secrets are debug-only; the public endpoint stays minimal.
  assert.deepEqual(Object.keys(await body({ playStatus: 403, recentStatus: 403 })), ['playing']);
});

test('a debug response is never cached, a normal one is', async () => {
  stub({ playStatus: 204 });
  assert.equal((await get('/?debug=1')).headers.get('cache-control'), 'no-store');
  assert.match((await get('/now-playing.json')).headers.get('cache-control'), /max-age=10/);
  stub(PLAYING);
  const playing = (await get('/now-playing.json')).headers.get('cache-control');
  assert.match(playing, /max-age=5/);
  // No stale-while-revalidate: it would let the edge serve a known-stale answer
  // past the TTL, which is the staleness the short TTL exists to remove.
  assert.doesNotMatch(playing, /stale-while-revalidate/);
});

test('the endpoint answers on the root as well as the json path', async () => {
  stub(PLAYING);
  for (const path of ['/', '/now-playing.json', '/api/now-playing.json']) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.equal((await res.json()).playing, true, path);
  }
});

test('any other path is passed through to the origin', async () => {
  stub();
  assert.equal(await (await get('/api/something-else')).text(), 'origin');
});

test('a write method is rejected, HEAD is not', async () => {
  stub(PLAYING);
  const call = (method) => worker.fetch(new Request('https://w.example/now-playing.json', { method }), ENV);
  const post = await call('POST');
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
  assert.equal((await call('HEAD')).status, 200);
});

test('a Spotify outage is reported as not playing, never as an error', async () => {
  globalThis.fetch = async () => {
    throw new Error('network down');
  };
  const res = await get('/now-playing.json');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).playing, false);
});

/* ------------------------------------------------------------------
   Rate limiting. The endpoint is polled, so the cost of a miss and the
   behaviour under a 429 are the whole of whether Spotify keeps answering.
   ------------------------------------------------------------------ */

test('the access token is exchanged once and then reused', async () => {
  stub(PLAYING);
  await get('/');
  assert.equal(calls.token, 1, 'first request exchanges');
  await get('/');
  await get('/');
  assert.equal(calls.token, 1, 'later requests reuse it');
  assert.equal(calls.play, 3, 'and still read the player each time');
});

test('debug reports whether the token was reused', async () => {
  stub(PLAYING);
  assert.equal((await (await get('/?debug=1')).json()).tokenCached, false);
  assert.equal((await (await get('/?debug=1')).json()).tokenCached, true);
});

/** Two requests, and how many token exchanges they should cost between them. */
for (const [what, opts, exchanges] of [
  ['a token about to expire is exchanged again rather than presented', { ...PLAYING, expiresIn: 30 }, 2],
  ['a rejected token is not held on to', { ...PLAYING, playStatus: 401 }, 2],
]) {
  test(what, async () => {
    stub(opts);
    await get('/');
    await get('/');
    assert.equal(calls.token, exchanges);
  });
}

test('a rate limit does not spend another call on the history endpoint', async () => {
  stub({ playStatus: 429, recentStatus: 200 });
  await get('/');
  assert.equal(calls.recent, 0);
});

/** What a 429 asks for, and how long the answer is then held at the edge. */
for (const [what, retryAfter, maxAge] of [
  ['is held for as long as Spotify asked', 45, 45],
  ['with an implausible Retry-After is clamped rather than obeyed', 99999, 300],
  ['without a Retry-After falls back to the idle window', null, 10],
]) {
  test(`a rate limit ${what}`, async () => {
    stub({ playStatus: 429, retryAfter });
    assert.match((await get('/')).headers.get('Cache-Control'), new RegExp(`s-maxage=${maxAge}`));
  });
}

test('the Retry-After Spotify sent is reported to debug', async () => {
  assert.equal((await debug({ playStatus: 429, retryAfter: 45 })).retryAfter, 45);
});

test('a rate limit serves the last good answer rather than blanking the card', async () => {
  const good = await body(PLAYING, '/');
  assert.equal(good.title, 'Yèkèrmo Sèw');
  assert.equal(good.stale, undefined, 'a live answer is not marked stale');
  const under = await body({ playStatus: 429 }, '/');
  assert.equal(under.title, 'Yèkèrmo Sèw', 'the card keeps its title');
  assert.equal(under.stale, true, 'and says the answer is remembered');
  assert.equal(under.fetchedAt, undefined, 'with no stamp to correct a stale position against');
});

test('an outage serves the last good answer too', async () => {
  await body(PLAYING, '/');
  globalThis.fetch = async () => {
    throw new Error('network');
  };
  const out = await (await get('/')).json();
  assert.partialDeepStrictEqual(out, { title: 'Yèkèrmo Sèw', stale: true });
});

test('an empty player is reported as empty, not as a remembered track', async () => {
  await body(PLAYING, '/');
  // 204 with no history is Spotify telling the truth: nothing is playing.
  const empty = await body({ playStatus: 204, recentStatus: 404 }, '/');
  assert.equal(empty.title, undefined, 'the card hides rather than showing a stale track');
  assert.equal(empty.playing, false);
});

test('debug names the substitution so it cannot be mistaken for a live read', async () => {
  await body(PLAYING, '/');
  assert.match((await debug({ playStatus: 429 })).reason, /served_last_good$/);
});
