/**
 * Interaction suite: what only exists once a pointer, a key or a scroll is
 * involved. verify.mjs proves every page renders. What each block covers, and
 * the two rules learned writing it, are in docs/architecture.md, "Testing".
 *
 *   npm run build && npm run preview & npm run verify:interact
 */
import { BASE, DESKTOP, MOBILE, launch, results, scroll, scrollBy, sleep, visit } from './harness.mjs';

const { check, report } = results();
/** The word-by-word hero runs for about 1.4s; wait it out before measuring. */
const ENTRANCE = 2200;
const CALM = { reducedMotion: 'reduce' };

const browser = await launch();
const opacityOf = (els) => els.map((e) => Number(getComputedStyle(e).opacity));

// ── 1. Mobile menu ──────────────────────────────────────────────────────
{
  const { page, errors, close } = await visit(browser, '/', { ...MOBILE, watch: true });
  await sleep(ENTRANCE);
  await scroll(page, 600);
  await sleep(300);

  await page.click('#menu-toggle');
  await sleep(150);
  const mid = await page.$eval('#mobile-menu', (el) => el.getBoundingClientRect().height);
  await sleep(700);

  const open = await page.evaluate(() => {
    const menu = document.getElementById('mobile-menu');
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
      scrim: Number(getComputedStyle(document.getElementById('menu-scrim')).opacity),
      // What the page renders where the panel's last row is.
      atLastRow: document.elementFromPoint(60, box.bottom - 12)?.closest('#mobile-menu, #main')?.id,
    };
  });

  check(
    'menu: animates open rather than snapping',
    mid > 0 && mid < open.height,
    `${Math.round(mid)} -> ${open.height}`,
  );
  check('menu: opens below the header bar', open.top >= 48 && open.top <= 72, open);
  check('menu: tall enough for every row', open.height > 300, open);
  check('menu: no row spills outside the panel', open.rowsInside && open.rowsCount >= 5, open);
  check('menu: rows have arrived', open.rowsVisible);
  check('menu: panel is opaque', /^rgb\(\d+, \d+, \d+\)$/.test(open.background), open.background);
  check('menu: page under the last row is the panel, not the page', open.atLastRow === 'mobile-menu', open);
  check('menu: scrim veils the page', open.scrim === 1, open);

  /* A disclosure, so focus stays on the trigger and Tab walks in. */
  const tabbed = await page.evaluate(() => document.activeElement?.id);
  await page.keyboard.press('Tab');
  const inside = await page.evaluate(() => document.activeElement?.closest('#mobile-menu') !== null);
  check('menu: Tab walks from the trigger into the panel', tabbed === 'menu-toggle' && inside, `${tabbed}/${inside}`);

  /* And Tab does not escape past the last row while it is open. */
  const stops = await page.$$eval('#mobile-menu a, #mobile-menu button', (n) => n.length);
  for (let i = 0; i < stops; i++) await page.keyboard.press('Tab');
  const wrapped = await page.evaluate(
    () => document.activeElement?.closest('#mobile-menu') !== null || document.activeElement?.id === 'menu-toggle',
  );
  check('menu: Tab stays inside the open panel', wrapped, `stops=${stops}`);

  /* Clicked in-page, not through the harness: Playwright scrolls a sticky
     element into view first, which would be measured as the site's own jump. */
  await page.keyboard.press('Escape');
  await sleep(700);
  await scroll(page, 600);
  await sleep(300);
  const moved = await page.evaluate(async () => {
    const before = window.scrollY;
    document.getElementById('menu-toggle').click();
    await new Promise((r) => setTimeout(r, 800));
    return { before, after: window.scrollY };
  });
  check('menu: opening does not move the page', Math.abs(moved.after - moved.before) < 8, moved);

  // A tap outside closes it.
  await page.click('#menu-scrim', { position: { x: 200, y: 700 } });
  await sleep(700);
  const byScrim = await page.evaluate(() => ({
    hidden: document.getElementById('mobile-menu').hidden,
    scrim: Number(getComputedStyle(document.getElementById('menu-scrim')).opacity),
  }));
  check('menu: closes on a tap outside', byScrim.hidden && byScrim.scrim === 0, byScrim);

  // Escape closes it and hands focus back to the trigger.
  await page.click('#menu-toggle');
  await sleep(650);
  await page.keyboard.press('Escape');
  await sleep(650);
  const byEsc = await page.evaluate(() => ({
    hidden: document.getElementById('mobile-menu').hidden,
    focus: document.activeElement?.id,
  }));
  check('menu: Escape closes it and restores focus', byEsc.hidden && byEsc.focus === 'menu-toggle', byEsc);

  // A deliberate scroll closes it; the panel is a header dropdown, not a page.
  await page.click('#menu-toggle');
  await sleep(650);
  await scrollBy(page, 400);
  await sleep(700);
  check(
    'menu: closes on a deliberate scroll',
    await page.evaluate(() => document.getElementById('mobile-menu').hidden),
  );

  check('menu: no errors', errors.length === 0, errors.join(' | '));
  await close();
}

