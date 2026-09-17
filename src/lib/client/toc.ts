import { $$ } from './dom';

/**
 * Lights the contents entry for whichever heading is in the reading band.
 * The band is deliberately narrow and high: a heading counts as current from
 * just below the header until it is most of the way off the top.
 */
export function tableOfContents() {
  const links = $$<HTMLAnchorElement>('.toc-link');
  const headings = links.map((l) => document.getElementById(l.dataset.toc!)).filter(Boolean);
  if (!headings.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const { isIntersecting, target } of entries) {
        if (isIntersecting) links.forEach((l) => l.classList.toggle('is-current', l.dataset.toc === target.id));
      }
    },
    { rootMargin: '-15% 0px -70% 0px' },
  );
  headings.forEach((h) => io.observe(h!));
}
