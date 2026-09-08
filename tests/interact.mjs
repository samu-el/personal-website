/**
 * Interaction suite. The smoke suite in verify.mjs proves every page renders;
 * this one drives the things that only exist once a pointer, a key or a
 * scroll is involved, and that no static check can see:
 *
 *   1. The mobile menu opens to its own height, over an opaque background,
 *      with the page it covers veiled — and closes on a tap outside, on
 *      Escape, and on a deliberate scroll.
 *   2. The hero headline enters word by word and the text around it follows.
 *   3. The header compresses on scroll and the reading hairline tracks it.
 *   4. Heavy rules draw in, metric numerals count up.
 *   5. Ledger rows answer hover: underline, index colour, title nudge.
 *   6. Preview frames tilt and lift under the cursor and settle when it goes.
 *   7. Buttons lean toward the cursor; the nav indicator follows the links.
 *   8. Under prefers-reduced-motion none of it moves and nothing is hidden.
 *
 * Usage:
 *   npm run build && npm run preview & npm run verify:interact
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:4321';
const EXEC = process.env.CHROMIUM_PATH || undefined;
const results = [];
const check = (name, ok, info = '') => results.push({ name, ok: Boolean(ok), info });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** The word-by-word hero runs for about 1.4s; wait it out before measuring. */
const ENTRANCE = 2200;

const browser = await chromium.launch({ executablePath: EXEC });