// ── 2. Desktop motion ───────────────────────────────────────────────────
const { page, errors, close } = await visit(browser, '/', { ...DESKTOP, watch: true });
await sleep(150);

const lastWord = () => page.$eval('.hero-words .w:last-child', (el) => Number(getComputedStyle(el).opacity));
const words = await page.locator('.hero-words .w').count();
check('hero: words present', words >= 9, `count=${words}`);
check('hero: last word starts hidden', (await lastWord()) < 1);
await sleep(ENTRANCE);
check('hero: last word ends visible', (await lastWord()) === 1);
const enter = await page.$$eval('.hero-enter', (els) => els.map((e) => Number(getComputedStyle(e).opacity)));
check(
  'hero: surrounding text follows the words in',
  enter.every((o) => o === 1),
  enter.join(','),
);

// Header compression and the reading hairline.
const barHeight = () => page.$eval('#site-header .header-bar', (el) => el.getBoundingClientRect().height);
const barTall = await barHeight();
await scroll(page, 400);
await sleep(500);
const barShort = await barHeight();
/* Two assertions, because the bug was the second one: the compression
   happened, and nothing below the header moved by it. */
const compressed = await page.evaluate(() => {
  const sub = getComputedStyle(document.querySelector('.wordmark-sub'));
  return {
    subMaxHeight: parseFloat(sub.maxHeight) || 0,
    subOpacity: Number(sub.opacity),
    scrolledAttr: document.getElementById('site-header').hasAttribute('data-scrolled'),
  };
});
check(
  'header: compresses on scroll',
  compressed.scrolledAttr && compressed.subMaxHeight === 0 && compressed.subOpacity === 0,
  compressed,
);
check(
  'header: compressing never changes the bar height',
  Math.abs(barShort - barTall) < 0.5,
  `${barTall} -> ${barShort}`,
);
const shifted = await page.evaluate(async () => {
  const first = document.querySelector('main > *');
  window.scrollTo({ top: 0, behavior: 'instant' });
  await new Promise((r) => setTimeout(r, 600));
  const top = first.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top: 400, behavior: 'instant' });
  await new Promise((r) => setTimeout(r, 600));
  return Math.round(first.getBoundingClientRect().top + window.scrollY - top);
});
check('header: compressing does not move the page', shifted === 0, `${shifted}px`);
const progress = await page.$eval('.scroll-progress', (el) => ({
  supports: CSS.supports('animation-timeline: scroll()'),
  timeline: getComputedStyle(el).animationTimeline,
  scale: new DOMMatrix(getComputedStyle(el).transform).a,
}));
check(
  'header: reading hairline tracks the scroll',
  !progress.supports || (progress.timeline.startsWith('scroll(') && progress.scale > 0 && progress.scale < 1),
  progress,
);
await scroll(page, 0);
await sleep(600);
check(
  'header: restores at the top',
  await page.evaluate(() => {
    const sub = getComputedStyle(document.querySelector('.wordmark-sub'));
    const header = document.getElementById('site-header');
    return !header.hasAttribute('data-scrolled') && Number(sub.opacity) === 1 && parseFloat(sub.maxHeight) > 0;
  }),
);

