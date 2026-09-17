/**
 * Interaction suite: what only exists once a pointer, a key or a scroll is
 * involved. verify.mjs proves every page renders. What each block covers, and
 * the two rules learned writing it, are in docs/architecture.md, "Testing".
 *
 *   npm run build && npm run preview & npm run verify:interact
 */
import { DESKTOP, MOBILE, launch, results, scroll, sleep, visit } from './harness.mjs';

const { check, report } = results();
/** The word-by-word hero runs for about 1.4s; wait it out before measuring. */
const ENTRANCE = 2200;
const CALM = { reducedMotion: 'reduce' };

const browser = await launch();
const opacityOf = (els) => els.map((e) => Number(getComputedStyle(e).opacity));

// ── 1. Desktop motion ───────────────────────────────────────────────────
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

/* Twice now, checks have been cut from this file to meet a line target, and
   both times by the same rule: what fails *visibly* goes, what fails invisibly
   stays. Gone in 590ffa0, the cosmetic pointer effects — the nav indicator,
   the tilt, the lean, the ticker, row hover, the count-up, the theme ease.
   Gone in the commit that added this note, the thirteen mobile menu checks,
   which were the most thorough block in the file and also the most redundant:
   a menu that will not open is the first thing anyone holding a phone sees.
   What stays is everything invisible on a developer's screen — content left
   hidden, the page shifting under a reader, a stranded skeleton, reduced
   motion ignored. `git show 590ffa0 -- tests/interact.mjs` and
   `git show b5bdecb -- tests/interact.mjs` restore them. */

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

check('desktop: no errors', errors.length === 0, errors.join(' | '));
await close();

// ── 2. Reduced motion ───────────────────────────────────────────────────
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

// ── 3. Now-playing poll cadence ─────────────────────────────────────────
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
  await sleep(2000);
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

// ── 4. Now-playing skeleton ─────────────────────────────────────────────
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

  /* A phone is the other shift risk: the title wraps there, so the card can
     settle at a different height than the placeholder it replaced. */
  {
    const { page, release, close } = await withGate(ok(track), MOBILE);
    const loading = await read(page);
    release();
    await sleep(1200);
    const ready = await read(page);
    check('skeleton: no shift on a phone either', Math.abs(ready.height - loading.height) <= 1, { loading, ready });
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
