import { calm } from './env';
import { $$ } from './dom';

/**
 * Figures count up from zero when they scroll into view. The markup holds the
 * final value, so with no script, reduced motion, or an old browser the number
 * is simply there. The suffix — " yrs", "+" — rides along untouched.
 */
export function countUp(duration = 1400) {
  if (calm.matches || !('IntersectionObserver' in window)) return;
  const ease = (t: number) => 1 - Math.pow(1 - t, 5);

  const run = (el: HTMLElement) => {
    const match = el.textContent?.trim().match(/^(\d+)(.*)$/);
    if (!match) return;
    const [, digits, suffix] = match;
    const target = Number(digits);
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      el.textContent = Math.round(target * ease(p)) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        run(entry.target as HTMLElement);
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.4 },
  );
  $$('[data-count]').forEach((el) => io.observe(el));
}
