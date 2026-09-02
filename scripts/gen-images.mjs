/**
 * Renders the social card and app icons.
 *
 * Chromium rather than an SVG rasteriser, so the output uses the same
 * self-hosted webfonts as the site — a card set in a fallback serif is a
 * different design from the one people actually land on.
 *
 *   npm run images
 *
 * Set CHROMIUM_PATH when a browser is already installed on the machine.
 */
import { mkdir, rm } from 'node:fs/promises';
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

async function shoot(template, width, height, target) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(asset(template), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await mkdir(dirname(target), { recursive: true });
  await page.screenshot({ path: target });
  await ctx.close();
  console.log(`✓ ${target.replace(`${root}/`, '')} (${width}×${height})`);
}

// Social card — 1200×630 is the Open Graph / Twitter summary_large_image size.
// Screenshot first, then requantise: a straight PNG of a gradient is ~250 KB,
// and platforms refetch this on every share.
await shoot('og.html', 1200, 630, out('og.raw.png'));
await sharp(out('og.raw.png'))
  .png({ compressionLevel: 9, palette: true, quality: 92, dither: 1 })
  .toFile(out('og.png'));
await rm(out('og.raw.png'));
console.log(`✓ public/og.png requantised (${(statSync(out('og.png')).size / 1024).toFixed(0)} KB)`);

// App icons — rendered once at 512 and downscaled, so the glyph stays crisp.
await shoot('icon.html', 512, 512, out('icon-512.png'));
for (const [size, name] of [
  [192, 'icon-192.png'],
  [180, 'apple-touch-icon.png'],
]) {
  await sharp(out('icon-512.png'))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out(name));
  console.log(`✓ public/${name} (${size}×${size})`);
}

await browser.close();
