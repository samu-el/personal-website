import { $, $$, byId } from './dom';
import { calm } from './env';

/** The mobile disclosure panel: button, scrim, focus trap, dismissing scroll. */
export function mobileMenu() {
  const btn = byId('menu-toggle');
  const menu = byId('mobile-menu');
  if (!btn || !menu) return;

  const scrim = byId('menu-scrim');
  const header = byId('site-header');
  const isOpen = () => btn.getAttribute('aria-expanded') === 'true';

  let closing = 0;
  /* The page stays scrollable: overflow:hidden stops sticky resolving and
     takes the header off screen. A deliberate scroll closes the panel. */
  let openedAt: number | null = null;

  function setOpen(open: boolean) {
    btn!.setAttribute('aria-expanded', String(open));
    btn!.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    scrim?.classList.toggle('is-open', open);
    clearTimeout(closing);
    openedAt = open ? window.scrollY : null;

    if (open) {
      menu!.hidden = false;
      // One frame between display and the class, or the row never animates
      // from its closed height.
      requestAnimationFrame(() => menu!.classList.add('is-open'));
      /* A disclosure, not a dialog: focus stays on the trigger and Tab walks
         into the panel, which follows it in source order. */
    } else {
      menu!.classList.remove('is-open');
      closing = window.setTimeout(() => (menu!.hidden = true), calm.matches ? 0 : 450);
    }
  }

  btn.addEventListener('click', () => setOpen(!isOpen()));
  scrim?.addEventListener('click', () => setOpen(false));

  document.addEventListener('keydown', (event) => {
    if (!isOpen()) return;
    if (event.key === 'Escape') {
      setOpen(false);
      btn.focus();
      return;
    }
    if (event.key !== 'Tab') return;
    /* Keep Tab inside the open panel. The trigger comes before the panel in
       source order, so it is the first stop and the last row wraps back to it. */
    const stops = [btn, ...$$('a, button', menu)];
    const edge = event.shiftKey ? stops[0] : stops[stops.length - 1];
    if (document.activeElement !== edge) return;
    event.preventDefault();
    (event.shiftKey ? stops[stops.length - 1] : stops[0]).focus();
  });

  // Close when the viewport grows past the mobile breakpoint.
  matchMedia('(min-width: 48rem)').addEventListener('change', (event) => {
    if (event.matches && isOpen()) setOpen(false);
  });

  if (!header) return;
  const onScroll = () => {
    header.toggleAttribute('data-scrolled', window.scrollY > 8);
    if (openedAt !== null && Math.abs(window.scrollY - openedAt) > 48) setOpen(false);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/** One hairline sliding between the links, replacing the per-link rules. */
export function navIndicator() {
  const rail = byId('primary-nav');
  const bar = rail && $('.nav-indicator', rail);
  if (!rail || !bar) return;

  const links = $$<HTMLAnchorElement>('.nav-link', rail);
  const here = links.find((a) => a.getAttribute('aria-current') === 'page');

  const moveTo = (link?: HTMLElement) => {
    if (!link) return rail.removeAttribute('data-indicator');
    // Measured against the rail, so it survives the header compressing.
    const box = link.getBoundingClientRect();
    const base = rail.getBoundingClientRect();
    bar.style.setProperty('--x', `${(box.left - base.left).toFixed(1)}px`);
    // Unitless: --w scales a 1px bar, it is not a width.
    bar.style.setProperty('--w', box.width.toFixed(1));
    rail.setAttribute('data-indicator', '');
  };

  // Only takes over once a measurement succeeded, so the CSS fallback stays
  // in charge if the nav is not laid out yet.
  const settle = () => moveTo(here);
  if (here) settle();

  for (const link of links) {
    link.addEventListener('pointerenter', () => moveTo(link));
    link.addEventListener('focus', () => moveTo(link));
  }
  rail.addEventListener('pointerleave', settle);
  rail.addEventListener('focusout', (event) => {
    if (!rail.contains(event.relatedTarget as Node)) settle();
  });
  window.addEventListener('resize', settle, { passive: true });
}
