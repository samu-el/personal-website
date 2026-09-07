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

## Deploying

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