// The nav indicator sits under the current page and follows the pointer.
const indicatorX = () => page.$eval('.nav-indicator', (el) => el.style.getPropertyValue('--x'));
const navHome = await page.$eval('#primary-nav', (el) => el.hasAttribute('data-indicator'));
const restX = await indicatorX();
await page.locator('#primary-nav .nav-link').first().hover();
await sleep(500);
const hovered = await page.$eval('.nav-indicator', (el) => ({
  x: el.style.getPropertyValue('--x'),
  w: parseFloat(el.style.getPropertyValue('--w')),
  opacity: Number(getComputedStyle(el).opacity),
}));
check(
  'nav: indicator follows the hovered link',
  hovered.x !== restX && hovered.w > 0 && hovered.opacity === 1,
  `${restX} -> ${JSON.stringify(hovered)}`,
);
await page.mouse.move(700, 500);
await sleep(500);
check('nav: indicator returns to the current page', (await indicatorX()) === restX || !navHome);

/* On a page of its own: the animation is one-shot and unobserves itself, and
   the counter sits at exactly the observer's threshold at the scroll position
   the header check above uses. */
{
  const own = await visit(browser, '/', DESKTOP);
  await sleep(ENTRANCE);
  const count = await own.page.evaluate(async () => {
    const el = document.querySelector('[data-count]');
    const box = el.getBoundingClientRect();
    const initial = el.textContent.trim();
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 300));
    const mid = el.textContent.trim();
    await new Promise((r) => setTimeout(r, 1500));
    // wasBelowFold is proof it had not already run before the scroll.
    return { initial, mid, end: el.textContent.trim(), wasBelowFold: box.top >= window.innerHeight };
  });
  await own.close();
  check(
    'count-up: animates and lands on the real figure',
    count.wasBelowFold && count.mid !== count.end && count.end === count.initial,
    count,
  );
}

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
check('rule: draws in on arrival', draw.pending && draw.visible && draw.scale > 0.99, draw);

// Ledger rows under the pointer.
const readRow = (el) => ({
  index: getComputedStyle(el.querySelector('.row-index')).color,
  title: getComputedStyle(el.querySelector('.row-title')).transform,
  rule: new DOMMatrix(getComputedStyle(el, '::after').transform).a,
});
const row = page.locator('.ledger-row').first();
await row.scrollIntoViewIfNeeded();
await scrollBy(page, -100);
await sleep(400);
const rowRest = await row.evaluate(readRow);
await row.hover({ position: { x: 300, y: 40 } });
await sleep(700);
const rowHover = await row.evaluate(readRow);
check('row hover: index lights', rowRest.index !== rowHover.index, `${rowRest.index} -> ${rowHover.index}`);
check('row hover: title nudges', rowHover.title !== rowRest.title && rowHover.title !== 'none', rowHover.title);
check('row hover: underline draws', rowHover.rule > 0.99 && rowRest.rule < 0.01, `${rowRest.rule} -> ${rowHover.rule}`);
await page.mouse.move(5, 5);

// The ticker pauses so a word can be read.
const band = page.locator('.marquee-band').first();
const playState = () =>
  band
    .locator('.animate-marquee')
    .first()
    .evaluate((el) => getComputedStyle(el).animationPlayState);
await band.scrollIntoViewIfNeeded();
await sleep(300);
const tickerRunning = await playState();
await band.hover();
await sleep(120);
const tickerPaused = await playState();
check(
  'ticker: pauses under the pointer',
  tickerRunning === 'running' && tickerPaused === 'paused',
  `${tickerRunning} -> ${tickerPaused}`,
);
await page.mouse.move(5, 5);

