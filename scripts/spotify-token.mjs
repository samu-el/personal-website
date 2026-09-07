/**
 * Mints a Spotify refresh token, once, on your own machine.
 *
 *   SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... node scripts/spotify-token.mjs
 *
 * It opens the Spotify consent screen, catches the redirect on
 * http://127.0.0.1:8888/callback, exchanges the code, and prints the refresh
 * token. Nothing is written to disk and nothing is sent anywhere except
 * Spotify — put the printed token straight into a GitHub Actions secret.
 *
 * Before running, add this exact redirect URI to the app in the Spotify
 * dashboard, alongside whatever else is there:
 *
 *   http://127.0.0.1:8888/callback
 *
 * It has to be the IP literal. Spotify requires HTTPS for redirect URIs
 * except for loopback addresses, and `localhost` is explicitly not accepted.
 *
 * The resulting token is long-lived but not permanent: this app's refresh
 * token lifetime is 180 days, after which the feed goes quiet and you run
 * this again.
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const PORT = 8888;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
// Enough to read the play history. Add user-read-currently-playing if you
// later want a live indicator rather than a recent list.
const SCOPES = 'user-read-recently-played';

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
}).toString();

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
  return json.refresh_token;
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
    const refreshToken = await exchange(code);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(page('Done', '<p>Refresh token printed in your terminal. You can close this tab.</p>'));

    console.log('\n─────────────────────────────────────────────────────────');
    console.log('SPOTIFY_REFRESH_TOKEN');
    console.log(refreshToken);
    console.log('─────────────────────────────────────────────────────────');
    console.log('\nAdd it, plus the client id and secret, as repository secrets:');
    console.log('  Settings → Secrets and variables → Actions → New repository secret');
    console.log('\n  SPOTIFY_CLIENT_ID');
    console.log('  SPOTIFY_CLIENT_SECRET');
    console.log('  SPOTIFY_REFRESH_TOKEN');
    console.log('\nThe next build will pick up the feed. Treat all three as passwords.');
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