// ── 1. Mobile menu ──────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 780 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await sleep(ENTRANCE);
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));
  await sleep(300);

  await page.click('#menu-toggle');
  await sleep(150);
  const mid = await page.$eval('#mobile-menu', (el) => el.getBoundingClientRect().height);
  await sleep(700);

  const open = await page.evaluate(() => {
    const menu = document.getElementById('mobile-menu');
    const scrim = document.getElementById('menu-scrim');
    const box = menu.getBoundingClientRect();
    const rows = [...menu.querySelectorAll('.menu-row')];
    return {
      top: Math.round(box.top),
      height: Math.round(box.height),
      // Every row has to sit inside the panel that paints the background.
      rowsInside: rows.every((r) => r.getBoundingClientRect().bottom <= box.bottom + 1),
      rowsCount: rows.length,
      rowsVisible: rows.every((r) => Number(getComputedStyle(r).opacity) === 1),
      background: getComputedStyle(menu).backgroundColor,
      scrim: Number(getComputedStyle(scrim).opacity),
      // What the page renders where the panel's last row is.
      atLastRow: document.elementFromPoint(60, box.bottom - 12)?.closest('#mobile-menu, #main')?.id,
    };
  });

  check(
    'menu: animates open rather than snapping',
    mid > 0 && mid < open.height,
    `${Math.round(mid)} -> ${open.height}`,
  );
  check('menu: opens below the header bar', open.top >= 48 && open.top <= 72, `top=${open.top}`);
  check('menu: tall enough for every row', open.height > 300, `height=${open.height}`);
  check(
    'menu: no row spills outside the panel',
    open.rowsInside && open.rowsCount >= 5,
    `rows=${open.rowsCount} inside=${open.rowsInside}`,
  );
  check('menu: rows have arrived', open.rowsVisible);
  check('menu: panel is opaque', /^rgb\(\d+, \d+, \d+\)$/.test(open.background), open.background);
  check(
    'menu: page under the last row is the panel, not the page',
    open.atLastRow === 'mobile-menu',
    `hit=${open.atLastRow}`,
  );
  check('menu: scrim veils the page', open.scrim === 1, `opacity=${open.scrim}`);
  /* A disclosure, so focus stays on the trigger and Tab walks in. */
  const tabbed = await page.evaluate(() => document.activeElement?.id);
  await page.keyboard.press('Tab');
  const inside = await page.evaluate(() => ({
    inPanel: document.activeElement?.closest('#mobile-menu') !== null,
    label: document.activeElement?.textContent?.trim().slice(0, 12),
  }));
  check(
    'menu: Tab walks from the trigger into the panel',
    tabbed === 'menu-toggle' && inside.inPanel,
    `${tabbed} -> ${JSON.stringify(inside)}`,
  );

  /* And Tab does not escape past the last row while it is open. */
  const stops = await page.evaluate(async () => {
    const rows = document.querySelectorAll('#mobile-menu a, #mobile-menu button').length;
    return rows;
  });
  for (let i = 0; i < stops; i++) await page.keyboard.press('Tab');
  const wrapped = await page.evaluate(
    () =>
      document.activeElement?.closest('#mobile-menu') !== null ||
      document.activeElement?.id === 'menu-toggle',
  );
  check('menu: Tab stays inside the open panel', wrapped, `stops=${stops}`);

  /* Opening must not shift the page under the reader. The click is dispatched
     inside the page rather than driven by the harness: Playwright scrolls a
     sticky element into view before clicking it, and that scroll would be
     measured here as a jump of the site's own. */
  await page.keyboard.press('Escape');
  await sleep(700);
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));
  await sleep(300);
  const moved = await page.evaluate(async () => {
    const before = window.scrollY;
    document.getElementById('menu-toggle').click();
    await new Promise((r) => setTimeout(r, 800));
    return { before, after: window.scrollY };
  });
  check(
    'menu: opening does not move the page',
    Math.abs(moved.after - moved.before) < 8,
    `${moved.before} -> ${moved.after}`,
  );

  // A tap outside closes it.
  await page.click('#menu-scrim', { position: { x: 200, y: 700 } });
  await sleep(700);
  const byScrim = await page.evaluate(() => ({
    hidden: document.getElementById('mobile-menu').hidden,
    scrim: Number(getComputedStyle(document.getElementById('menu-scrim')).opacity),
  }));
  check(
    'menu: closes on a tap outside',
    byScrim.hidden && byScrim.scrim === 0,
    JSON.stringify(byScrim),
  );

  // Escape closes it and hands focus back to the trigger.
  await page.click('#menu-toggle');
  await sleep(650);
  await page.keyboard.press('Escape');
  await sleep(650);
  const byEsc = await page.evaluate(() => ({
    hidden: document.getElementById('mobile-menu').hidden,
    focus: document.activeElement?.id,
  }));
  check(
    'menu: Escape closes it and restores focus',
    byEsc.hidden && byEsc.focus === 'menu-toggle',
    JSON.stringify(byEsc),
  );

  // A deliberate scroll closes it; the panel is a header dropdown, not a page.
  await page.click('#menu-toggle');
  await sleep(650);
  await page.evaluate(() => window.scrollTo({ top: window.scrollY + 400, behavior: 'instant' }));
  await sleep(700);
  check(
    'menu: closes on a deliberate scroll',
    await page.evaluate(() => document.getElementById('mobile-menu').hidden),
  );

  check('menu: no errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── 2. Desktop motion ───────────────────────────────────────────────────
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await sleep(150);

const words = await page.locator('.hero-words .w').count();
check('hero: words present', words >= 9, `count=${words}`);
check(
  'hero: last word starts hidden',
  Number(await page.$eval('.hero-words .w:last-child', (el) => getComputedStyle(el).opacity)) < 1,
);
await sleep(ENTRANCE);
check(
  'hero: last word ends visible',
  Number(await page.$eval('.hero-words .w:last-child', (el) => getComputedStyle(el).opacity)) === 1,
);
const enter = await page.$$eval('.hero-enter', (els) =>
  els.map((e) => getComputedStyle(e).opacity),
);
check(
  'hero: surrounding text follows the words in',
  enter.every((o) => Number(o) === 1),
  enter.join(','),
);

// Header compression and the reading hairline.
const barTall = await page.$eval(
  '#site-header .header-bar',
  (el) => el.getBoundingClientRect().height,
);
await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
await sleep(500);
const barShort = await page.$eval(
  '#site-header .header-bar',
  (el) => el.getBoundingClientRect().height,
);
check('header: compresses on scroll', barShort < barTall, `${barTall} -> ${barShort}`);
const progress = await page.$eval('.scroll-progress', (el) => ({
  supports: CSS.supports('animation-timeline: scroll()'),
  timeline: getComputedStyle(el).animationTimeline,
  width: el.getBoundingClientRect().width,
  scale: new DOMMatrix(getComputedStyle(el).transform).a,
}));
check(
  'header: reading hairline tracks the scroll',
  !progress.supports ||
    (progress.timeline.startsWith('scroll(') && progress.scale > 0 && progress.scale < 1),
  JSON.stringify(progress),
);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await sleep(450);
check(
  'header: restores at the top',
  Math.abs(
    (await page.$eval('#site-header .header-bar', (el) => el.getBoundingClientRect().height)) -
      barTall,
  ) < 1,
);

// The nav indicator sits under the current page and follows the pointer.
const navHome = await page.$eval('#primary-nav', (el) => el.hasAttribute('data-indicator'));
const first = page.locator('#primary-nav .nav-link').first();
const restX = await page.$eval('.nav-indicator', (el) => el.style.getPropertyValue('--x'));
await first.hover();
await sleep(500);
const hoverX = await page.$eval('.nav-indicator', (el) => ({
  x: el.style.getPropertyValue('--x'),
  w: el.style.getPropertyValue('--w'),
  opacity: getComputedStyle(el).opacity,
}));
check(
  'nav: indicator follows the hovered link',
  hoverX.x !== restX && parseFloat(hoverX.w) > 0 && Number(hoverX.opacity) === 1,
  `${restX} -> ${JSON.stringify(hoverX)}`,
);
await page.mouse.move(700, 500);
await sleep(500);
check(
  'nav: indicator returns to the current page',
  (await page.$eval('.nav-indicator', (el) => el.style.getPropertyValue('--x'))) === restX ||
    !navHome,
);

// Metric numerals count up on arrival.
const count = await page.evaluate(async () => {
  const el = document.querySelector('[data-count]');
  const initial = el.textContent.trim();
  el.scrollIntoView({ block: 'center', behavior: 'instant' });
  await new Promise((r) => setTimeout(r, 300));
  const mid = el.textContent.trim();
  await new Promise((r) => setTimeout(r, 1500));
  return { initial, mid, end: el.textContent.trim() };
});
check(
  'count-up: animates and lands on the real figure',
  count.mid !== count.end && count.end === count.initial,
  JSON.stringify(count),
);

// Heavy rules draw in.
const draw = await page.evaluate(async () => {
  const rule = document.querySelector('.rule-heavy[data-draw]');
  if (!rule) return { missing: true };
  const pending = rule.classList.contains('draw-pending');
  rule.scrollIntoView({ block: 'center', behavior: 'instant' });
  await new Promise((r) => setTimeout(r, 1300));
  return {
    pending,
    visible: rule.classList.contains('is-visible'),
    scale: new DOMMatrix(getComputedStyle(rule).transform).a,
  };
});
check(
  'rule: draws in on arrival',
  draw.pending && draw.visible && draw.scale > 0.99,
  JSON.stringify(draw),
);

// Ledger rows under the pointer.
const row = page.locator('.ledger-row').first();
await row.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy({ top: -100, behavior: 'instant' }));
await sleep(400);
const read = (el) => ({
  index: getComputedStyle(el.querySelector('.row-index')).color,
  title: getComputedStyle(el.querySelector('.row-title')).transform,
  rule: new DOMMatrix(getComputedStyle(el, '::after').transform).a,
});
const rowRest = await row.evaluate(read);
await row.hover({ position: { x: 300, y: 40 } });
await sleep(700);
const rowHover = await row.evaluate(read);
check(
  'row hover: index lights',
  rowRest.index !== rowHover.index,
  `${rowRest.index} -> ${rowHover.index}`,
);
check(
  'row hover: title nudges',
  rowHover.title !== rowRest.title && rowHover.title !== 'none',
  rowHover.title,
);
check(
  'row hover: underline draws',
  rowHover.rule > 0.99 && rowRest.rule < 0.01,
  `${rowRest.rule} -> ${rowHover.rule}`,
);
await page.mouse.move(5, 5);

