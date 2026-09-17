/**
 * Screenshots each project's live site into src/assets/previews/<id>.webp.
 *
 *   npm run shots            # every project with a demo URL
 *   npm run shots jeopardy   # just these ids
 *
 * Run deliberately, not at build time; previews.yml runs it on a GitHub
 * runner. Nothing is written unless a capture succeeds, so a failure leaves
 * the previous screenshot alone. docs/architecture.md, "Screenshots".
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { collection } from './frontmatter.mjs';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';

// Node's global fetch ignores HTTPS_PROXY, as in tests/harness.mjs.
if (process.env.HTTPS_PROXY || process.env.https_proxy) {
  setGlobalDispatcher(new EnvHttpProxyAgent());
}

const OUT = 'src/assets/previews';

/** Per device, matching the frame the showcase draws around the result. */
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, outWidth: 1600 },
  phone: { viewport: { width: 440, height: 936 }, outWidth: 880 },
};
/** Retina capture, downscaled on save: text stays crisp, the file stays small. */
const SCALE = 2;

/** These are client-rendered apps; `networkidle` fires before React paints. */
const SETTLE_MS = 2500;

/** Hidden projects have no card to put a screenshot on, and a project with no
 *  demo URL has nothing to photograph. */
function projects() {
  return collection('projects')
    .filter((p) => p.demo && !p.hidden)
    .map(({ slug, demo, device, title }) => {
      if (!DEVICES[device]) throw new Error(`${slug}: unknown device "${device}"`);
      return { id: slug, demo, device, title };
    });
}

const only = process.argv.slice(2);

const wanted = projects().filter((p) => only.length === 0 || only.includes(p.id));
if (wanted.length === 0) {
  console.error(only.length ? `No project matched: ${only.join(', ')}` : 'No projects with a demo.');
  process.exit(1);
}

await mkdir(OUT, { recursive: true });

/** Launched on first use: a published screenshot needs no browser at all. */
let browser;
async function browserFor() {
  browser ??= await chromium.launch({
    // Honour a preinstalled browser when one is provided, as tests/verify.mjs does.
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  return browser;
}

/** Contexts are per device and made on demand, then reused. */
const contexts = new Map();
async function contextFor(device) {
  const existing = contexts.get(device);
  if (existing) return existing;
  const browser = await browserFor();
  const context = await browser.newContext({
    viewport: DEVICES[device].viewport,
    deviceScaleFactor: SCALE,
    // These sit on a light page, so ask for light; a site that is dark by
    // design stays dark, which is its own look.
    colorScheme: 'light',
    reducedMotion: 'reduce',
    isMobile: device === 'phone',
    hasTouch: device === 'phone',
  });
  contexts.set(device, context);
  return context;
}

/**
 * scripts/seeds/<id>.mjs may export `image` (a published screenshot to use
 * instead), `prepare(page)` (run before navigation) and `path`.
 */
async function seedFor(id) {
  const file = new URL(`./seeds/${id}.mjs`, import.meta.url);
  if (!existsSync(file)) return undefined;
  return import(file.href);
}

/** @returns {Promise<{ bytes: Buffer, from: string, how: string }>} */
async function capture(project, seed) {
  // The product's own picture of itself: current, and needs no account.
  if (seed?.image) {
    const url = new URL(seed.image, project.demo).toString();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      from: url,
      how: `${project.device}, published`,
    };
  }

  const context = await contextFor(project.device);
  const page = await context.newPage();
  try {
    if (seed?.prepare) await seed.prepare(page);

    const url = new URL(seed?.path ?? '/', project.demo).toString();
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    const status = response?.status() ?? 0;
    if (status >= 400) throw new Error(`HTTP ${status}`);

    await page.waitForTimeout(SETTLE_MS);
    return {
      bytes: await page.screenshot({ type: 'png' }),
      from: url,
      how: `${project.device}${seed ? ', seeded' : ''}`,
    };
  } finally {
    await page.close();
  }
}

let failed = 0;

for (const project of wanted) {
  const target = path.join(OUT, `${project.id}.webp`);
  try {
    const seed = await seedFor(project.id);
    const { bytes, from, how } = await capture(project, seed);

    const out = await sharp(bytes)
      .resize({ width: DEVICES[project.device].outWidth, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    await writeFile(target, out);

    const kb = (out.length / 1024).toFixed(0);
    console.log(`ok    ${project.id.padEnd(22)} ${from}  ->  ${target} (${kb} kB, ${how})`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${project.id.padEnd(22)} ${project.demo}  ${error.message.split('\n')[0]}`);
  }
}

await browser?.close();

// A non-zero exit so CI does not quietly commit a partial set.
if (failed > 0) {
  console.error(`\n${failed} of ${wanted.length} failed. Existing screenshots were left alone.`);
  process.exit(1);
}
console.log(`\n${wanted.length} captured.`);