// Preview frames tilt toward the cursor and settle when it leaves.
const card = page.locator('.group\\/frame').first().locator('.frame-card');
await card.scrollIntoViewIfNeeded();
await sleep(300);
const fbox = await card.evaluate((el) => el.getBoundingClientRect().toJSON());
await page.mouse.move(fbox.x + fbox.width * 0.9, fbox.y + fbox.height * 0.2);
await sleep(650);
const tilt = await card.evaluate((el) => ({
  rx: el.style.getPropertyValue('--rx'),
  ry: el.style.getPropertyValue('--ry'),
  lift: getComputedStyle(el).getPropertyValue('--lift').trim(),
}));
check('frame: tilts toward the cursor', Boolean(tilt.rx && tilt.ry), tilt);
check('frame: lifts on hover', tilt.lift === '-4px', tilt.lift);
await page.mouse.move(5, 5);
await sleep(150);
const settled = await card.evaluate((el) => el.style.getPropertyValue('--rx') + el.style.getPropertyValue('--ry'));
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
  drift,
);

// Buttons lean toward the cursor.
const btn = page.locator('.btn').first();
await btn.scrollIntoViewIfNeeded();
await scrollBy(page, -200);
await sleep(300);
const bbox = await btn.evaluate((el) => el.getBoundingClientRect().toJSON());
await page.mouse.move(bbox.x + bbox.width * 0.9, bbox.y + bbox.height * 0.8);
await sleep(120);
const lean = await btn.evaluate((el) => el.style.translate);
check('button: leans toward the cursor', /px/.test(lean) && lean !== '0px 0px', lean);
await page.mouse.move(5, 5);
await sleep(120);
check('button: settles when the cursor leaves', (await btn.evaluate((el) => el.style.translate)) === '');

// A theme change eases rather than snapping.
await scroll(page, 0);
await sleep(200);
await page.locator('#theme-toggle').click();
const easing = await page.evaluate(() => document.documentElement.classList.contains('theme-transition'));
await sleep(600);
const eased = await page.evaluate(() => !document.documentElement.classList.contains('theme-transition'));
check('theme: change eases, then stops slowing the page', easing && eased, `${easing}/${eased}`);

// The ink field morphs between pages.
const fieldTag = () => page.$eval('[style*="view-transition-name:field"]', (el) => el.tagName);
const heroField = await fieldTag();
await page.goto(`${BASE}/about/`, { waitUntil: 'networkidle' });
check(
  'view transition: hero and page header share the field',
  heroField === 'SECTION' && (await fieldTag()) === 'SECTION',
);

await sleep(300);
const period = page.locator('#timeline .ledger-row').first();
const periodColour = () => period.evaluate((el) => getComputedStyle(el.querySelector('.row-index')).color);
await period.scrollIntoViewIfNeeded();
await scrollBy(page, -120);
await sleep(500);
const pRest = await periodColour();
await period.hover({ position: { x: 200, y: 60 } });
await sleep(500);
check('about: the timeline period lights on hover', pRest !== (await periodColour()));

check('desktop: no errors', errors.length === 0, errors.join(' | '));
await close();

// ── 3. Reduced motion ───────────────────────────────────────────────────
{
  const { page, close } = await visit(browser, '/', { ...DESKTOP, ...CALM });
  await sleep(150);
  const state = await page.evaluate(() => {
    const opacity = (sel) => [...document.querySelectorAll(sel)].map((e) => Number(getComputedStyle(e).opacity));
    return {
      words: opacity('.hero-words .w'),
      enter: opacity('.hero-enter'),
      pending: document.querySelectorAll('.draw-pending, .reveal-pending').length,
    };
  });
  check(
    'reduced motion: hero words are there at once',
    state.words.every((o) => o === 1),
    state.words.join(','),
  );
  check(
    'reduced motion: surrounding text is there at once',
    state.enter.every((o) => o === 1),
    state.enter.join(','),
  );
  check('reduced motion: nothing is held back for a reveal', state.pending === 0, `${state.pending}`);

  const bbox = await page.$eval('.btn', (el) => el.getBoundingClientRect().toJSON());
  await page.mouse.move(bbox.x + bbox.width * 0.9, bbox.y + bbox.height * 0.8);
  await sleep(120);
  check('reduced motion: buttons do not lean', (await page.$eval('.btn', (el) => el.style.translate)) === '');
  await close();
}