// The ticker pauses so a word can be read.
const band = page.locator('.marquee-band').first();
await band.scrollIntoViewIfNeeded();
await sleep(300);
const tickerRunning = await band
  .locator('.animate-marquee')
  .first()
  .evaluate((el) => getComputedStyle(el).animationPlayState);
await band.hover();
await sleep(120);
const tickerPaused = await band
  .locator('.animate-marquee')
  .first()
  .evaluate((el) => getComputedStyle(el).animationPlayState);
check(
  'ticker: pauses under the pointer',
  tickerRunning === 'running' && tickerPaused === 'paused',
  `${tickerRunning} -> ${tickerPaused}`,
);
await page.mouse.move(5, 5);

// Preview frames.
const frame = page.locator('.group\\/frame').first();
await frame.scrollIntoViewIfNeeded();
await sleep(300);
const fbox = await frame
  .locator('.frame-card')
  .evaluate((el) => el.getBoundingClientRect().toJSON());
await page.mouse.move(fbox.x + fbox.width * 0.9, fbox.y + fbox.height * 0.2);
await sleep(650);
const tilt = await frame.locator('.frame-card').evaluate((el) => ({
  rx: el.style.getPropertyValue('--rx'),
  ry: el.style.getPropertyValue('--ry'),
  lift: getComputedStyle(el).getPropertyValue('--lift').trim(),
}));
check('frame: tilts toward the cursor', Boolean(tilt.rx && tilt.ry), JSON.stringify(tilt));
check('frame: lifts on hover', tilt.lift === '-4px', tilt.lift);
await page.mouse.move(5, 5);
await sleep(150);
const settled = await frame
  .locator('.frame-card')
  .evaluate((el) => el.style.getPropertyValue('--rx') + el.style.getPropertyValue('--ry'));
check('frame: settles when the cursor leaves', settled === '');

