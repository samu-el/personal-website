import { mayFollow } from './env';

/**
 * Follows the pointer across the elements matching `selector`.
 *
 * Two behaviours were written twice over — the button that leans toward the
 * cursor and the project frame that tilts under it — and they differ only in
 * what they do with the position. This owns the part that was identical: one
 * delegated listener rather than a pair per element, passive so it never
 * blocks a scroll, the bookkeeping to settle the element being left, and the
 * gate on pointer and motion preferences.
 *
 * `move` is handed the element and the pointer's position within it as two
 * fractions from 0 to 1, left to right and top to bottom.
 */
export function follow(
  selector: string,
  move: (el: HTMLElement, x: number, y: number) => void,
  settle: (el: HTMLElement) => void,
) {
  let active: HTMLElement | null = null;

  const leave = () => {
    if (active) settle(active);
    active = null;
  };
  document.addEventListener(
    'pointermove',
    (event) => {
      if (!mayFollow()) return;
      const target = event.target instanceof Element ? event.target.closest(selector) : null;
      const el = target as HTMLElement | null;
      // Moved to a different element, or off every one of them: the one being
      // left settles before the new one takes over.
      if (el !== active) leave();
      active = el;
      if (!el) return;
      const box = el.getBoundingClientRect();
      move(el, (event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
    },
    { passive: true },
  );
  // Off the document entirely — out of the window, or into devtools.
  document.addEventListener('pointerleave', leave, { passive: true });
}
