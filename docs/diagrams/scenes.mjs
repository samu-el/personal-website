/**
 * The scenes. Run `node docs/diagrams/scenes.mjs` to regenerate every
 * .excalidraw file in this directory.
 */
import { arrow, box, heading, palette as p, text, write } from './build.mjs';

const W = 200;
const H = 64;
const col = (n) => 60 + n * 250;
const row = (n) => 150 + n * 110;

/* ── 1. System ─────────────────────────────────────────────────────────── */
{
  const els = [];
  els.push(
    ...heading(
      60,
      40,
      'System',
      'Static site, built in CI, served from Pages behind Cloudflare. One Worker holds the only secret.',
    ),
  );

  const content = box(col(0), row(0), W, H, 'src/content\nprojects · posts', { fill: p.PAPER });
  const pages = box(col(0), row(1), W, H, 'src/pages\n11 routes', { fill: p.PAPER });
  const feeds = box(col(1), row(2), W, H, 'src/lib/feeds.ts\nbuild-time reads', { fill: p.PAPER });

  const build = box(col(1), row(1), W, H, 'Astro build\ndeploy.yml', {
    fill: p.BLUE_BG,
    color: p.BLUE,
  });
  const dist = box(col(2), row(1), W, H, 'dist/\nHTML · CSS · a little JS', {
    fill: p.BLUE_BG,
    color: p.BLUE,
  });
  const pagesHost = box(col(3), row(1), W, H, 'GitHub Pages\norigin', {
    fill: p.BLUE_BG,
    color: p.BLUE,
  });
  const cf = box(col(4), row(1), W, H, 'Cloudflare\nsmr.et', { fill: p.GOLD_BG, color: p.GOLD });
  const browser = box(col(4), row(3), W, H, 'Browser', { fill: p.PAPER });

  const gh = box(col(2), row(2), W, H, 'GitHub API', { fill: p.PAPER, color: p.MUTED });
  const lb = box(col(0), row(2), W, H, 'Letterboxd RSS', { fill: p.PAPER, color: p.MUTED });

  const worker = box(col(3), row(0) - 20, W, H, 'Worker\nsmr.et/api/*', {
    fill: p.GOLD_BG,
    color: p.GOLD,
  });
  const spotify = box(col(4), row(0) - 20, W, H, 'Spotify API', { fill: p.PAPER, color: p.MUTED });

  els.push(content, pages, feeds, build, dist, pagesHost, cf, browser, gh, lb, worker, spotify);
  els.push(
    ...arrow(content, build),
    ...arrow(pages, build),
    ...arrow(feeds, build),
    ...arrow(build, dist),
    ...arrow(dist, pagesHost),
    ...arrow(pagesHost, cf),
    ...arrow(cf, browser, { label: 'HTML', offset: -34 }),
    ...arrow(lb, feeds, { dashed: true }),
    ...arrow(gh, feeds, { dashed: true }),
    ...arrow(cf, worker, { label: '/api/*' }),
    ...arrow(worker, spotify, { dashed: true }),
    ...arrow(browser, cf, { label: 'poll /api/*', dashed: true, offset: 34 }),
  );

  els.push(
    text(col(0), row(4) + 40, 'Secrets never reach the browser', { size: 18 }),
    text(
      col(0),
      row(4) + 70,
      'Build-time secrets (Spotify, GitHub token) are read through process.env in CI only —\nAstro inlines nothing into client JS except PUBLIC_*. The Worker holds the refresh token\nas an encrypted Worker secret. The page only ever sees trimmed JSON.',
      { size: 14, color: p.MUTED },
    ),
  );
  await write('01-system', els);
}

