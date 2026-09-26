import type { APIRoute } from 'astro';
import { href } from '@/lib/paths';
import tokens from '@/styles/tokens.css?raw';

/**
 * Generated rather than kept in public/ so every URL carries the build's base:
 * a static manifest with `start_url: "/"` sends an installed Pages build
 * (`BASE=/personal-website`) to the wrong origin root.
 *
 * The colours are read out of the dark token block rather than copied: the
 * icons are the dark tile, so the splash and title bar match them whichever
 * scheme the system resolves the site to.
 */
const darkBg = tokens.match(/\.dark\s*\{[^}]*--c-bg:\s*(\d+)\s+(\d+)\s+(\d+)/);
if (!darkBg) throw new Error('could not read .dark --c-bg from src/styles/tokens.css');
const bg = `#${darkBg
  .slice(1, 4)
  .map((n) => Number(n).toString(16).padStart(2, '0'))
  .join('')}`;

export const GET: APIRoute = () => {
  const manifest = {
    id: href('/'),
    name: 'Samuel Mussie — Software Engineer',
    short_name: 'Samuel Mussie',
    description: 'Personal site of Samuel Mussie, a software engineer in Addis Ababa, Ethiopia.',
    start_url: href('/'),
    scope: href('/'),
    display: 'standalone',
    background_color: bg,
    theme_color: bg,
    icons: [
      { src: href('/favicon.svg'), sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: href('/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: href('/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: href('/icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return new Response(`${JSON.stringify(manifest, null, 2)}\n`, {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
};
