// @ts-check
import { readdirSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

/**
 * Deployment is configurable so the same source can ship to either
 * a GitHub Pages project site or a custom domain:
 *
 *   GitHub Pages (default) -> https://samu-el.github.io/personal-website
 *   Custom domain          -> SITE=https://samuelmussie.dev BASE=/ npm run build
 */
const SITE = process.env.SITE ?? 'https://samu-el.github.io';
const BASE = process.env.BASE ?? '/personal-website';

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
