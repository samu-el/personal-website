/**
 * Exercises the Worker's fetch handler against stubbed Spotify responses.
 *
 * The point of these is the debug reasons. "Nothing is playing", "the refresh
 * token expired" and "the token lacks user-read-currently-playing" all produce
 * an identical `{ playing: false }` in normal operation, and telling them apart
 * by hand cost two rounds of guessing. Each one is pinned here.
 *
 * Run with: npm test  (from worker/)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

// Minimal Workers runtime surface. The Cache API is a no-op so every call is
// a live read; `btoa` exists in Workers but not in Node's global scope.
globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
globalThis.btoa ??= (v) => Buffer.from(v, 'binary').toString('base64');

const ENV = {
  SPOTIFY_CLIENT_ID: 'id',
  SPOTIFY_CLIENT_SECRET: 'secret',
  SPOTIFY_REFRESH_TOKEN: 'refresh',
};

/** Replaces global fetch with canned Spotify answers. */
function stub({
  tokenStatus = 200,
  playStatus = 200,
  playBody = null,
  errorBody = null,
  tokenScope = 'user-read-recently-played user-read-currently-playing',
  // The recently-played fallback, reached whenever the player has no track.
  // Defaults to failing, so a test only sees it when it asks for it.
  recentStatus = 404,
  recentBody = null,
} = {}) {
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('accounts.spotify.com')) {
      return new Response(
        tokenStatus === 200 ? JSON.stringify({ access_token: 'tok', scope: tokenScope }) : 'no',
        { status: tokenStatus },
      );
    }
    // Checked first: both endpoints live on api.spotify.com.
    if (url.includes('recently-played')) {
      return new Response(recentStatus === 200 ? JSON.stringify(recentBody ?? RECENT) : 'no', {
        status: recentStatus,
      });
    }
    if (url.includes('api.spotify.com')) {
      if (playStatus >= 400) {
        return new Response(errorBody ?? JSON.stringify({ error: { status: playStatus } }), {
          status: playStatus,
        });
      }
      return new Response(playStatus === 204 ? null : JSON.stringify(playBody ?? {}), {
        status: playStatus,
      });
    }
    // Anything else is the pass-through to the static origin.
    return new Response('origin', { status: 200 });
  };
}

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

const get = (path, env = ENV) =>
  worker.fetch(new Request(`https://w.example${path}`, { method: 'GET' }), env);

const reasonOf = async (opts, env = ENV, path = '/?debug=1') => {
  stub(opts);
  return (await (await get(path, env)).json()).reason;
};

const PLAYING = {
  playBody: {
    is_playing: true,
    progress_ms: 1000,
    item: {
      name: 'Yèkèrmo Sèw',
      duration_ms: 200000,
      artists: [{ name: 'Mulatu Astatke' }],
      album: { name: 'Mulatu of Ethiopia', images: [{ url: 'https://i.scdn.co/x' }] },
      external_urls: { spotify: 'https://open.spotify.com/x' },
    },
  },
};

test('debug reports missing secrets without revealing values', async () => {
  stub();
  const body = await (await get('/?debug=1', {})).json();
  assert.equal(body.reason, 'missing_secrets');
  assert.deepEqual(body.secrets, {
    SPOTIFY_CLIENT_ID: false,
    SPOTIFY_CLIENT_SECRET: false,
    SPOTIFY_REFRESH_TOKEN: false,
  });
  // Booleans only — a value here would be a credential leak.
  for (const v of Object.values(body.secrets)) assert.equal(typeof v, 'boolean');
});

test('an expired refresh token is distinguishable', async () => {
  assert.equal(await reasonOf({ tokenStatus: 400 }), 'token_exchange_failed_400');
});

test('nothing playing is a 204, and proves token and scope are good', async () => {
  assert.equal(await reasonOf({ playStatus: 204 }), 'spotify_204_nothing_playing');
});

test('a token without user-read-currently-playing surfaces as 403', async () => {
  assert.equal(await reasonOf({ playStatus: 403 }), 'spotify_403');
});

test('an invalid access token surfaces as 401', async () => {
  assert.equal(await reasonOf({ playStatus: 401 }), 'spotify_401');
});

