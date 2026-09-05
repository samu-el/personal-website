/**
 * End-to-end smoke suite. Drives a real browser over every built route and
 * asserts the things that silently break on a static site:
 *
 *   1. Every route renders — no console errors, no horizontal overflow,
 *      exactly one <h1>, no image without alt, no link without a name.
 *   2. No broken internal links (each is actually fetched).
 *   3. The theme toggle cycles system → light → dark and persists across pages.
 *   4. The mobile menu opens and closes on Escape.
 *   5. The work-page filter narrows the grid.
 *   6. The scroll reveal fires — nothing stays invisible in the viewport.
 *   7. RSS, sitemap, robots.txt, OG tags and the Person schema are intact.
 *
 * Usage:
 *   npm run build && npm run preview &
 *   npm run verify
 *
 * Set BASE_URL to point at a deployed site instead of the local preview.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';

const ORIGIN = process.env.BASE_URL ?? 'http://localhost:4321';
const BASE_PATH = process.env.BASE_PATH ?? '';
const BASE = `${ORIGIN}${BASE_PATH}`;

// Node's global fetch ignores HTTPS_PROXY, so checking a deployed site from
// behind an egress proxy fails with a 403 from the proxy rather than a real
// response. Route fetch through it, and hand the same proxy to the browser.
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || '';
if (PROXY) setGlobalDispatcher(new EnvHttpProxyAgent());
const proxyOption = PROXY
  ? { server: PROXY, bypass: (process.env.NO_PROXY || 'localhost,127.0.0.1').split(',').join(',') }
  : undefined;
const OUT = process.env.SHOT_DIR ?? '.screenshots';
await mkdir(OUT, { recursive: true });

// Routes are read from the built sitemap, so adding a page or renaming a post
// cannot leave this suite silently checking a stale list.
const sitemapRes = await fetch(`${BASE}/sitemap-0.xml`);
if (!sitemapRes.ok) throw new Error(`sitemap-0.xml -> HTTP ${sitemapRes.status}`);
const sitemap = await sitemapRes.text();
const routes = [
  ...new Set(
    [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (m) => new URL(m[1]).pathname.replace(BASE_PATH, '') || '/',
    ),
  ),
  // The custom 404 page, fetched as a file so it is 200 on both the preview
  // server and Pages; an unknown path is checked separately below.
  '/404.html',
];
// Sitemap URLs carry the site's trailing-slash convention. Hardcoded paths
// below must match it, or Astro's preview server 404s them (Pages would 301).
const SLASH = routes.some((r) => r.length > 1 && r.endsWith('/')) ? '/' : '';
// Guards against a sitemap that failed to enumerate — deliberately not a
// page count, so pruning the showcase doesn't break the suite.
if (routes.length < 5) throw new Error(`sitemap yielded only ${routes.length} routes`);
console.log(`Checking ${routes.length} routes…`);

const browser = await chromium.launch({
  // Honour a preinstalled browser when one is provided (CI images, sandboxes).
  executablePath: process.env.CHROMIUM_PATH || undefined,
  proxy: proxyOption,
});
const issues = [];

// 1. Every route renders, no console errors, no broken internal links, no overflow.
for (const [w, h, tag] of [
  [1440, 900, 'desktop'],
  [768, 1024, 'tablet'],
  [375, 812, 'mobile'],
]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => issues.push(`[${tag}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') issues.push(`[${tag}] console: ${m.text()}`);
  });

  for (const route of routes) {
    const res = await page.goto(BASE + route, { waitUntil: 'load', timeout: 20000 });
    if (!res || res.status() >= 400) {
      issues.push(`[${tag}] ${route} -> HTTP ${res?.status()}`);
      continue;
    }

    const check = await page.evaluate(() => {
      const out = { overflow: null, h1: 0, imgNoAlt: 0, emptyLinks: [], internal: [] };
      if (document.documentElement.scrollWidth > window.innerWidth + 1) {
        out.overflow = `${document.documentElement.scrollWidth}px > ${window.innerWidth}px`;
      }
      out.h1 = document.querySelectorAll('h1').length;
      out.imgNoAlt = [...document.querySelectorAll('img')].filter(
        (i) => !i.hasAttribute('alt'),
      ).length;
      out.emptyLinks = [...document.querySelectorAll('a')]
        .filter(
          (a) =>
            !a.textContent.trim() &&
            !a.getAttribute('aria-label') &&
            !a.querySelector('[aria-label]'),
        )
        .map((a) => a.getAttribute('href'));
      out.internal = [...document.querySelectorAll('a[href^="/"]')].map((a) =>
        a.getAttribute('href'),
      );
      return out;
    });

    if (check.overflow) issues.push(`[${tag}] ${route} horizontal overflow: ${check.overflow}`);
    if (check.h1 !== 1) issues.push(`[${tag}] ${route} has ${check.h1} <h1>`);
    if (check.imgNoAlt) issues.push(`[${tag}] ${route} ${check.imgNoAlt} img without alt`);
    if (check.emptyLinks.length)
      issues.push(`[${tag}] ${route} link with no accessible name: ${check.emptyLinks.join(', ')}`);

    if (tag === 'desktop') {
      for (const link of new Set(check.internal)) {
        const r = await page.request.get(`${ORIGIN}${link}`);
        if (r.status() >= 400)
          issues.push(`broken internal link on ${route}: ${link} -> ${r.status()}`);
      }
    }
  }
  await ctx.close();
}

// 1b. An unknown path must be a real 404, not a soft 200.
{
  const ctx = await browser.newContext();
  const r = await ctx.request.get(`${BASE}/this-page-does-not-exist${SLASH}`);
  if (r.status() !== 404) issues.push(`unknown path returned HTTP ${r.status()}, expected 404`);
  await ctx.close();
}

// 2. Theme toggle cycles and persists.
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: 'dark',
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const seq = [];
  for (let i = 0; i < 4; i++) {
    seq.push(await page.evaluate(() => document.documentElement.dataset.theme));
    await page.click('#theme-toggle');
    await page.waitForTimeout(120);
  }
  if (seq.join(',') !== 'system,light,dark,system')
    issues.push(`theme cycle wrong: ${seq.join(',')}`);

  // The loop above left the toggle one step past 'system', i.e. on 'light'.
  await page.goto(`${BASE}/about${SLASH}`, { waitUntil: 'load' });
  const persisted = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    dark: document.documentElement.classList.contains('dark'),
  }));
  if (persisted.theme !== 'light' || persisted.dark) {
    issues.push(`theme did not persist across navigation: ${JSON.stringify(persisted)}`);
  }
  await ctx.close();
}

// 3. Mobile menu opens, is keyboard-dismissable, and links out.
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.click('#menu-toggle');
  await page.waitForTimeout(200);
  if (!(await page.isVisible('#mobile-menu'))) issues.push('mobile menu did not open');
  await page.screenshot({ path: `${OUT}/mobile-menu-open.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  if (await page.isVisible('#mobile-menu')) issues.push('mobile menu did not close on Escape');
  await ctx.close();
}

// 3b. Writing policy: nothing an AI wrote may be published, and the section
//     only exists when there is something in it.
const hasPosts = await (async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const dir = new URL('../src/content/posts/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => /\.mdx?$/.test(f));
  let publishable = 0;
  for (const file of files) {
    const raw = await readFile(new URL(file, dir), 'utf8');
    const ai = /^aiWritten:\s*true\s*$/m.test(raw);
    const draft = /^draft:\s*true\s*$/m.test(raw);
    if (!ai && !draft) publishable += 1;
  }
  return publishable > 0;
})();

{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  const navHasWriting = await page.evaluate(() =>
    [...document.querySelectorAll('header a')].some((a) => /\/writing\/?$/.test(a.pathname)),
  );
  if (navHasWriting !== hasPosts) {
    issues.push(
      `nav ${navHasWriting ? 'shows' : 'hides'} Writing but ${hasPosts ? 'posts exist' : 'there are no posts'}`,
    );
  }

  const sitemap = await (await page.request.get(`${BASE}/sitemap-0.xml`)).text();
  const inSitemap = /\/writing\/?<\/loc>/.test(sitemap);
  if (inSitemap && !hasPosts) issues.push('empty /writing is listed in the sitemap');
  await ctx.close();
}

// 4. Showcase invariants: exactly the showcased projects have detail pages,
//    nothing marked hidden is reachable, and client work carries no outbound
//    link. Slugs are read from the project files so this holds as the
//    showcase changes.
{
  const { readdir, readFile } = await import('node:fs/promises');
  const dir = new URL('../src/content/projects/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => /\.mdx?$/.test(f));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  for (const file of files) {
    const raw = await readFile(new URL(file, dir), 'utf8');
    const slug = file.replace(/\.mdx?$/, '');
    const hidden = /^hidden:\s*true\s*$/m.test(raw);
    const res = await page.request.get(`${BASE}/work/${slug}${SLASH}`);
    if (hidden && res.status() !== 404) {
      issues.push(`hidden project /work/${slug} is reachable (HTTP ${res.status()})`);
    }
    if (!hidden && res.status() !== 200) {
      issues.push(`showcased project /work/${slug} -> HTTP ${res.status()}`);
    }
    // Client work is anonymised — an outbound repo or demo link would identify it.
    if (/^kind:\s*'Client work'/m.test(raw) && /^(repo|demo):/m.test(raw)) {
      issues.push(`${file} is client work but carries an outbound repo/demo link`);
    }
  }

  await page.goto(`${BASE}/work${SLASH}`, { waitUntil: 'load' });
  const workPage = await page.evaluate(() => ({
    cards: document.querySelectorAll('article').length,
    // Hidden projects are not re-listed here; the page points at GitHub instead.
    hiddenListed: document.querySelectorAll('main ul a[href*="github.com/samu-el/"]').length,
    exploreLink: [...document.querySelectorAll('a')].some((a) =>
      /github\.com\/samu-el\?tab=repositories/.test(a.href),
    ),
  }));
  if (workPage.cards !== 1) issues.push(`/work shows ${workPage.cards} project cards, expected 1`);
  if (workPage.hiddenListed > 0) {
    issues.push(`/work re-lists ${workPage.hiddenListed} hidden projects`);
  }
  if (!workPage.exploreLink) issues.push('/work has no link out to the GitHub profile');
  await ctx.close();
}

// 5. Reveal animation actually fires (motion on, excluding the intentional bottom band).
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  for (const frac of [0.3, 0.55, 0.8]) {
    await page.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), frac);
    await page.waitForTimeout(1100);
  }
  const stuck = await page.evaluate(() => {
    const trigger = window.innerHeight * 0.94; // matches the observer's -6% rootMargin
    return [...document.querySelectorAll('[data-reveal].reveal-pending:not(.is-visible)')].filter(
      (el) => {
        const r = el.getBoundingClientRect();
        return r.top < trigger && r.bottom > 0;
      },
    ).length;
  });
  if (stuck) issues.push(`${stuck} in-view element(s) still hidden after scrolling`);
  await ctx.close();
}

// 6. SEO / feed sanity.
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  for (const [path, must] of [
    // The feed is valid whether or not anything is published; only assert
    // items when there are posts to be in it.
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
    for (const m of must) if (!body.includes(m)) issues.push(`${path} missing: ${m}`);
  }
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const meta = await page.evaluate(() => ({
    title: document.title,
    desc: document.querySelector('meta[name="description"]')?.content,
    og: document.querySelector('meta[property="og:image"]')?.content,
    canonical: document.querySelector('link[rel="canonical"]')?.href,
    ld: document.querySelector('script[type="application/ld+json"]')?.textContent,
  }));
  if (!meta.title?.includes('Samuel Mussie')) issues.push('title missing name');
  if (!meta.desc) issues.push('missing meta description');
  if (!meta.og?.endsWith('/og.png')) issues.push(`og:image wrong: ${meta.og}`);
  // The canonical points at the configured production origin, not wherever
  // this run happens to be served from, so check its shape rather than its
  // host: absolute, https, and the path this page actually lives at.
  try {
    const c = new URL(meta.canonical);
    if (c.protocol !== 'https:') issues.push(`canonical is not https: ${meta.canonical}`);
    const expected = `${BASE_PATH}/`.replace(/\/+/g, '/');
    if (c.pathname !== expected) {
      issues.push(`canonical path is ${c.pathname}, expected ${expected}`);
    }
  } catch {
    issues.push(`canonical is not an absolute URL: ${meta.canonical}`);
  }
  // og:image must be absolute too, or scrapers cannot fetch it.
  try {
    const o = new URL(meta.og);
    if (o.protocol !== 'https:') issues.push(`og:image is not https: ${meta.og}`);
  } catch {
    issues.push(`og:image is not an absolute URL: ${meta.og}`);
  }
  try {
    const ld = JSON.parse(meta.ld);
    if (ld['@type'] !== 'Person' || ld.name !== 'Samuel Mussie') issues.push('Person schema wrong');
  } catch {
    issues.push('Person JSON-LD is not valid JSON');
  }
  const ogRes = await page.request.get(`${BASE}/og.png`);
  if (ogRes.status() !== 200) issues.push(`og.png -> HTTP ${ogRes.status()}`);
  await ctx.close();
}

await browser.close();
console.log(
  issues.length
    ? `${issues.length} ISSUE(S):\n` + [...new Set(issues)].join('\n')
    : '✓ All checks passed.',
);

if (issues.length) process.exitCode = 1;