// ── 4. Mobile menu, reduced motion ──────────────────────────────────────
{
  const { page, close } = await visit(browser, '/', { ...MOBILE, ...CALM });
  await sleep(200);
  await page.click('#menu-toggle');
  await sleep(150);
  const open = await page.evaluate(() => {
    const menu = document.getElementById('mobile-menu');
    return {
      height: Math.round(menu.getBoundingClientRect().height),
      rows: [...menu.querySelectorAll('.menu-row')].map((r) => Number(getComputedStyle(r).opacity)),
    };
  });
  check(
    'reduced motion: menu opens at once, fully readable',
    open.height > 300 && open.rows.every((o) => o === 1),
    open,
  );
  await close();
}

// ── 5. Now-playing poll cadence ─────────────────────────────────────────
/* The intervals themselves are asserted exactly in tests/schedule.test.mjs,
   which needs no browser. What is left for one is that the page is actually
   wired to them, and the two things a pure function cannot know about: a tab
   nobody is looking at, and coming back to one. */
{
  const hits = [];
  const stub = (route) => {
    hits.push(Date.now());
    return route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      // 5s while playing, 1s of it already spent at the edge.
      headers: { 'Cache-Control': 'public, max-age=5, s-maxage=5', Age: '1' },
      body: JSON.stringify({
        playing: true,
        state: 'playing',
        title: 'Yèkèrmo Sèw',
        artist: 'Mulatu Astatke',
        progressMs: 30000,
        durationMs: 300000,
        fetchedAt: Date.now(),
      }),
    });
  };
  // The card, and so the poll, lives on /now.
  const { page, close } = await visit(browser, '/now/', { ...DESKTOP, route: stub });

  const visibility = (hidden) =>
    page.evaluate((h) => {
      for (const [prop, value] of [
        ['hidden', h],
        ['visibilityState', h ? 'hidden' : 'visible'],
      ]) {
        Object.defineProperty(document, prop, { configurable: true, get: () => value });
      }
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);

  hits.length = 0;
  await sleep(13000);
  const gaps = hits.slice(1).map((t, i) => t - hits[i]);
  check(
    'poll: the page follows the freshness the response advertises',
    gaps.length >= 2 && gaps.every((g) => g > 3600 && g < 6200),
    { count: hits.length, gaps },
  );

  // A tab nobody is looking at makes no requests at all.
  await visibility(true);
  hits.length = 0;
  await sleep(9000);
  check('poll: a hidden tab does not poll', hits.length === 0, `${hits.length} request(s)`);

  // Coming back asks immediately rather than waiting out the interval.
  await visibility(false);
  await sleep(700);
  check('poll: returning to the tab asks at once', hits.length >= 1, `${hits.length} request(s)`);
  await close();
}

