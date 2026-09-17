/** Query helpers, typed, so a script is not three casts deep before it starts. */
export const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
  root.querySelector<T>(selector);

export const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => [
  ...root.querySelectorAll<T>(selector),
];

/** Shorthand for the id lookups that make up most of this codebase's DOM work. */
export const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