/* ── 2. Now playing ────────────────────────────────────────────────────── */
{
  const els = [];
  els.push(
    ...heading(
      60,
      40,
      'Now playing',
      'One card, three states, and a poll that follows the endpoint rather than a clock.',
    ),
  );

  const card = box(col(0), row(0), W, H, 'NowPlaying.astro\nmarkup + skeleton', { fill: p.PAPER });
  const client = box(col(0), row(1), W, H, 'now-playing.ts\npoll · paint', { fill: p.PAPER });
  const edge = box(col(1), row(1), W, H, 'Edge cache\ns-maxage 5s / 10s', {
    fill: p.GOLD_BG,
    color: p.GOLD,
  });
  const worker = box(col(2), row(1), W, H, 'Worker fetch()', { fill: p.GOLD_BG, color: p.GOLD });
  const token = box(col(3), row(0), W, H, 'Token, isolate-local\nreused for its hour', {
    fill: p.JADE_BG,
    color: p.JADE,
  });
  const player = box(col(3), row(1), W, H, 'currently-playing', { fill: p.PAPER, color: p.MUTED });
  const recent = box(col(3), row(2), W, H, 'recently-played', { fill: p.PAPER, color: p.MUTED });
  const lastGood = box(col(2), row(2), W, H, 'lastGood\n10 min memory', {
    fill: p.JADE_BG,
    color: p.JADE,
  });

  els.push(card, client, edge, worker, token, player, recent, lastGood);
  els.push(
    ...arrow(card, client),
    ...arrow(client, edge, { label: 'no-store' }),
    ...arrow(edge, worker, { label: 'miss' }),
    ...arrow(worker, token),
    ...arrow(worker, player),
    ...arrow(worker, recent, { label: '204 / no item', dashed: true }),
    ...arrow(worker, lastGood, { label: 'on failure', dashed: true }),
  );

  els.push(
    text(col(0), row(3) + 10, 'Client states', { size: 18 }),
    text(
      col(0),
      row(3) + 40,
      'loading  skeleton, set before first paint, aria-busy, link inert\nready    content swapped in; bars clear themselves (textContent)\nempty    no Worker, no track, or a failed request — card removed',
      { size: 14, color: p.MUTED },
    ),
    text(col(2) + 40, row(3) + 10, 'Poll cadence', { size: 18 }),
    text(
      col(2) + 40,
      row(3) + 40,
      'next = (s-maxage − Age) + jitter   ~4.3s playing, ~9.4s paused\nfailure  5s → 10s → … capped at 5 min\nhidden tab  no poll at all; returning polls at once',
      { size: 14, color: p.MUTED },
    ),
  );
  await write('02-now-playing', els);
}

/* ── 3. Motion ─────────────────────────────────────────────────────────── */
{
  const els = [];
  els.push(...heading(60, 40, 'Motion', 'One duration scale, three gates, and two scripts that follow the pointer.'));

  const css = box(col(0), row(0), W, H, 'tokens.css\n--t-1 … --t-5', {
    fill: p.GOLD_BG,
    color: p.GOLD,
  });
  const motion = box(col(0), row(1), W, H, 'motion.css\nreveal · VT · tilt', { fill: p.PAPER });
  const touch = box(col(0), row(2), W, H, 'touch.css\n:active · hit areas', { fill: p.PAPER });

  const env = box(col(1), row(1), W, H, 'client/env.ts\ncalm · fine · dark', {
    fill: p.JADE_BG,
    color: p.JADE,
  });
  const follow = box(col(2), row(0), W, H, 'client/follow.ts\none delegated listener', {
    fill: p.JADE_BG,
    color: p.JADE,
  });
  const layout = box(col(3), row(0), W, H, 'Buttons lean\n5px toward cursor', { fill: p.PAPER });
  const frame = box(col(3), row(1), W, H, 'Frames tilt\n±4°, glow follows', { fill: p.PAPER });
  const reveal = box(col(2), row(2), W, H, 'IntersectionObserver\nreveal + rule draw', {
    fill: p.JADE_BG,
    color: p.JADE,
  });

  els.push(css, motion, touch, env, follow, layout, frame, reveal);
  els.push(
    ...arrow(css, motion),
    ...arrow(motion, env, { dashed: true }),
    ...arrow(env, follow),
    ...arrow(follow, layout),
    ...arrow(follow, frame),
    ...arrow(env, reveal),
  );

  els.push(
    text(col(0), row(3) + 20, 'Three gates, every time', { size: 18 }),
    text(
      col(0),
      row(3) + 50,
      '1. prefers-reduced-motion collapses every duration AND delay to nothing\n2. (hover: hover) and (pointer: fine) guards anything cursor-driven\n3. .js on <html> opts in anything a failed script must not leave hidden',
      { size: 14, color: p.MUTED },
    ),
    text(col(2) + 60, row(3) + 20, 'Measured', { size: 18 }),
    text(
      col(2) + 60,
      row(3) + 50,
      'tilt catches the cursor   530ms → 0ms\nbutton lean                250ms → 149ms\nheader compression shift     8px → 0px',
      {
        size: 14,
        color: p.MUTED,
      },
    ),
  );
  await write('03-motion', els);
}

