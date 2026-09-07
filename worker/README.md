# now-playing worker

Answers `GET https://smr.et/api/now-playing.json` with what is playing on
Spotify right now, so the static site can show it without holding a secret.

The route deliberately shadows `public/api/now-playing.json` in the site
repository, which answers `{ "playing": false }`. That way the page always
gets a 200 — before this Worker is deployed the static file answers, and a
browser never logs a failed request for an endpoint that does not exist yet.

```json
{
  "playing": true,
  "title": "…",
  "artist": "…",
  "art": "https://i.scdn.co/…",
  "url": "https://open.spotify.com/…",
  "progressMs": 61234,
  "durationMs": 214000
}
```

`{ "playing": false }` when nothing is playing, when the credentials are
missing, or when Spotify is unreachable. The page treats all three the same
way: it renders nothing.

## Deploying from the dashboard (no CLI)

`src/index.js` is deliberately plain JavaScript in one file with no imports,
so it pastes into the dashboard editor verbatim. There is no build step.

**Before you start**, the refresh token must carry the
**`user-read-currently-playing`** scope. The one minted for the build-time
"recently played" feed only had `user-read-recently-played`, so mint a new one
with `node scripts/spotify-token.mjs` from the repository root — it now
requests both — and keep the client id and secret to hand.

### 1. Create the Worker

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Start with Hello World!** → **Create Worker**.
2. Name it `smr-now-playing`. Deploy the placeholder.
3. **Edit code**, select everything in the editor, and paste the whole of
   `worker/src/index.js` over it. **Deploy**.

It will answer `{"playing":false}` at this point — the secrets are not set yet,
which the Worker treats as "nothing playing" rather than an error.

### 2. Add the three secrets

From **Workers & Pages** → **Overview** → select the Worker → **Settings**,
then under **Variables and Secrets** select **Add**. For each one choose type
**Secret**, enter the name, paste the value, and **Deploy**:

| Variable name           | Value                                                |
| ----------------------- | ---------------------------------------------------- |
| `SPOTIFY_CLIENT_ID`     | from the Spotify app dashboard                       |
| `SPOTIFY_CLIENT_SECRET` | from the Spotify app dashboard, "View client secret" |
| `SPOTIFY_REFRESH_TOKEN` | printed by `scripts/spotify-token.mjs`               |

Secrets are hidden after saving, in the dashboard and in Wrangler alike. To
change one you overwrite it; you cannot read it back.

### 3. Point a hostname at it

There are two arrangements. **The route is better** — same origin as the site,
so no second DNS lookup, no second TLS handshake, no CORS, and nothing extra
for a blocker to catch. Pick one:

**Option A — a route on the apex (recommended, no site change).** In the
Worker's **Settings** → **Domains & Routes** → **Add** → **Route**:

- **Zone**: `smr.et`
- **Route**: `smr.et/api/*`

The DNS record for the apex must be **proxied** (orange cloud) or the route is
never consulted. Nothing else to do — the page already fetches
`/api/now-playing.json`.

**Option B — its own subdomain.** Add a **Custom Domain** such as
`now-playing.smr.et` instead. This works, but the page then has to fetch it
cross-origin, so set a repository **variable** (not a secret — it is a URL):

- **Settings → Secrets and variables → Actions → Variables → New variable**
- `PUBLIC_NOW_PLAYING_URL` = `https://now-playing.smr.et/now-playing.json`

The next site build picks it up. Without that variable the page keeps asking
the apex, which answers with the static `{ playing: false }` fallback, and the
card never appears no matter how healthy the Worker is.

### 4. Check it, with music actually playing

```sh
# Option A
curl -si https://smr.et/api/now-playing.json | head -20
# Option B, or the workers.dev URL — the root works too
curl -s https://now-playing.smr.et/
```

Opening the Worker's bare hostname in a browser works as well; it answers on
its root as well as on `/now-playing.json`.

Then read the table in the next section to tell which side answered.

## Deploying with Wrangler

The refresh token needs the **`user-read-currently-playing`** scope. The one
minted for the build-time "recently played" feed only has
`user-read-recently-played`, so mint a new one — `scripts/spotify-token.mjs`
in the repository root already requests both.