// ── 6. Now-playing skeleton ─────────────────────────────────────────────
/* The card holds its own shape first, the swap costs no layout shift, and no
   skeleton is left standing where no answer is coming. */
{
  const track = {
    playing: true,
    state: 'playing',
    title: 'Yèkèrmo Sèw',
    artist: 'Mulatu Astatke',
    album: 'Mulatu of Ethiopia',
    progressMs: 42000,
    durationMs: 300000,
  };
  const ok = (body) => ({
    status: 200,
    contentType: 'application/json',
    headers: { 'Cache-Control': 'public, max-age=5, s-maxage=5', Age: '1' },
    body: JSON.stringify({ ...body, fetchedAt: Date.now() }),
  });

  /** Loads /now with the endpoint held open, so the loading state can be read. */
  const withGate = async (answer, opts = DESKTOP) => {
    let release;
    const gate = new Promise((r) => (release = r));
    const session = await visit(browser, '/now/', {
      ...opts,
      wait: 'commit',
      // Layout shift is observed from the very first frame, before the answer.
      init: () => {
        window.__cls = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      },
      route: async (route) => {
        await gate;
        await route.fulfill(answer);
      },
    });
    await sleep(1500);
    return { ...session, release };
  };

  const read = (page) =>
    page.evaluate(() => {
      const card = document.getElementById('now-playing');
      const link = document.getElementById('np-link');
      return {
        state: card.dataset.state,
        hidden: card.hidden,
        height: Math.round(card.getBoundingClientRect().height),
        busy: card.getAttribute('aria-busy'),
        linkAriaHidden: link.getAttribute('aria-hidden'),
        linkTabindex: link.getAttribute('tabindex'),
        // The sleeve's placeholder is excluded: it is retired by the image
        // loading, not by the state changing.
        bars: document.querySelectorAll('#now-playing .sk:not(.sk-art)').length,
        title: document.getElementById('np-title').textContent.trim(),
        cls: +window.__cls.toFixed(4),
      };
    });

  // A track: the common case, and the one the geometry is tuned against.
  {
    const { page, release, close } = await withGate(ok(track));
    const loading = await read(page);
    check(
      'skeleton: the card is on screen before the answer is',
      loading.state === 'loading' && !loading.hidden && loading.height > 200 && loading.bars >= 5,
      loading,
    );
    check(
      'skeleton: the card is marked busy and is not a link yet',
      loading.busy === 'true' && loading.linkAriaHidden === 'true' && loading.linkTabindex === '-1',
      loading,
    );
    release();
    await sleep(1200);
    const ready = await read(page);
    check(
      'skeleton: the real content replaces it',
      ready.state === 'ready' && ready.title === track.title && ready.bars === 0,
      ready,
    );
    check(
      'skeleton: the swap does not move the page',
      ready.height === loading.height && ready.cls - loading.cls < 0.002,
      `height ${loading.height} -> ${ready.height}, CLS +${(ready.cls - loading.cls).toFixed(4)}`,
    );
    check(
      'skeleton: the link and the busy flag are handed back',
      ready.busy === null && ready.linkAriaHidden === null && ready.linkTabindex === null,
      ready,
    );
    await close();
  }

  /* The rest differ only in what the endpoint says and what the card should
     look like once it has: a phone (where the title is the shift risk), an
     answer with no track, and reduced motion. */
  for (const [what, answer, opts, expect] of [
    [
      'no shift on a phone either',
      ok(track),
      MOBILE,
      (loading, ready) => [ready.state === 'ready' && Math.abs(ready.height - loading.height) <= 1, ready],
    ],
    [
      'an answer with no track hides the card',
      ok({ playing: false }),
      DESKTOP,
      (loading, ready) => [
        loading.state === 'loading' && ready.state === 'empty' && ready.hidden === true && ready.busy === null,
        ready,
      ],
    ],
  ]) {
    const { page, release, close } = await withGate(answer, opts);
    const loading = await read(page);
    release();
    await sleep(1200);
    const [ok_, detail] = expect(loading, await read(page));
    check(`skeleton: ${what}`, ok_, detail);
    await close();
  }

  /* Nothing is coming: neither a rejected request nor a page without script
     may leave a skeleton pulsing at a promise it cannot keep. They differ in
     how the card ends up hidden — one is the script giving up, the other is
     the markup never having promised anything. */
  for (const [what, opts, wants] of [
    [
      'a failing endpoint hides the card rather than pulsing at it',
      { route: (r) => r.fulfill({ status: 503, body: 'no' }) },
      (card) => card.hidden && card.state === 'empty',
    ],
    ['no script means no skeleton', { javaScriptEnabled: false, wait: 'load' }, (card) => card.hidden],
  ]) {
    const { page, close } = await visit(browser, '/now/', { ...DESKTOP, ...opts });
    await sleep(1200);
    const card = await page.evaluate(() => {
      const el = document.getElementById('now-playing');
      return { hidden: el.hidden, state: el.dataset.state };
    });
    check(`skeleton: ${what}`, wants(card), card);
    await close();
  }

  // Reduced motion: a placeholder that cannot pulse must still be a plain bar,
  // not one frozen half-faded.
  {
    const { page, release, close } = await withGate(ok(track), { ...DESKTOP, ...CALM });
    const opacities = await page.$$eval('#now-playing .sk', opacityOf);
    check(
      'skeleton: under reduced motion the bars rest at full opacity',
      opacities.length > 0 && opacities.every((o) => o === 1),
      opacities.join(','),
    );
    release();
    await close();
  }
}

await browser.close();
report();
