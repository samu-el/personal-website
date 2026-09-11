/**
 * Screenshots each project's live site into src/assets/previews/<id>.webp,
 * which is where ProjectShowcase.astro looks for them.
 *
 *   npm run shots            # every project with a demo URL
 *   npm run shots jeopardy   # just these ids
 *
 * Needs a Chromium and network access to the sites themselves. Neither is
 * available everywhere — a sandbox that reaches the Spotify and GitHub APIs
 * over its proxy may still refuse a browser connection to an arbitrary host,
 * which is why this is a script you run deliberately rather than a build step.
 * .github/workflows/previews.yml runs it on a GitHub runner for that reason.
 *
 * Writes nothing unless a capture succeeds, so a failure leaves the previous
 * screenshot in place rather than replacing it with a blank page.
 */
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';

// Node's global fetch ignores HTTPS_PROXY, so a project that publishes its own
// screenshot could not be read from behind an egress proxy. Same treatment as
// tests/verify.mjs.
if (process.env.HTTPS_PROXY || process.env.https_proxy) {
  setGlobalDispatcher(new EnvHttpProxyAgent());
}

const CONTENT = 'src/content/projects';
const OUT = 'src/assets/previews';

/**
 * Per device, matching the frame the showcase draws around the result.
 *
 * `phone` exists because not every project is a website. Monee's own
 * app.config.ts calls its web build "a phone-shaped preview, not a responsive
 * target", and a 1440-wide capture of it is a narrow column of app in a field
 * of empty background.
 */
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, outWidth: 1600 },
  phone: { viewport: { width: 440, height: 936 }, outWidth: 880 },
};
/** Retina capture, downscaled on save: text stays crisp, the file stays small. */
const SCALE = 2;

/**
 * How long to let a site settle after load. These are client-rendered apps;
 * `networkidle` fires before React has painted anything worth looking at.
 */
const SETTLE_MS = 2500;

/**
 * Frontmatter is read with a narrow line matcher rather than a YAML parser.
 * The two fields needed here are plain scalars, and this keeps the script free
 * of the Astro runtime — it has to work without a build.
 */
function field(source, name) {
  const line = source.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'));
  if (!line) return undefined;
  return line[1].trim().replace(/^['"]|['"]$/g, '');
}

async function projects() {
  const files = (await readdir(CONTENT)).filter((f) => f.endsWith('.md'));
  const out = [];
  for (const file of files) {
    const source = await readFile(path.join(CONTENT, file), 'utf8');
    const demo = field(source, 'demo');
    // Hidden projects have no card to put a screenshot on, and a project
    // without a demo URL has nothing to photograph.
    if (!demo || field(source, 'hidden') === 'true') continue;
    const device = field(source, 'device') ?? 'desktop';
    if (!DEVICES[device]) throw new Error(`${file}: unknown device "${device}"`);
    out.push({ id: file.replace(/\.md$/, ''), demo, device, title: field(source, 'title') });
  }
  return out;
}

const only = process.argv.slice(2);

const wanted = (await projects()).filter((p) => only.length === 0 || only.includes(p.id));
if (wanted.length === 0) {
  console.error(
    only.length ? `No project matched: ${only.join(', ')}` : 'No projects with a demo.',
  );
  process.exit(1);
}

await mkdir(OUT, { recursive: true });

/**
 * Launched on first use, not up front: a project that publishes its own
 * screenshot needs no browser at all, and `npm run shots monee` should not
 * require one to be installed.
 */
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
    // Screenshots are for a light-background page; ask for the light theme so
    // a site that honours the preference does not come back inverted. A site
    // that is dark by design stays dark, which is its own look.
    colorScheme: 'light',
    reducedMotion: 'reduce',
    isMobile: device === 'phone',
    hasTouch: device === 'phone',
  });
  contexts.set(device, context);
  return context;
}

/**
 * A project may ship scripts/seeds/<id>.mjs to change how it is captured:
 *
 *   image        a published screenshot to use instead of photographing a
 *                page — for an app that ships its own, or one this script
 *                cannot reach
 *   prepare(page)  runs before navigation, to put the app in a state worth
 *                  photographing — an empty first-run screen is a true
 *                  picture of nothing
 *   path         where to land, if not the site root
 */
async function seedFor(id) {
  const file = new URL(`./seeds/${id}.mjs`, import.meta.url);
  if (!existsSync(file)) return undefined;
  return import(file.href);
}

/**
 * The PNG bytes to save for a project, and a word for the log about where
 * they came from.
 *
 * @returns {Promise<{ bytes: Buffer, from: string, how: string }>}
 */
async function capture(project, seed) {
  // A project that publishes its own screenshot: take it at the source. It is
  // the product's own picture of itself, it stays current as they replace it,
  // and it does not depend on the app being reachable without an account.
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
    console.error(
      `FAIL  ${project.id.padEnd(22)} ${project.demo}  ${error.message.split('\n')[0]}`,
    );
  }
}

await browser?.close();

// A non-zero exit so CI does not quietly commit a partial set.
if (failed > 0) {
  console.error(`\n${failed} of ${wanted.length} failed. Existing screenshots were left alone.`);
  process.exit(1);
}
console.log(`\n${wanted.length} captured.`);
