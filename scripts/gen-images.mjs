/**
 * Renders the social card and app icons: `npm run images`. Chromium rather
 * than an SVG rasteriser, so the output uses the site's own webfonts. Set
 * CHROMIUM_PATH when a browser is already installed.
 */
import { mkdir, readFile, rm } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'public');
const asset = (p) => pathToFileURL(resolve(root, 'scripts/assets', p)).href;
const out = (p) => resolve(publicDir, p);

await mkdir(publicDir, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

/** The card is standalone HTML, so the address is read out of site.ts here
 *  rather than kept as a second copy that goes stale. */
const siteTs = await readFile(resolve(root, 'src/lib/site.ts'), 'utf8');
const email = siteTs.match(/email:\s*'([^']+)'/)?.[1];
if (!email) throw new Error('could not read site.email from src/lib/site.ts');

async function shoot(template, width, height, target, variants = []) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(asset(template), { waitUntil: 'load' });
  await page.evaluate((value) => {
    const el = document.getElementById('email');
    if (el) el.textContent = value;
  }, email);
  await page.evaluate((names) => document.body.classList.add(...names), variants);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await mkdir(dirname(target), { recursive: true });
  await page.screenshot({ path: target });
  await ctx.close();
  console.log(`✓ ${target.replace(`${root}/`, '')} (${width}×${height})`);
}

// 1200×630 is the Open Graph summary_large_image size. Requantised after:
// a straight PNG of a gradient is ~250 KB, refetched on every share.
await shoot('og.html', 1200, 630, out('og.raw.png'));
await sharp(out('og.raw.png'))
  .png({ compressionLevel: 9, palette: true, quality: 92, dither: 1 })
  .toFile(out('og.png'));
await rm(out('og.raw.png'));
console.log(`✓ public/og.png requantised (${(statSync(out('og.png')).size / 1024).toFixed(0)} KB)`);

// App icons — rendered once at 512 and downscaled, so the glyph stays crisp.
await shoot('icon.html', 512, 512, out('icon-512.png'));
await sharp(out('icon-512.png')).resize(192, 192).png({ compressionLevel: 9 }).toFile(out('icon-192.png'));
console.log('✓ public/icon-192.png (192×192)');

// iOS masks the touch icon itself, so it gets the full-bleed tile: a drawn
// ring would be cut off at the corners.
await shoot('icon.html', 512, 512, out('apple-touch.raw.png'), ['bleed']);
await sharp(out('apple-touch.raw.png'))
  .resize(180, 180)
  .png({ compressionLevel: 9 })
  .toFile(out('apple-touch-icon.png'));
await rm(out('apple-touch.raw.png'));
console.log('✓ public/apple-touch-icon.png (180×180)');

// Android crops maskable icons to its own shape; full bleed, glyph in the safe zone.
await shoot('icon.html', 512, 512, out('icon-maskable-512.png'), ['bleed', 'maskable']);

await browser.close();
