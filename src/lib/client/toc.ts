import { $$ } from './dom';

/** Where the reading band starts, as a fraction of the viewport from the top. */
const BAND_TOP = 0.15;

/**
 * Lights the contents entry for the section being read: the last heading that
 * has reached the band just below the header. Measured from positions on every
 * scroll frame rather than from intersection events, which only fire as a
 * heading crosses the band — scrolling back up out of a section leaves the
 * previous heading above the band and never reports it.
 */
export function tableOfContents() {
  const links = $$<HTMLAnchorElement>('.toc-link');
  const headings = links.map((l) => document.getElementById(l.dataset.toc!)).filter((h) => h !== null);
  if (!headings.length) return;
  let current: string | null | undefined;
  let frame = 0;

  function update() {
    frame = 0;
    const band = window.innerHeight * BAND_TOP;
    let id: string | null = null;
    for (const h of headings) {
      if (h.getBoundingClientRect().top <= band) id = h.id;
      else break;
    }
    if (id === current) return;
    current = id;
    links.forEach((l) => l.classList.toggle('is-current', l.dataset.toc === id));
  }

  const queue = () => (frame ||= requestAnimationFrame(update));
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue, { passive: true });
  update();
}
