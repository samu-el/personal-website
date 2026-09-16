/**
 * What both browser suites need before they can assert anything: a browser,
 * a base URL, the egress proxy, viewport presets, and a way to report.
 *
 * Node's global fetch ignores HTTPS_PROXY, so checking a deployed site from
 * behind one fails with a 403 from the proxy rather than a real response.
 * Routing fetch through it and handing the browser the same proxy is the only
 * setup either suite needs, and it was written twice.
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
export const launch = () =>
  chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, proxy });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The two shapes every check is run at, plus the options each implies. */
export const DESKTOP = { viewport: { width: 1440, height: 900 } };
export const MOBILE = { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true };

/**
 * Collects pass/fail lines and prints them at the end.
 *
 * `check(name, ok, info)` records one; `report()` prints the lot and sets a
 * non-zero exit code if any failed.
 */
export function results() {
  const all = [];
  return {
    check: (name, ok, info = '') => all.push({ name, ok: Boolean(ok), info }),
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

/**
 * The smoke suite's shape instead: a flat list of problems, deduped, with
 * silence meaning success.
 */
export function issues() {
  const all = [];
  return {
    push: (...msgs) => all.push(...msgs),
    get length() {
      return all.length;
    },
    report() {
      console.log(
        all.length
          ? `${all.length} ISSUE(S):\n` + [...new Set(all)].join('\n')
          : '✓ All checks passed.',
      );
      if (all.length) process.exitCode = 1;
    },
  };
}
