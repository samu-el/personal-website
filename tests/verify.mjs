/**
 * End-to-end smoke suite: a real browser over every built route, asserting
 * what silently breaks on a static site. The numbered blocks below say what
 * each covers. BASE_URL points it at a deployed site instead of the preview.
 *
 *   npm run build && npm run preview & npm run verify
 */
import { BASE, BASE_PATH, ORIGIN, issues as makeIssues, launch, visit } from './harness.mjs';
import { collection } from '../scripts/frontmatter.mjs';

const issues = makeIssues();
/** Records `msg` when `bad` is true. Most of this suite is that shape. */
const flag = (bad, msg) => bad && issues.push(msg);

const projects = collection('projects');
// Published: what the site is expected to show, and the list every check below
// is measured against, so adding a project cannot leave the suite behind.
const published = projects.filter((p) => !p.hidden && !p.draft);
const projectTitles = published.map((p) => p.title).filter(Boolean);
const hasPosts = collection('posts').some((p) => !p.aiWritten && !p.draft);

// Routes are read from the built sitemap, so adding a page or renaming a post
// cannot leave this suite silently checking a stale list.
const sitemapRes = await fetch(`${BASE}/sitemap-0.xml`);
if (!sitemapRes.ok) throw new Error(`sitemap-0.xml -> HTTP ${sitemapRes.status}`);
const sitemapXml = await sitemapRes.text();
const routes = [
  ...new Set(
    [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname.replace(BASE_PATH, '') || '/'),
  ),
  // The custom 404 page, fetched as a file so it is 200 on both the preview
  // server and Pages; an unknown path is checked separately below.
  '/404.html',
];
// Sitemap URLs carry the site's trailing-slash convention. Hardcoded paths
// below must match it, or Astro's preview server 404s them (Pages would 301).
const SLASH = routes.some((r) => r.length > 1 && r.endsWith('/')) ? '/' : '';
// Guards against a sitemap that failed to enumerate — deliberately not a page
// count, so pruning the showcase doesn't break the suite.
if (routes.length < 5) throw new Error(`sitemap yielded only ${routes.length} routes`);
console.log(`Checking ${routes.length} routes…`);

const browser = await launch();
const DESKTOP = { viewport: { width: 1280, height: 900 } };

/* 1. Every route renders, with no console error, no broken internal link and
   no horizontal overflow.

   The markup assertions — one <h1>, every image with alt, every link with an
   accessible name, every internal link resolving — are properties of the HTML
   and do not vary with the viewport, so they run once. Only overflow does,
   which is the whole reason three viewports are opened at all. */
