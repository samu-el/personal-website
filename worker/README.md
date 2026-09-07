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