test('a rate limit surfaces as 429', async () => {
  assert.equal(await reasonOf({ playStatus: 429 }), 'spotify_429');
});

test('paused playback is not "nothing playing"', async () => {
  assert.equal(await reasonOf({ playBody: { is_playing: false, item: { name: 'x' } } }), 'paused');
});

test('a playing track is reported in full', async () => {
  stub(PLAYING);
  const body = await (await get('/now-playing.json')).json();
  assert.equal(body.playing, true);
  assert.equal(body.title, 'Yèkèrmo Sèw');
  assert.equal(body.artist, 'Mulatu Astatke');
  assert.equal(body.album, 'Mulatu of Ethiopia');
  assert.equal(body.art, 'https://i.scdn.co/x');
  assert.equal(body.progressMs, 1000);
  assert.equal(body.durationMs, 200000);
});

test('a playing track is stamped so the page can correct for cache age', async () => {
  // progressMs is a reading taken when the Worker ran, and the edge may serve
  // that same reading for up to CACHE_SECONDS afterwards. Without the stamp
  // the page cannot tell a fresh reading from a stale one, and every visitor
  // gets a bar sitting up to half a minute behind the music.
  stub(PLAYING);
  const before = Date.now();
  const body = await (await get('/now-playing.json')).json();
  assert.equal(typeof body.fetchedAt, 'number');
  assert.ok(body.fetchedAt >= before && body.fetchedAt <= Date.now());
});

test('a payload that is not advancing carries no stamp to correct against', async () => {
  // The stamp exists so the page can add cache age to progressMs. Neither a
  // paused nor a finished track is advancing, so applying it there would walk
  // the bar forward through music nobody is listening to.
  stub({ playBody: { is_playing: false, progress_ms: 5000, item: { name: 'x', duration_ms: 9 } } });
  assert.equal((await (await get('/now-playing.json')).json()).fetchedAt, undefined);

  stub({ playStatus: 204, recentStatus: 200 });
  assert.equal((await (await get('/now-playing.json')).json()).fetchedAt, undefined);
});

test('a paused track is reported with its position, not hidden', async () => {
  stub({
    playBody: {
      is_playing: false,
      progress_ms: 61234,
      item: {
        name: 'Yèkèrmo Sèw',
        duration_ms: 200000,
        artists: [{ name: 'Mulatu Astatke' }],
        album: { name: 'Mulatu of Ethiopia', images: [{ url: 'https://i.scdn.co/x' }] },
      },
    },
  });
  const body = await (await get('/now-playing.json')).json();
  assert.equal(body.state, 'paused');
  assert.equal(body.playing, false);
  assert.equal(body.title, 'Yèkèrmo Sèw');
  // The position is what makes paused worth showing over the history endpoint.
  assert.equal(body.progressMs, 61234);
  assert.equal(body.durationMs, 200000);
});

test('an empty player falls back to the last track played', async () => {
  stub({ playStatus: 204, recentStatus: 200 });
  const body = await (await get('/now-playing.json')).json();
  assert.equal(body.state, 'recent');
  assert.equal(body.playing, false);
  assert.equal(body.title, 'Tezeta');
  assert.equal(body.artist, 'Mulatu Astatke');
  assert.equal(body.art, 'https://i.scdn.co/t');
  assert.equal(body.url, 'https://open.spotify.com/t');
  assert.equal(body.playedAt, '2026-09-07T10:00:00.000Z');
  // A finished track has no position, so the page must not draw a bar for it.
  assert.equal(body.progressMs, undefined);
});

test('a token holding only the history scope still fills the card', async () => {
  // This is the shape of the bug that cost two rounds of guessing: scopes are
  // bound at authorisation time, so such a token answers 401 on the player
  // forever. It can still answer this, which beats a blank card.
  stub({ tokenScope: 'user-read-recently-played', playStatus: 401, recentStatus: 200 });
  const body = await (await get('/now-playing.json')).json();
  assert.equal(body.state, 'recent');
  assert.equal(body.title, 'Tezeta');

  const dbg = await (await get('/?debug=1')).json();
  // The underlying problem stays visible rather than being papered over.
  assert.equal(dbg.reason, 'spotify_401');
  assert.equal(dbg.scopeOk, false);
  assert.equal(dbg.recentReason, 'recent_200');
});

