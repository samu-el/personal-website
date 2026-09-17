/**
 * What the browser will allow, asked once.
 *
 * Every interactive script needs the same two answers — may this move, and is
 * there a real pointer — and each used to open its own matchMedia. These are
 * live MediaQueryList objects, so a preference changed mid-session is picked
 * up without re-reading anything.
 */
export const calm = matchMedia('(prefers-reduced-motion: reduce)');
const fine = matchMedia('(hover: hover) and (pointer: fine)');
export const dark = matchMedia('(prefers-color-scheme: dark)');

/** Motion is welcome. */
export const mayMove = () => !calm.matches;

/** There is a pointer worth following, and motion is welcome. */
export const mayFollow = () => fine.matches && !calm.matches;
