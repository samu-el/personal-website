/**
 * Mints a Spotify refresh token, once, on your own machine.
 *
 *   SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... node scripts/spotify-token.mjs
 *
 * Opens the consent screen, catches the redirect, exchanges the code and
 * prints the token. Nothing is written to disk or sent anywhere but Spotify.
 *
 * Add `http://127.0.0.1:8888/callback` to the app in the Spotify dashboard
 * first — the IP literal, since Spotify requires HTTPS for redirect URIs
 * except loopback and does not accept `localhost`. The token lasts 180 days.
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const PORT = 8888;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
// Both feeds: the build-time "recently played" list needs the history, and
// the now-playing Worker needs the current track. Minting one token for both
// means one authorisation and one secret to rotate.
const SCOPES = 'user-read-recently-played user-read-currently-playing';
/** Without this one the now-playing Worker can only ever answer 401. */
const REQUIRED_SCOPE = 'user-read-currently-playing';

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    'Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in the environment.\n\n' +
      '  SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy node scripts/spotify-token.mjs\n\n' +
      'Prefix the command with a space if your shell records history.',
  );
  process.exit(1);
}

// Guards against a stray request to the callback completing the exchange.
const state = randomBytes(16).toString('hex');

const authUrl = new URL('https://accounts.spotify.com/authorize');
authUrl.search = new URLSearchParams({
  client_id: clientId,
  response_type: 'code',
  redirect_uri: REDIRECT_URI,
  scope: SCOPES,
  state,
  // Force the consent screen so re-running always returns a fresh token.
  show_dialog: 'true',
})
  .toString()
  // URLSearchParams writes a space as "+", which a query parameter is only
  // conventionally read as a space. %20 leaves nothing to interpret.
  .replace(/\+/g, '%20');

async function exchange(code) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `token exchange failed: HTTP ${res.status} ${json.error ?? ''} ${json.error_description ?? ''}`.trim(),
    );
  }
  if (!json.refresh_token) throw new Error('no refresh_token in the response');
  return { refreshToken: json.refresh_token, scope: json.scope ?? '' };
}

const page = (title, body) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title>` +
  `<body style="font:16px/1.6 system-ui;max-width:34rem;margin:12vh auto;padding:0 1.5rem">` +
  `<h1 style="font-size:1.3rem">${title}</h1>${body}</body>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname !== '/callback') {
    res.writeHead(404).end('Not found');
    return;
  }
  const error = url.searchParams.get('error');
  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(page('Denied', `<p>Spotify returned <code>${error}</code>. Nothing was stored.</p>`));
    console.error(`\nAuthorization denied: ${error}`);
    server.close();
    process.exitCode = 1;
    return;
  }
  if (url.searchParams.get('state') !== state) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(page('State mismatch', '<p>That request did not come from this run. Ignored.</p>'));
    return;
  }
  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(400).end('Missing code');
    return;
  }
  try {
    const { refreshToken, scope } = await exchange(code);
    const granted = scope.split(' ').filter(Boolean);
    const hasRequired = granted.includes(REQUIRED_SCOPE);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(page('Done', '<p>Refresh token printed in your terminal. You can close this tab.</p>'));
    console.log('\n─────────────────────────────────────────────────────────');
    console.log('SPOTIFY_REFRESH_TOKEN');
    console.log(refreshToken);
    console.log('─────────────────────────────────────────────────────────');
    console.log(`\nGranted scopes: ${granted.join(', ') || '(none reported)'}`);
    if (!hasRequired) {
      // Worth stopping on: scopes are bound at approval time, so this token
      // can never acquire the missing one by being refreshed.
      console.error(
        `\n!! This token is MISSING ${REQUIRED_SCOPE}, so the Worker can only answer 401.\n` +
          `   The consent screen must list "currently playing". Requested: ${SCOPES}`,
      );
      process.exitCode = 1;
      return;
    }
    console.log('\nAdd all three as repository secrets — see docs/architecture.md, "Now playing".');
    console.log('Treat them as passwords.');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(page('Failed', `<p>${err.message}</p>`));
    console.error(`\n${err.message}`);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Open this URL, and approve the request:\n');
  console.log(authUrl.toString());
  console.log(`\nWaiting for the redirect to ${REDIRECT_URI} …`);
  console.log('(Ctrl+C to give up.)');
});
