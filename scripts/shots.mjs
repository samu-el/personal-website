/**
 * Screenshots each project in light and dark into src/assets/previews:
 * <id>.webp (light) and <id>-dark.webp (dark), so the site can show the one
 * that matches its own theme.
 *
 *   npm run shots            # every project with a demo URL
 *   npm run shots jeopardy   # just these ids
 *   SHOTS_ORIGIN=http://localhost:3000 npm run shots fantasy-pl
 *                            # one project, from a local run of its build
 *
 * Run deliberately, not at build time; previews.yml runs it on a GitHub
 * runner. Nothing is written unless every capture of a project succeeds, so a
 * failure leaves its previous screenshots alone. docs/architecture.md,
 * "Screenshots".
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { collection } from './frontmatter.mjs';
import sharp from 'sharp';
import { chromium } from 'playwright';

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
/** A theme switch is a re-render, not a load, and some apps ease their colours. */
const THEME_SETTLE_MS = 1200;

/** Both, light first. A seed that exports `themes` narrows this. */
const THEMES = ['light', 'dark'];
const fileFor = (id, theme) => path.join(OUT, theme === 'dark' ? `${id}-dark.webp` : `${id}.webp`);

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

/* A build that is not deployed yet: point one project at a local run of it.
   One id only, so a local origin can never stand in for every project. */
const origin = process.env.SHOTS_ORIGIN;
if (origin) {
  if (wanted.length !== 1) {
    console.error('SHOTS_ORIGIN takes exactly one project id.');
    process.exit(1);
  }
  wanted[0].demo = new URL(origin).origin;
}

await mkdir(OUT, { recursive: true });

/** Launched on first use, so a run that skips everything needs no browser. */
let browser;
async function browserFor() {
  browser ??= await chromium.launch({
    // Honour a preinstalled browser when one is provided, as tests/verify.mjs does.
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  return browser;
}

/** Contexts are per device and made on demand, then reused. The colour
 *  scheme is set per page, so one context serves both themes. */
const contexts = new Map();
async function contextFor(device) {
  const existing = contexts.get(device);
  if (existing) return existing;
  const browser = await browserFor();
  const context = await browser.newContext({
    viewport: DEVICES[device].viewport,
    deviceScaleFactor: SCALE,
    reducedMotion: 'reduce',
    isMobile: device === 'phone',
    hasTouch: device === 'phone',
  });
  contexts.set(device, context);
  return context;
}

/**
 * scripts/seeds/<id>.mjs may export `prepare(page, project)` (run before
 * navigation, handed the project so it can reach the same origin), `path`,
 * `themes` (the looks the product has, when that is not both) and `localOnly`
 * (why the live site cannot be captured, so only a SHOTS_ORIGIN run takes it).
 */
async function seedFor(id) {
  const file = new URL(`./seeds/${id}.mjs`, import.meta.url);
  if (!existsSync(file)) return undefined;
  return import(file.href);
}

/**
 * One page, one state, every theme: the app follows `prefers-color-scheme`,
 * so switching the emulated scheme re-themes what is already on screen and the
 * pair differs in nothing but colour. An app that only reads the scheme at
 * launch is reloaded instead.
 *
 * @returns {Promise<{ shots: Map<string, Buffer>, from: string, how: string }>}
 */
async function capture(project, seed, themes) {
  const context = await contextFor(project.device);
  const page = await context.newPage();
  try {
    await page.emulateMedia({ colorScheme: themes[0] });
    if (seed?.prepare) await seed.prepare(page, project);
    const url = new URL(seed?.path ?? '/', project.demo).toString();
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    const status = response?.status() ?? 0;
    if (status >= 400) throw new Error(`HTTP ${status}`);
    await page.waitForTimeout(SETTLE_MS);

    const shots = new Map();
    for (const theme of themes) {
      if (theme !== themes[0]) {
        await page.emulateMedia({ colorScheme: theme });
        await page.waitForTimeout(THEME_SETTLE_MS);
        // Some apps read the scheme once, at launch (Monee's web build). The
        // state they keep in storage survives a reload, so reload them.
        if ((await page.screenshot({ type: 'png' })).equals(shots.get(themes[0]))) {
          await page.reload({ waitUntil: 'networkidle', timeout: 45000 });
          await page.waitForTimeout(SETTLE_MS);
        }
      }
      shots.set(theme, await page.screenshot({ type: 'png' }));
    }
    // A site that ignores the scheme would ship the same picture twice under
    // two names; say so, and let its seed declare the one look it has.
    if (themes.length > 1 && shots.get(themes[0]).equals(shots.get(themes[1]))) {
      throw new Error('light and dark came out identical; export `themes` from its seed');
    }
    return { shots, from: url, how: `${project.device}${seed ? ', seeded' : ''}` };
  } finally {
    await page.close();
  }
}

let failed = 0;
let skipped = 0;

for (const project of wanted) {
  try {
    const seed = await seedFor(project.id);
    if (seed?.localOnly && !origin) {
      skipped += 1;
      console.log(`skip  ${project.id.padEnd(22)} ${seed.localOnly}; needs SHOTS_ORIGIN`);
      continue;
    }
    const themes = seed?.themes ?? THEMES;
    const { shots, from, how } = await capture(project, seed, themes);

    const files = [];
    for (const [theme, bytes] of shots) {
      const out = await sharp(bytes)
        .resize({ width: DEVICES[project.device].outWidth, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      // One look: written as <id>.webp, which the site shows in both themes.
      const target = themes.length === 1 ? fileFor(project.id, 'light') : fileFor(project.id, theme);
      await writeFile(target, out);
      files.push(`${path.basename(target)} ${(out.length / 1024).toFixed(0)} kB`);
    }
    // A dark capture left from when it had two looks would outlive the change.
    if (themes.length === 1) await rm(fileFor(project.id, 'dark'), { force: true });

    console.log(`ok    ${project.id.padEnd(22)} ${from}  ->  ${files.join(', ')} (${how}, ${themes.join('+')})`);
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
console.log(`\n${wanted.length - skipped} captured${skipped ? `, ${skipped} skipped` : ''}.`);