```sh
cd worker
npm install

# Stored encrypted at Cloudflare, not in this repository, not readable back.
npx wrangler secret put SPOTIFY_CLIENT_ID
npx wrangler secret put SPOTIFY_CLIENT_SECRET
npx wrangler secret put SPOTIFY_REFRESH_TOKEN

npx wrangler deploy
```

Then check it:

```sh
curl -s https://smr.et/api/now-playing.json | jq
```

## Why is it saying `playing: false`?

Add `?debug=1`. "Nothing is playing", "the refresh token has expired" and "the
token lacks the right scope" all produce an identical `{ playing: false }`
otherwise, which is not something you can debug from outside.

```sh
curl -s 'https://now-playing.smr.et/?debug=1' | jq
```

| `reason`                      | What it means                                                                                                                      | Fix                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `ok`                          | Playing, and reported                                                                                                              | nothing                                              |
| `spotify_204_nothing_playing` | Genuinely nothing on. **Token and scope are both good.**                                                                           | play something                                       |
| `paused`                      | A track is loaded but paused                                                                                                       | press play                                           |
| `spotify_403`                 | The token lacks `user-read-currently-playing`                                                                                      | re-mint the token, overwrite `SPOTIFY_REFRESH_TOKEN` |
| `spotify_401`                 | The access token was rejected. **Read `spotifyMessage`** — the status alone cannot tell a missing scope from a non-Premium account | see below                                            |
| `token_exchange_failed_400`   | The refresh token is expired or revoked                                                                                            | re-mint the token                                    |
| `spotify_429`                 | Rate limited                                                                                                                       | wait                                                 |
| `missing_secrets`             | One or more secrets are not set — the reply names which                                                                            | add them                                             |

A rejection also carries `spotifyMessage`, Spotify's own words for it. That
matters most for a 401, which has two very different causes:

- **"Permissions missing"** — the token lacks `user-read-currently-playing`.
  Re-mint it and overwrite the secret.
- **Anything mentioning Premium** — as of the February 2026 Web API changes,
  [all Development Mode apps require the app owner to have an active Spotify
  Premium subscription](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide).
  A free account cannot use the API in Development Mode at all, whatever the
  scopes say. Subscribe, or apply for extended quota mode.

Debug replies are `no-store`, so they are always a live read rather than a
minute-old cached answer. They report HTTP statuses and whether each secret is
set, never a value, so there is nothing there worth hiding behind auth.

## Is the Worker actually answering?

The static fallback and the Worker both return `{ playing: false }` when
nothing is on, so "it returns false" does not tell you which one replied.
Three things distinguish them:

```sh
curl -si https://smr.et/api/now-playing.json | head -20
```

| Signal                | Worker answered              | Origin answered (route not live) |
| --------------------- | ---------------------------- | -------------------------------- |
| Body whitespace       | `{"playing":false}`          | `{ "playing": false }`           |
| `cache-control`       | `max-age=30, s-maxage=30, …` | `max-age=600`                    |
| `x-github-request-id` | absent                       | present                          |

If the origin is answering, the route is not intercepting. Check
**Workers & Pages → smr-now-playing → Settings → Domains & Routes** in the
dashboard, confirm the zone route is listed, and confirm the DNS record for
the apex is **proxied** (orange cloud) — a grey-cloud record bypasses Workers
entirely.

`workers_dev` is on, so the Worker also has its own
`smr-now-playing.<your-subdomain>.workers.dev` URL. Hitting that tests the
code and the secrets in isolation from the routing:

```sh
npx wrangler deployments list          # confirms what is deployed
curl -s https://smr-now-playing.<subdomain>.workers.dev/api/now-playing.json
npx wrangler tail                      # stream logs while you curl
```

If the workers.dev URL works and the smr.et one does not, the problem is the
route. If neither works while music is playing, it is the secrets or the token
scope — the Worker needs `user-read-currently-playing`.

## Notes

- The route is on the site's own domain, so the page fetch is same-origin: no
  CORS preflight, no third-party request, nothing for a blocker to catch.
- Responses are cached at the edge for 30 seconds while playing and 60 when
  idle. Spotify's rate limit stays comfortable no matter the traffic, and
  visitors see "roughly now" rather than a live feed of your listening.
- The refresh token expires after 180 days on this Spotify app. When it does,
  the endpoint starts answering `playing: false` and the section quietly
  disappears — mint a new token and `wrangler secret put` it again.
- `npx wrangler tail` streams live logs if something looks wrong.