/* ── 4. Content ────────────────────────────────────────────────────────── */
{
  const els = [];
  els.push(...heading(60, 40, 'Content', 'Collections in, routes out. Two flags decide what is ever rendered.'));

  const projects = box(col(0), row(0), W, H, 'content/projects\n*.md + zod schema', {
    fill: p.PAPER,
  });
  const posts = box(col(0), row(1), W, H, 'content/posts\n*.md + zod schema', { fill: p.PAPER });
  const postsLib = box(col(1), row(1), W, H, 'lib/posts.ts\npublished · nav', {
    fill: p.JADE_BG,
    color: p.JADE,
  });

  const work = box(col(2), row(0), W, H, '/work + /work/[id]', { fill: p.BLUE_BG, color: p.BLUE });
  const writing = box(col(2), row(1), W, H, '/writing + /writing/[id]', {
    fill: p.BLUE_BG,
    color: p.BLUE,
  });
  const feed = box(col(3), row(1), W, H, 'rss.xml · sitemap', { fill: p.BLUE_BG, color: p.BLUE });
  const assets = box(col(1), row(0), W, H, 'lib/assets.ts\npreview by id', {
    fill: p.JADE_BG,
    color: p.JADE,
  });

  els.push(projects, posts, postsLib, work, writing, feed, assets);
  els.push(
    ...arrow(projects, assets),
    ...arrow(assets, work),
    ...arrow(posts, postsLib),
    ...arrow(postsLib, writing),
    ...arrow(writing, feed),
  );

  els.push(
    text(col(0), row(2) + 20, 'The two flags', { size: 18 }),
    text(
      col(0),
      row(2) + 50,
      'draft      hidden in production, visible while developing\naiWritten  never rendered, in any environment, ever — the site publishes\n           only Samuel’s own words, and the build enforces it rather than\n           trusting anyone to remember\nhidden     a project kept out of the showcase; still listed under “Also public”',
      { size: 14, color: p.MUTED },
    ),
    text(col(0), row(4) + 10, 'Writing disappears cleanly', { size: 18 }),
    text(
      col(0),
      row(4) + 40,
      'With nothing published, the Writing nav item drops out and the numbering is\nrecomputed so there is no gap where it used to be.',
      { size: 14, color: p.MUTED },
    ),
  );
  await write('04-content', els);
}

