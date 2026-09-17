/**
 * What both browser suites need: a browser, a base URL, the egress proxy,
 * viewport presets, a page to drive and a way to report. Node's global fetch
 * ignores HTTPS_PROXY, so a deployed site checked from behind one answers 403
 * from the proxy rather than anything real — hence the dispatcher below.
 */
import { chromium } from 'playwright';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';

export const ORIGIN = process.env.BASE_URL ?? 'http://localhost:4321';
export const BASE_PATH = process.env.BASE_PATH ?? '';
export const BASE = `${ORIGIN}${BASE_PATH}`;

const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || '';
if (PROXY) setGlobalDispatcher(new EnvHttpProxyAgent());
const proxy = PROXY
  ? { server: PROXY, bypass: (process.env.NO_PROXY || 'localhost,127.0.0.1').split(',').join(',') }
  : undefined;

/** Honours a preinstalled browser where one is provided (CI images, sandboxes). */
export const launch = () => chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, proxy });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A context and a page on it; `close()` disposes it. Every block starts here. */
export async function visit(browser, at, { wait = 'networkidle', watch = false, route, init, ...opts } = {}) {
  const ctx = await browser.newContext(opts);
  if (route) await ctx.route('**/api/now-playing.json*', route);
  const page = await ctx.newPage();
  if (init) await page.addInitScript(init);
  const errors = [];
  if (watch) {
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  }
  await page.goto(`${BASE}${at}`, { waitUntil: wait });
  return { ctx, page, errors, close: () => ctx.close() };
}

/** Jump the page without smooth scrolling, which would race every assertion. */
export const scroll = (page, top) => page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);

/** The two shapes every check is run at, plus the options each implies. */
export const DESKTOP = { viewport: { width: 1440, height: 900 } };
export const MOBILE = { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true };

/** `check(name, ok, info)` records one; `report()` prints the lot and exits. */
export function results() {
  const all = [];
  return {
    /** `info` may be an object; it is stringified, so a probe can be passed whole. */
    check: (name, ok, info = '') =>
      all.push({ name, ok: Boolean(ok), info: typeof info === 'object' ? JSON.stringify(info) : info }),
    report() {
      const failed = all.filter((r) => !r.ok).length;
      for (const r of all) {
        console.log(`${r.ok ? '✓' : '✗'}  ${r.name}${r.info ? `  — ${r.info}` : ''}`);
      }
      console.log(`\n${all.length - failed}/${all.length} checks passed`);
      if (failed) process.exit(1);
    },
  };
}

/** The smoke suite's shape: a deduped list of problems, silence meaning pass. */
export function issues() {
  const all = [];
  return {
    push: (...msgs) => all.push(...msgs),
    get length() {
      return all.length;
    },
    report() {
      console.log(all.length ? `${all.length} ISSUE(S):\n` + [...new Set(all)].join('\n') : '✓ All checks passed.');
      if (all.length) process.exitCode = 1;
    },
  };
}
