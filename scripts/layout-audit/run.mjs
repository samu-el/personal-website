#!/usr/bin/env node
// Layout audit: loads every page and its open states (command palette, mobile menu, now playing) at six
// viewports in light and dark, and reports page overflow, content poking out of the viewport or its clipping
// container, spilling text, overlapping controls, misaligned control rows and top-level blocks that do not
// share the page's left edge.
//
//   npm run build:fast && npx astro preview --port 4500 &
//   BASE_URL=http://localhost:4500 npm run audit:layout -- [options]
//
// Chromium comes from CHROMIUM_PATH (an executable path) or Playwright's own browser cache, as in the test
// suites (tests/harness.mjs). Requests that leave the preview server are aborted, so the run is offline and
// repeatable; the now-playing endpoint is answered with a fixed track.
//
// Options:
//   --routes a,b       only routes whose name starts with one of these
//   --viewports a,b    only these viewports (desktop, laptop, tablet-land, tablet, phone, phone-sm)
//   --themes light     only this theme
//   --shots <dir>      save a full-page screenshot per route, viewport and theme
//   --json <file>      write every finding as JSON
//   --concurrency n    pages in parallel (default 4)
//
// Exits 1 when anything is flagged.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';

import { BASE, launch } from '../../tests/harness.mjs';
import { analyzeLayout, collectLayout } from './detect.mjs';

const { values: opts } = parseArgs({
  options: {
    routes: { type: 'string' },
    viewports: { type: 'string' },
    themes: { type: 'string' },
    shots: { type: 'string' },
    json: { type: 'string' },
    concurrency: { type: 'string', default: '4' },
  },
});

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1280, height: 800 },
  'tablet-land': { width: 1024, height: 768 },
  tablet: { width: 768, height: 1024 },
  phone: { width: 390, height: 844 },
  'phone-sm': { width: 360, height: 740 },
};

/** Opens the command palette from the header's search button, or from the menu where that is folded away. */
const palette = async (page) => {
  if (!(await page.locator('#cmdk-open').isVisible())) await menu(page);
  await page.locator('[data-cmdk-open]:visible').first().click();
  await page.locator('#cmdk[open]').waitFor();
  await page.waitForTimeout(400);
};

/** Opens the mobile menu; only a phone shows the toggle. */
async function menu(page) {
  await page.locator('#menu-toggle').click();
  await page.locator('#mobile-menu:not([hidden])').waitFor();
  await page.waitForTimeout(400);
}

const TRACK = {
  playing: true,
  state: 'playing',
  title: 'Yèkèrmo Sèw',
  artist: 'Mulatu Astatke',
  album: 'Mulatu of Ethiopia',
  progressMs: 42000,
  durationMs: 300000,
};

/** Every project with a detail page: hidden and draft ones have none. */
const dir = new URL('../../src/content/projects/', import.meta.url);
const projects = readdirSync(dir)
  .filter((f) => /\.mdx?$/.test(f))
  .filter((f) => !/^(hidden|draft):\s*true\b/m.test(readFileSync(new URL(f, dir), 'utf8')))
  .map((f) => f.replace(/\.mdx?$/, ''));

export const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'about', path: '/about/' },
  { name: 'work', path: '/work/' },
  ...projects.map((id) => ({ name: `work-${id}`, path: `/work/${id}/` })),
  { name: 'stack', path: '/stack/' },
  { name: 'now', path: '/now/', track: TRACK },
  { name: 'now-quiet', path: '/now/' },
  { name: 'contact', path: '/contact/' },
  { name: 'writing', path: '/writing/' },
  { name: 'not-found', path: '/this-page-does-not-exist/' },
  { name: 'palette', path: '/', run: palette },
  { name: 'menu', path: '/', run: menu, narrow: true },
];

function pick(list, filter, exact = false) {
  if (!filter) return list;
  const wanted = filter.split(',');
  const name = (x) => (typeof x === 'string' ? x : x.name);
  return list.filter((x) => wanted.some((w) => (exact ? name(x) === w : name(x).startsWith(w))));
}