// Watermarks drift against the scroll.
const drift = await page.$eval('.rail-index', (el) => ({
  supports: CSS.supports('animation-timeline: view()'),
  timeline: getComputedStyle(el).animationTimeline,
  name: getComputedStyle(el).animationName,
}));
check(
  'watermark: drifts against the scroll',
  !drift.supports || (drift.timeline === 'view()' && drift.name === 'drift'),
  JSON.stringify(drift),
);

// Buttons lean toward the cursor.
const btn = page.locator('.btn').first();
await btn.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy({ top: -200, behavior: 'instant' }));
await sleep(300);
const bbox = await btn.evaluate((el) => el.getBoundingClientRect().toJSON());
await page.mouse.move(bbox.x + bbox.width * 0.9, bbox.y + bbox.height * 0.8);
await sleep(120);
const lean = await btn.evaluate((el) => el.style.translate);
check('button: leans toward the cursor', /px/.test(lean) && lean !== '0px 0px', lean);
await page.mouse.move(5, 5);
await sleep(120);
check(
  'button: settles when the cursor leaves',
  (await btn.evaluate((el) => el.style.translate)) === '',
);

// A theme change eases rather than snapping.
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await sleep(200);
await page.locator('#theme-toggle').click();
const easing = await page.evaluate(() =>
  document.documentElement.classList.contains('theme-transition'),
);
await sleep(600);
const eased = await page.evaluate(
  () => !document.documentElement.classList.contains('theme-transition'),
);
check('theme: change eases, then stops slowing the page', easing && eased, `${easing}/${eased}`);

// The ink field morphs between pages.
const heroField = await page.$eval('[style*="view-transition-name:field"]', (el) => el.tagName);
await page.goto(`${BASE}/about/`, { waitUntil: 'networkidle' });
const headerField = await page.$eval('[style*="view-transition-name:field"]', (el) => el.tagName);
check(
  'view transition: hero and page header share the field',
  heroField === 'SECTION' && headerField === 'SECTION',
);

await sleep(300);
const period = page.locator('#timeline .ledger-row').first();
await period.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy({ top: -120, behavior: 'instant' }));
await sleep(500);
const pRest = await period.evaluate((el) => getComputedStyle(el.querySelector('.row-index')).color);
await period.hover({ position: { x: 200, y: 60 } });
await sleep(500);
check(
  'about: the timeline period lights on hover',
  pRest !== (await period.evaluate((el) => getComputedStyle(el.querySelector('.row-index')).color)),
);

check('desktop: no errors', errors.length === 0, errors.join(' | '));
await ctx.close();

// ── 3. Reduced motion ───────────────────────────────────────────────────
{
  const calm = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await calm.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await sleep(150);
  const state = await page.evaluate(() => ({
    words: [...document.querySelectorAll('.hero-words .w')].map((e) => getComputedStyle(e).opacity),
    enter: [...document.querySelectorAll('.hero-enter')].map((e) => getComputedStyle(e).opacity),
    pending: document.querySelectorAll('.draw-pending, .reveal-pending').length,
  }));
  check(
    'reduced motion: hero words are there at once',
    state.words.every((o) => Number(o) === 1),
    state.words.join(','),
  );
  check(
    'reduced motion: surrounding text is there at once',
    state.enter.every((o) => Number(o) === 1),
    state.enter.join(','),
  );
  check(
    'reduced motion: nothing is held back for a reveal',
    state.pending === 0,
    `${state.pending}`,
  );
  const bbox = await page.$eval('.btn', (el) => el.getBoundingClientRect().toJSON());
  await page.mouse.move(bbox.x + bbox.width * 0.9, bbox.y + bbox.height * 0.8);
  await sleep(120);
  check(
    'reduced motion: buttons do not lean',
    (await page.$eval('.btn', (el) => el.style.translate)) === '',
  );
  await calm.close();
}

// ── 4. Mobile menu, reduced motion ──────────────────────────────────────
{
  const calm = await browser.newContext({
    viewport: { width: 390, height: 780 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  });
  const page = await calm.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await sleep(200);
  await page.click('#menu-toggle');
  await sleep(150);
  const open = await page.evaluate(() => {
    const menu = document.getElementById('mobile-menu');
    return {
      height: Math.round(menu.getBoundingClientRect().height),
      rows: [...menu.querySelectorAll('.menu-row')].map((r) => getComputedStyle(r).opacity),
    };
  });
  check(
    'reduced motion: menu opens at once, fully readable',
    open.height > 300 && open.rows.every((o) => Number(o) === 1),
    JSON.stringify(open),
  );
  await calm.close();
}

await browser.close();

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? '✓' : '✗'}  ${r.name}${r.info ? `  — ${r.info}` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (failed) process.exit(1);
