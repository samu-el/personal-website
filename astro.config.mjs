// @ts-check
import { readdirSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

/**
 * The site is served from the custom domain smr.et, at the root.
 *
 * Both values stay overridable so the same source can be built for a
 * GitHub Pages project site if the domain ever goes away:
 *
 *   SITE=https://samu-el.github.io BASE=/personal-website npm run build
 *
 * Every internal link goes through href() in src/lib/paths.ts, which applies
 * the base — so switching is configuration, not a find-and-replace.
 */
const SITE = process.env.SITE ?? 'https://smr.et';
const BASE = process.env.BASE ?? '/';

/**
 * The Writing section is gated on there being posts to read. When there are
 * none its index still builds (so dropping in a post is all it takes) but it
 * is marked noindex — and a noindex page has no business in the sitemap.
 */
const hasPosts = readdirSync(new URL('./src/content/posts', import.meta.url)).some((f) =>
  /\.mdx?$/.test(f),
);

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'ignore',
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