/**
 * Walk the page so lazy captures load, wait for every image that shows (the other theme's capture is
 * display:none and never loads) and for fonts, then a beat for the reveal.
 */
async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.evaluate(async () => {
    const top = scrollY;
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo({ top, behavior: 'instant' });
  });
  await page
    .waitForFunction(() => Array.from(document.images).every((img) => img.complete || !img.checkVisibility()), null, {
      timeout: 20000,
    })
    .catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

async function auditOne(browser, route, vpName, theme) {
  const vp = VIEWPORTS[vpName];
  const phone = vp.width < 768;
  const ctx = await browser.newContext({
    viewport: vp,
    deviceScaleFactor: 1,
    colorScheme: theme,
    reducedMotion: 'reduce',
    hasTouch: phone,
    isMobile: phone,
  });
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('theme', t);
    } catch {
      // Storage can be blocked; the colour scheme still applies.
    }
  }, theme);
  const origin = new URL(BASE).origin;
  await ctx.route('**/*', (r) => {
    const url = r.request().url();
    if (url.includes('/api/now-playing.json')) {
      return route.track
        ? r.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ...route.track, fetchedAt: Date.now() }),
          })
        : r.fulfill({ status: 204, body: '' });
    }
    return url.startsWith(origin) ? r.continue() : r.abort();
  });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + route.path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await settle(page);
    if (route.run) {
      await route.run(page);
      await settle(page);
    }
    const snap = await page.evaluate(collectLayout);
    const result = analyzeLayout(snap);
    if (opts.shots) {
      const file = `${opts.shots}/${route.name}-${vpName}${theme === 'dark' ? '-dark' : ''}.png`;
      await page.screenshot({ path: file, fullPage: !route.run });
    }
    await ctx.close();
    return result;
  } catch (e) {
    await ctx.close();
    return { findings: [{ kind: 'error', label: route.name, detail: String(e?.message ?? e).split('\n')[0] }] };
  }
}

async function main() {
  const browser = await launch();
  const routes = pick(ROUTES, opts.routes);
  const vps = pick(Object.keys(VIEWPORTS), opts.viewports, true);
  const themes = opts.themes ? opts.themes.split(',') : ['light', 'dark'];
  if (opts.shots) mkdirSync(opts.shots, { recursive: true });

  const jobs = [];
  for (const route of routes)
    for (const vp of vps) {
      if (route.narrow && VIEWPORTS[vp].width >= 768) continue;
      for (const theme of themes) jobs.push({ route, vp, theme });
    }
  const results = [];
  let next = 0;
  const workers = Array.from({ length: Number(opts.concurrency) || 4 }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const res = await auditOne(browser, job.route, job.vp, job.theme);
      results.push({ route: job.route.name, viewport: job.vp, theme: job.theme, ...res });
      const n = res.findings.length;
      process.stdout.write(`${n ? 'FLAG' : 'ok  '} ${job.route.name} ${job.vp} ${job.theme}${n ? ` (${n})` : ''}\n`);
    }
  });
  await Promise.all(workers);
  await browser.close();

  results.sort(
    (a, b) => a.route.localeCompare(b.route) || a.viewport.localeCompare(b.viewport) || a.theme.localeCompare(b.theme),
  );
  if (opts.json) {
    mkdirSync(dirname(opts.json), { recursive: true });
    writeFileSync(opts.json, JSON.stringify(results, null, 2));
  }
  const byRoute = new Map();
  for (const r of results) byRoute.set(r.route, (byRoute.get(r.route) ?? 0) + r.findings.length);
  console.log('\nFindings per route:');
  for (const [route, n] of byRoute) console.log(`  ${route.padEnd(28)} ${n}`);
  const total = results.reduce((s, r) => s + r.findings.length, 0);
  for (const r of results) {
    for (const f of r.findings) console.log(`${r.route} ${r.viewport} ${r.theme} ${f.kind}: ${f.label} ${f.detail}`);
  }
  console.log(`\n${total} finding(s) across ${results.length} page loads.`);
  process.exitCode = total ? 1 : 0;
}

await main();
