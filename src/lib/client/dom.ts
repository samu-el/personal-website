/** Query helpers, typed, so a script is not three casts deep before it starts. */
export const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
  root.querySelector<T>(selector);

export const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => [
  ...root.querySelectorAll<T>(selector),
];

/** Shorthand for the id lookups that make up most of this codebase's DOM work. */
export const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;

/** A field that takes typing: every printable key belongs to it. */
export const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);

const INTERACTIVE =
  'a[href], button, input, select, textarea, summary, audio[controls], video[controls], [contenteditable], [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], [role="checkbox"], [role="switch"], [role="slider"], [role="combobox"], [role="textbox"]';

/** An open <dialog> other than `except`. */
export const dialogOpen = (except?: Element | null) => $$<HTMLDialogElement>('dialog[open]').some((d) => d !== except);

/**
 * Whether a single-character shortcut may act on this keydown (WCAG 2.1.4):
 * no modifier (Shift only when `shift` allows it), no auto-repeat, no dialog
 * open, and focus on the page itself rather than a control that could want
 * the key.
 */
export function mayShortcut(event: KeyboardEvent, { shift = false } = {}) {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || (event.shiftKey && !shift)) return false;
  if (dialogOpen()) return false;
  const el = event.target;
  if (!(el instanceof Element) || el === document.body || el === document.documentElement) return true;
  return !isEditable(el) && !el.closest(INTERACTIVE);
}