const markup = () => ({
  h1: document.querySelectorAll('h1').length,
  imgNoAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
  emptyLinks: [...document.querySelectorAll('a')]
    .filter((a) => !a.textContent.trim() && !a.getAttribute('aria-label') && !a.querySelector('[aria-label]'))
    .map((a) => a.getAttribute('href')),
  internal: [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')),
});
const overflowing = () =>
  document.documentElement.scrollWidth > window.innerWidth + 1
    ? `${document.documentElement.scrollWidth}px > ${window.innerWidth}px`
    : null;

for (const [width, height, tag] of [
  [1440, 900, 'desktop'],
  [768, 1024, 'tablet'],
  [375, 812, 'mobile'],
]) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => issues.push(`[${tag}] pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && issues.push(`[${tag}] console: ${m.text()}`));
  const first = tag === 'desktop';

  for (const route of routes) {
    const res = await page.goto(BASE + route, { waitUntil: 'load', timeout: 20000 });
    if (!res || res.status() >= 400) {
      issues.push(`[${tag}] ${route} -> HTTP ${res?.status()}`);
      continue;
    }
    const overflow = await page.evaluate(overflowing);
    flag(overflow, `[${tag}] ${route} horizontal overflow: ${overflow}`);
    if (!first) continue;

    const found = await page.evaluate(markup);
    flag(found.h1 !== 1, `${route} has ${found.h1} <h1>`);
    flag(found.imgNoAlt, `${route} ${found.imgNoAlt} img without alt`);
    flag(found.emptyLinks.length, `${route} link with no accessible name: ${found.emptyLinks.join(', ')}`);
    for (const link of new Set(found.internal)) {
      const r = await page.request.get(`${ORIGIN}${link}`);
      flag(r.status() >= 400, `broken internal link on ${route}: ${link} -> ${r.status()}`);
    }
  }
  await ctx.close();
}

// 1b. An unknown path must be a real 404, not a soft 200.
{
  const ctx = await browser.newContext();
  const r = await ctx.request.get(`${BASE}/this-page-does-not-exist${SLASH}`);
  flag(r.status() !== 404, `unknown path returned HTTP ${r.status()}, expected 404`);
  await ctx.close();
}

// 2. Theme toggle cycles and persists.
{
  const { page, close } = await visit(browser, '/', { ...DESKTOP, colorScheme: 'dark', wait: 'load' });
  const seq = [];
  for (let i = 0; i < 4; i++) {
    seq.push(await page.evaluate(() => document.documentElement.dataset.theme));
    await page.click('#theme-toggle');
    await page.waitForTimeout(120);
  }
  flag(seq.join(',') !== 'system,light,dark,system', `theme cycle wrong: ${seq.join(',')}`);
  // The loop above left the toggle one step past 'system', i.e. on 'light'.
  await page.goto(`${BASE}/about${SLASH}`, { waitUntil: 'load' });
  const kept = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    dark: document.documentElement.classList.contains('dark'),
  }));
  flag(kept.theme !== 'light' || kept.dark, `theme did not persist across navigation: ${JSON.stringify(kept)}`);
  await close();
}

/* The mobile menu is not checked here: interact.mjs drives it far harder — it
   opens, three ways of closing it, the focus walk, the panel's own geometry —
   and both suites run in the same CI job. */

// 3b. Writing policy: nothing an AI wrote may be published, and the section
//     only exists when there is something in it.
{
  const { page, close } = await visit(browser, '/', { ...DESKTOP, wait: 'load' });
  const navHasWriting = await page.evaluate(() =>
    [...document.querySelectorAll('header a')].some((a) => /\/writing\/?$/.test(a.pathname)),
  );
  flag(
    navHasWriting !== hasPosts,
    `nav ${navHasWriting ? 'shows' : 'hides'} Writing but ${hasPosts ? 'posts exist' : 'there are no posts'}`,
  );
  const listed = /\/writing\/?<\/loc>/.test(await (await page.request.get(`${BASE}/sitemap-0.xml`)).text());
  flag(listed && !hasPosts, 'empty /writing is listed in the sitemap');
  await close();
}

// 4. Showcase invariants: detail pages exist for exactly the showcased
//    projects, nothing hidden is reachable, client work links nowhere out.
{
  const { page, close } = await visit(browser, `/work${SLASH}`, { ...DESKTOP, wait: 'load' });
  for (const p of projects) {
    const status = (await page.request.get(`${BASE}/work/${p.slug}${SLASH}`)).status();
    flag(p.hidden && status !== 404, `hidden project /work/${p.slug} is reachable (HTTP ${status})`);
    flag(!p.hidden && status !== 200, `showcased project /work/${p.slug} -> HTTP ${status}`);
    // Client work is anonymised — an outbound repo or demo link would identify it.
    flag(p.kind === 'Client work' && /^(repo|demo):/m.test(p.raw), `${p.file} is client work but links out`);
  }
  const workPage = await page.evaluate(() => ({
    cards: document.querySelectorAll('article').length,
    // Hidden projects are not re-listed here; the page points at GitHub instead.
    hiddenListed: document.querySelectorAll('main ul a[href*="github.com/samu-el/"]').length,
    exploreLink: [...document.querySelectorAll('a')].some((a) => /github\.com\/samu-el\?tab=repositories/.test(a.href)),
  }));
  flag(workPage.cards !== published.length, `/work shows ${workPage.cards} cards, expected ${published.length}`);
  flag(workPage.hiddenListed > 0, `/work re-lists ${workPage.hiddenListed} hidden projects`);
  flag(!workPage.exploreLink, '/work has no link out to the GitHub profile');
  await close();
}

// 5. Reveal animation actually fires (motion on, excluding the intentional
//    bottom band).
{
  const { page, close } = await visit(browser, '/', { viewport: { width: 1440, height: 900 }, wait: 'load' });
  for (const frac of [0.3, 0.55, 0.8]) {
    await page.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), frac);
    await page.waitForTimeout(1100);
  }
  const stuck = await page.evaluate(() => {
    const trigger = window.innerHeight * 0.94; // matches the observer's -6% rootMargin
    return [...document.querySelectorAll('[data-reveal].reveal-pending:not(.is-visible)')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.top < trigger && r.bottom > 0;
    }).length;
  });
  flag(stuck, `${stuck} in-view element(s) still hidden after scrolling`);
  await close();
}

// 6. SEO / feed sanity.
{
  const { page, close } = await visit(browser, '/', { wait: 'load' });
  for (const [path, must] of [
    // The feed is valid whether or not anything is published; only assert items
    // when there are posts to be in it.
    ['/rss.xml', hasPosts ? ['<rss', '<language>en-us</language>', '<item>'] : ['<rss']],
    ['/sitemap-index.xml', ['<sitemapindex']],
    ['/robots.txt', ['Sitemap:', 'User-agent: *']],
  ]) {
    const r = await page.request.get(`${BASE}${path}`);
    if (r.status() !== 200) {
      issues.push(`${path} -> HTTP ${r.status()}`);
      continue;
    }
    const body = await r.text();
    for (const m of must) flag(!body.includes(m), `${path} missing: ${m}`);
  }
  const meta = await page.evaluate(() => ({
    title: document.title,
    desc: document.querySelector('meta[name="description"]')?.content,
    og: document.querySelector('meta[property="og:image"]')?.content,
    canonical: document.querySelector('link[rel="canonical"]')?.href,
    ld: document.querySelector('script[type="application/ld+json"]')?.textContent,
  }));
  flag(!meta.title?.includes('Samuel Mussie'), 'title missing name');
  flag(!meta.desc, 'missing meta description');
  flag(!meta.og?.endsWith('/og.png'), `og:image wrong: ${meta.og}`);

  /* The canonical names the production origin, not wherever this run is
     served from — so check its shape, not its host. og:image must be absolute
     too, or scrapers cannot fetch it. */
  const absolute = (raw, what, path) => {
    try {
      const u = new URL(raw);
      flag(u.protocol !== 'https:', `${what} is not https: ${raw}`);
      flag(path !== undefined && u.pathname !== path, `${what} path is ${u.pathname}, expected ${path}`);
    } catch {
      issues.push(`${what} is not an absolute URL: ${raw}`);
    }
  };
  absolute(meta.canonical, 'canonical', `${BASE_PATH}/`.replace(/\/+/g, '/'));
  absolute(meta.og, 'og:image');
  try {
    const ld = JSON.parse(meta.ld);
    flag(ld['@type'] !== 'Person' || ld.name !== 'Samuel Mussie', 'Person schema wrong');
  } catch {
    issues.push('Person JSON-LD is not valid JSON');
  }
  const ogRes = await page.request.get(`${BASE}/og.png`);
  flag(ogRes.status() !== 200, `og.png -> HTTP ${ogRes.status()}`);
  await close();
}

// 7. Keyboard layer: the command palette and the shortcuts around it.
{
  const { page, close } = await visit(browser, '/', { ...DESKTOP, wait: 'load' });
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(300);
  flag(!(await page.isVisible('#cmdk')), 'command palette did not open on Ctrl+K');
  flag(
    !(await page.evaluate(() => document.activeElement?.id === 'cmdk-input')),
    'command palette did not focus its input',
  );
  // Unfiltered, the list is grouped and each heading appears once.
  const groups = await page.$$eval('.cmdk-group', (n) => n.map((e) => e.textContent));
  flag(new Set(groups).size !== groups.length, `command palette repeats section headings: ${groups.join(', ')}`);
  const rowCount = await page.$$eval('.cmdk-row', (n) => n.length);
  flag(rowCount < 8, `command palette listed only ${rowCount} entries`);
  // Every project must be reachable from it.
  const labels = await page.$$eval('.cmdk-label', (n) => n.map((e) => e.textContent));
  for (const title of projectTitles) flag(!labels.includes(title), `command palette is missing project "${title}"`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  flag(await page.isVisible('#cmdk'), 'command palette did not close on Escape');
  // Typing must never be swallowed by the single-key shortcuts.
  await page.keyboard.press('/');
  await page.waitForTimeout(250);
  flag(!(await page.isVisible('#cmdk')), 'command palette did not open on /');
  const themeBefore = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.type('#cmdk-input', 'theme');
  await page.waitForTimeout(200);
  flag(
    (await page.evaluate(() => document.documentElement.dataset.theme)) !== themeBefore,
    'a single-key shortcut fired while typing in the palette',
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  // The Konami code reveals the layout grid, and entering it again hides it.
  const konami = 'ArrowUp ArrowUp ArrowDown ArrowDown ArrowLeft ArrowRight ArrowLeft ArrowRight b a'.split(' ');
  const gridShown = () => page.evaluate(() => document.documentElement.hasAttribute('data-debug'));
  for (const [expected, when] of [
    [true, 'on'],
    [false, 'back off'],
  ]) {
    for (const k of konami) await page.keyboard.press(k);
    await page.waitForTimeout(200);
    flag((await gridShown()) !== expected, `the Konami code did not toggle the layout grid ${when}`);
  }
  // The now-playing endpoint must always answer, so the browser never logs a
  // failed request for it. In production a Worker route shadows this file.
  const np = await page.request.get(`${BASE}/api/now-playing.json`);
  if (np.status() !== 200) {
    issues.push(`/api/now-playing.json -> HTTP ${np.status()} (the static fallback is missing)`);
  } else {
    const body = await np.json().catch(() => null);
    flag(!body || typeof body.playing !== 'boolean', '/api/now-playing.json did not return a boolean "playing"');
  }
  const humans = await page.request.get(`${BASE}/humans.txt`);
  flag(humans.status() !== 200, `humans.txt -> HTTP ${humans.status()}`);
  await close();
}

// 8. Project headings share a view-transition name with their detail page, so
//    the browser morphs one into the other instead of cross-fading.
{
  const { page, close } = await visit(browser, `/work${SLASH}`, { wait: 'load' });
  // Any heading level: the level is the page's business, carrying the name
  // is what this checks.
  const cardNames = await page.$$eval(':is(h1, h2, h3, h4)[style*="view-transition-name"]', (n) =>
    n.map((e) => e.style.viewTransitionName),
  );
  flag(
    cardNames.length !== projectTitles.length,
    `${cardNames.length} of ${projectTitles.length} work cards carry a transition name`,
  );
  for (const name of cardNames) {
    const slug = name.replace(/^project-/, '');
    await page.goto(`${BASE}/work/${slug}${SLASH}`, { waitUntil: 'load' });
    const h1 = await page.$eval('h1', (e) => e.style.viewTransitionName).catch(() => '');
    flag(h1 !== name, `/work/${slug} heading transition name is "${h1}", expected "${name}"`);
  }
  await close();
}

await browser.close();
issues.report();