/* ── 5. Testing ────────────────────────────────────────────────────────── */
{
  const els = [];
  els.push(...heading(60, 40, 'Testing', 'Four suites, one shared harness, everything run in CI on every push.'));

  const harness = box(col(1), row(0), W, H, 'tests/harness.mjs\nlaunch · proxy · report', {
    fill: p.JADE_BG,
    color: p.JADE,
  });
  const verify = box(col(0), row(1), W, H, 'verify.mjs\n10 routes, a11y, links', { fill: p.PAPER });
  const interact = box(col(2), row(1), W, H, 'interact.mjs\n63 interaction checks', {
    fill: p.PAPER,
  });
  const feedsT = box(col(0), row(2), W, H, 'feeds.test.mjs\n28 parser cases', {
    fill: p.PAPER,
  });
  const workerT = box(col(2), row(2), W, H, 'worker.test.mjs\n38 stubbed cases', { fill: p.PAPER });
  const ci = box(col(1), row(3), W, H, 'ci.yml\ntypecheck · build · all', {
    fill: p.BLUE_BG,
    color: p.BLUE,
  });

  els.push(harness, verify, interact, feedsT, workerT, ci);
  els.push(
    ...arrow(harness, verify),
    ...arrow(harness, interact),
    ...arrow(verify, ci),
    ...arrow(interact, ci),
    ...arrow(feedsT, ci),
    ...arrow(workerT, ci),
  );

  els.push(
    text(col(0), row(4) + 20, 'What each one is for', { size: 18 }),
    text(
      col(0),
      row(4) + 50,
      'verify      every route renders: one h1, no overflow, no broken internal link,\n            no image without alt, no link without a name, theme persists\ninteract    what only exists under a pointer, a key or a scroll — the mobile\n            panel, the entrance, tilt and lean, the poll cadence, reduced motion\nfeeds       the parsers, against recorded payloads, so no network is needed\nworker      every debug reason string, token reuse, 429 handling, last-good',
      { size: 14, color: p.MUTED },
    ),
  );
  await write('05-testing', els);
}

/* ── 6. Client runtime ─────────────────────────────────────────────────── */
{
  const els = [];
  els.push(
    ...heading(
      60,
      40,
      'Client runtime',
      'What actually runs in the browser, and what each module is allowed to touch.',
    ),
  );

  const theme = box(col(0), row(0), W, H, 'Layout.astro\ntheme, pre-paint', {
    fill: p.GOLD_BG,
    color: p.GOLD,
  });
  const env = box(col(1), row(1), W, H, 'client/env.ts\ncalm · fine · dark', {
    fill: p.JADE_BG,
    color: p.JADE,
  });
  const dom = box(col(1), row(2), W, H, 'client/dom.ts\n$ · $$ · byId', {
    fill: p.JADE_BG,
    color: p.JADE,
  });
  const follow = box(col(1), row(0), W, H, 'client/follow.ts\none pointer listener', {
    fill: p.JADE_BG,
    color: p.JADE,
  });

  const header = box(col(2), row(0), W, H, 'header.ts\npanel · indicator', { fill: p.PAPER });
  const np = box(col(2), row(1), W, H, 'now-playing.ts\npoll · paint · progress', { fill: p.PAPER });
  const palette = box(col(2), row(2), W, H, 'palette.ts\nsearch · chords', { fill: p.PAPER });
  const small = box(col(2), row(3), W, H, 'toc · count · copy-email', { fill: p.PAPER });

  const data = box(col(3), row(1), W, H, 'DOM as the channel\ndata-* · JSON script tag', {
    fill: p.BLUE_BG,
    color: p.BLUE,
  });

  els.push(theme, env, dom, follow, header, np, palette, small, data);
  els.push(
    ...arrow(env, header, { offset: -14 }),
    ...arrow(dom, header, { offset: 14 }),
    ...arrow(env, np),
    ...arrow(dom, palette),
    ...arrow(follow, header, { dashed: true }),
    ...arrow(theme, env, { label: 'data-theme', dashed: true }),
    ...arrow(dom, small),
    ...arrow(data, np, { label: 'data-endpoint' }),
    ...arrow(data, palette, { label: 'cmdk-data' }),
  );

  els.push(
    text(col(0), row(4) + 20, 'Rules this layout enforces', { size: 18 }),
    text(
      col(0),
      row(4) + 50,
      'processed     every module above is a processed <script>, so Astro bundles\n              and dedupes them. Only the theme script is inline, because it\n              has to run before first paint.\nno define:vars it forces a script inline, which forbids imports. Data reaches\n              the client through the DOM instead.\nno router      navigation is native cross-document view transitions, so\n              astro:page-load never fires and nothing re-initialises.\nthree gates    env.ts answers prefers-reduced-motion, pointer: fine and the\n              colour scheme once, for every module that asks.',
      { size: 14, color: p.MUTED },
    ),
  );
  await write('06-client-runtime', els);
}
