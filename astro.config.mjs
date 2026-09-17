// @ts-check
import { readdirSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

/**
 * Served from smr.et at the root, both values overridable so the same source
 * builds for a Pages project site:
 *
 *   SITE=https://samu-el.github.io BASE=/personal-website npm run build
 *
 * Every internal link goes through href() in src/lib/paths.ts.
 */
const SITE = process.env.SITE ?? 'https://smr.et';
const BASE = process.env.BASE ?? '/';

/** With no posts the Writing index still builds but is noindex, and a
 *  noindex page has no business in the sitemap. */
const hasPosts = readdirSync(new URL('./src/content/posts', import.meta.url)).some((f) => /\.mdx?$/.test(f));

export default defineConfig({
  site: SITE,
  base: BASE,
  // GitHub Pages 301s /about to /about/, so emit the slashed form directly:
  // no redirect hop on navigation, and canonicals that match the sitemap.
  trailingSlash: 'always',
  output: 'static',
  integrations: [
    mdx(),
    icon(),
    sitemap({
      filter: (page) => hasPosts || !/\/writing\/?$/.test(new URL(page).pathname),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-dimmed' },
      wrap: true,
    },
  },
  build: {
    inlineStylesheets: 'auto',
  },
  devToolbar: { enabled: false },
});