test('the fallback reports its own failure separately', async () => {
  stub({ playStatus: 204, recentStatus: 403 });
  const body = await (await get('/?debug=1')).json();
  assert.equal(body.reason, 'spotify_204_nothing_playing');
  assert.equal(body.recentReason, 'recent_403');
  assert.equal(body.playing, false);
});

test('the fallback is not consulted while something is playing', async () => {
  // An extra Spotify call per request against a rate limit, for an answer
  // that would be discarded.
  stub(PLAYING);
  const asked = [];
  const inner = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    asked.push(typeof input === 'string' ? input : input.url);
    return inner(input, init);
  };
  await get('/now-playing.json');
  assert.equal(asked.filter((u) => u.includes('recently-played')).length, 0);
});

test('an empty history is not mistaken for a track', async () => {
  stub({ playStatus: 204, recentStatus: 200, recentBody: { items: [] } });
  const body = await (await get('/?debug=1')).json();
  assert.equal(body.recentReason, 'recent_empty');
  assert.equal(body.playing, false);
  assert.equal(body.title, undefined);
});

test("debug relays Spotify's own message on a rejection", async () => {
  // 401 alone cannot distinguish a missing scope from a non-Premium account;
  // Spotify says which in the body.
  stub({
    playStatus: 401,
    errorBody: JSON.stringify({ error: { status: 401, message: 'Permissions missing' } }),
  });
  const body = await (await get('/?debug=1')).json();
  assert.equal(body.reason, 'spotify_401');
  assert.match(body.spotifyMessage, /Permissions missing/);
});

test('no spotifyMessage is attached when nothing was rejected', async () => {
  stub({ playStatus: 204 });
  const body = await (await get('/?debug=1')).json();
  assert.equal(body.reason, 'spotify_204_nothing_playing');
  assert.equal(body.spotifyMessage, undefined);
});

test('debug reports the scopes the refresh token actually carries', async () => {
  // Scopes are bound at authorisation time, so a token granted without
  // user-read-currently-playing can never acquire it by being refreshed. This
  // makes that visible without waiting for a 401.
  stub({ tokenScope: 'user-read-recently-played', playStatus: 401 });
  const bad = await (await get('/?debug=1')).json();
  assert.equal(bad.grantedScopes, 'user-read-recently-played');
  assert.equal(bad.scopeOk, false);

  stub({ playStatus: 204 });
  const good = await (await get('/?debug=1')).json();
  assert.match(good.grantedScopes, /user-read-currently-playing/);
  assert.equal(good.scopeOk, true);
});

test('the normal payload carries no diagnostics', async () => {
  // reason and secrets are debug-only; the public endpoint stays minimal.
  stub({ playStatus: 403, recentStatus: 403 });
  const body = await (await get('/now-playing.json')).json();
  assert.deepEqual(Object.keys(body), ['playing']);
});

test('a debug response is never cached, a normal one is', async () => {
  stub({ playStatus: 204 });
  assert.equal((await get('/?debug=1')).headers.get('cache-control'), 'no-store');
  const normal = (await get('/now-playing.json')).headers.get('cache-control');
  assert.match(normal, /max-age=10/);
  stub(PLAYING);
  const playing = (await get('/now-playing.json')).headers.get('cache-control');
  assert.match(playing, /max-age=5/);
  // No stale-while-revalidate: it would let the edge serve a known-stale
  // answer past the TTL, which is the staleness the short TTL exists to
  // remove. This is the regression that made the card look frozen.
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
  const res = await get('/api/something-else');
  assert.equal(await res.text(), 'origin');
});

test('a write method is rejected, HEAD is not', async () => {
  stub(PLAYING);
  const post = await worker.fetch(
    new Request('https://w.example/now-playing.json', { method: 'POST' }),
    ENV,
  );
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');

  const head = await worker.fetch(
    new Request('https://w.example/now-playing.json', { method: 'HEAD' }),
    ENV,
  );
  assert.equal(head.status, 200);
});

test('a Spotify outage is reported as not playing, never as an error', async () => {
  globalThis.fetch = async () => {
    throw new Error('network down');
  };
  const res = await get('/now-playing.json');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).playing, false);
});
