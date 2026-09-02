import type { APIRoute } from 'astro';
import { href } from '@/lib/paths';

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL(href('/sitemap-index.xml'), site ?? 'https://samu-el.github.io');

  const body = `User-agent: *
Allow: /

Sitemap: ${sitemap.toString()}
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
