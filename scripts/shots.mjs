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
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';

const CONTENT = 'src/content/projects';
const OUT = 'src/assets/previews';

/** Wide enough to look like a desktop, 16:10 to match the frame's aspect. */
const VIEWPORT = { width: 1440, height: 900 };
/** Retina capture, downscaled on save: text stays crisp, the file stays small. */
const SCALE = 2;
const OUT_WIDTH = 1600;

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
    out.push({ id: file.replace(/\.md$/, ''), demo, title: field(source, 'title') });
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

const browser = await chromium.launch({
  // Honour a preinstalled browser when one is provided, as tests/verify.mjs does.
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: SCALE,
  // Screenshots are for a light-background page; ask for the light theme so a
  // site that honours the preference does not come back inverted.
  colorScheme: 'light',
  reducedMotion: 'reduce',
});

let failed = 0;

for (const project of wanted) {
  const page = await context.newPage();
  const target = path.join(OUT, `${project.id}.webp`);
  try {
    const response = await page.goto(project.demo, {
      waitUntil: 'networkidle',
      timeout: 45000,
    });
    const status = response?.status() ?? 0;
    if (status >= 400) throw new Error(`HTTP ${status}`);

    await page.waitForTimeout(SETTLE_MS);
    const shot = await page.screenshot({ type: 'png' });

    const out = await sharp(shot)
      .resize({ width: OUT_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    await writeFile(target, out);

    const kb = (out.length / 1024).toFixed(0);
    console.log(`ok    ${project.id.padEnd(22)} ${project.demo}  ->  ${target} (${kb} kB)`);
  } catch (error) {
    failed += 1;
    console.error(
      `FAIL  ${project.id.padEnd(22)} ${project.demo}  ${error.message.split('\n')[0]}`,
    );
  } finally {
    await page.close();
  }
}

await browser.close();

// A non-zero exit so CI does not quietly commit a partial set.
if (failed > 0) {
  console.error(`\n${failed} of ${wanted.length} failed. Existing screenshots were left alone.`);
  process.exit(1);
}
console.log(`\n${wanted.length} captured.`);
