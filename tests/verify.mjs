/**
 * What needs a real browser, and nothing else.
 *
 * Markup, SEO, feeds and the showcase invariants are properties of the built
 * HTML and are asserted by static.mjs without opening Chromium. What is left
 * here needs layout, a script, or a server: overflow at real viewports, an
 * error-free console, the theme surviving navigation, the reveal actually
 * firing, the keyboard layer, and a 404 that is a 404.
 *
 *   npm run build && npm run preview & npm run verify
 *
 * BASE_URL points it at a deployed site instead of the preview.
 */
import { BASE, ORIGIN, issues as makeIssues, launch, visit } from './harness.mjs';
import { collection } from '../scripts/frontmatter.mjs';

const issues = makeIssues();
const flag = (bad, msg) => bad && issues.push(msg);
const projectTitles = collection('projects')
  .filter((p) => !p.hidden && !p.draft)
  .map((p) => p.title)
  .filter(Boolean);

// Routes come from the built sitemap, so adding a page cannot leave this behind.
const sitemap = await (await fetch(`${BASE}/sitemap-0.xml`)).text();
const routes = [...new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname))];
if (routes.length < 5) throw new Error(`sitemap yielded only ${routes.length} routes`);
const SLASH = routes.some((r) => r.length > 1 && r.endsWith('/')) ? '/' : '';
console.log(`Driving ${routes.length} routes…`);

const browser = await launch();
const DESKTOP = { viewport: { width: 1280, height: 900 } };

// 1. Nothing overflows sideways, and nothing logs an error.
for (const [width, height, tag] of [
  [1440, 900, 'desktop'],
  [768, 1024, 'tablet'],
  [375, 812, 'mobile'],
]) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => issues.push(`[${tag}] pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && issues.push(`[${tag}] console: ${m.text()}`));

  for (const route of routes) {
    const res = await page.goto(ORIGIN + route, { waitUntil: 'load', timeout: 20000 });
    if (!res || res.status() >= 400) {
      issues.push(`[${tag}] ${route} -> HTTP ${res?.status()}`);
      continue;
    }
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 1
        ? `${document.documentElement.scrollWidth}px > ${window.innerWidth}px`
        : null,
    );
    flag(overflow, `[${tag}] ${route} horizontal overflow: ${overflow}`);
  }
  await ctx.close();
}

// 2. An unknown path must be a real 404, not a soft 200.
{
  const ctx = await browser.newContext();
  const status = (await ctx.request.get(`${BASE}/this-page-does-not-exist${SLASH}`)).status();
  flag(status !== 404, `unknown path returned HTTP ${status}, expected 404`);
  await ctx.close();
}

// 3. The theme cycles and survives a navigation.
{
  const { page, close } = await visit(browser, '/', { ...DESKTOP, colorScheme: 'dark', wait: 'load' });
  const seq = [];
  for (let i = 0; i < 4; i++) {
    seq.push(await page.evaluate(() => document.documentElement.dataset.theme));
    await page.click('#theme-toggle');
    await page.waitForTimeout(120);
  }
  flag(seq.join(',') !== 'system,light,dark,system', `theme cycle wrong: ${seq.join(',')}`);

  // The loop above left it one step past 'system', i.e. on 'light'.
  await page.goto(`${BASE}/about${SLASH}`, { waitUntil: 'load' });
  const kept = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    dark: document.documentElement.classList.contains('dark'),
  }));
  flag(kept.theme !== 'light' || kept.dark, `theme did not persist: ${JSON.stringify(kept)}`);
  await close();
}

// 4. The reveal fires — nothing in view is left hidden.
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

// 5. The keyboard layer: the palette and the shortcuts around it.
{
  const { page, close } = await visit(browser, '/', { ...DESKTOP, wait: 'load' });

  await page.keyboard.press('Control+k');
  await page.waitForTimeout(300);
  flag(!(await page.isVisible('#cmdk')), 'command palette did not open on Ctrl+K');
  flag(!(await page.evaluate(() => document.activeElement?.id === 'cmdk-input')), 'palette did not focus its input');

  // Unfiltered, the list is grouped and each heading appears once.
  const groups = await page.$$eval('.cmdk-group', (n) => n.map((e) => e.textContent));
  flag(new Set(groups).size !== groups.length, `palette repeats section headings: ${groups.join(', ')}`);
  const rows = await page.$$eval('.cmdk-row', (n) => n.length);
  flag(rows < 8, `palette listed only ${rows} entries`);

  // Every project must be reachable from it.
  const labels = await page.$$eval('.cmdk-label', (n) => n.map((e) => e.textContent));
  for (const title of projectTitles) flag(!labels.includes(title), `palette is missing project "${title}"`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  flag(await page.isVisible('#cmdk'), 'palette did not close on Escape');

  // Typing must never be swallowed by the single-key shortcuts.
  await page.keyboard.press('/');
  await page.waitForTimeout(250);
  flag(!(await page.isVisible('#cmdk')), 'palette did not open on /');
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.type('#cmdk-input', 'theme');
  await page.waitForTimeout(200);
  flag(
    (await page.evaluate(() => document.documentElement.dataset.theme)) !== before,
    'a single-key shortcut fired while typing in the palette',
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  // The Konami code toggles the layout grid, both ways.
  const konami = 'ArrowUp ArrowUp ArrowDown ArrowDown ArrowLeft ArrowRight ArrowLeft ArrowRight b a'.split(' ');
  const grid = () => page.evaluate(() => document.documentElement.hasAttribute('data-debug'));
  for (const [want, when] of [
    [true, 'on'],
    [false, 'back off'],
  ]) {
    for (const k of konami) await page.keyboard.press(k);
    await page.waitForTimeout(200);
    flag((await grid()) !== want, `the Konami code did not toggle the layout grid ${when}`);
  }
  await close();
}

await browser.close();
issues.report();
