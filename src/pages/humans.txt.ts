import type { APIRoute } from 'astro';
import { site } from '@/lib/site';

/**
 * humanstxt.org — the counterpart to robots.txt: who built the thing, and
 * with what. Costs one file and is the first place some people look.
 */
export const GET: APIRoute = () => {
  const body = `/* TEAM */

  Engineer:  ${site.name}
  Site:      https://smr.et
  Contact:   ${site.email}
  GitHub:    @samu-el
  Location:  ${site.location}


/* SITE */

  Standards:  HTML5, CSS, JavaScript
  Components: Astro, Tailwind CSS, TypeScript
  Hosting:    GitHub Pages, behind Cloudflare
  Fonts:      Instrument Serif, Geist, Geist Mono — all self-hosted
  Analytics:  None. No cookies either.

/* THANKS */

  Every maintainer of the above, none of whom were paid for it.
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
