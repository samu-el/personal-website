/**
 * Build-time base path helpers.
 *
 * The site can ship either to a GitHub Pages project site (base `/personal-website`)
 * or to a custom domain (base `/`). Every internal link goes through `href()` so
 * switching between the two is a single env var, not a find-and-replace.
 */
const BASE = import.meta.env.BASE_URL || '/';

/** Prefix an app-absolute path (`/work`) with the configured base. */
export function href(path: string): string {
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('mailto:') || path.startsWith('#')) {
    return path;
  }
  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  const rest = path.startsWith('/') ? path : `/${path}`;
  return `${base}${rest}` || '/';
}

/** Absolute URL, for OG tags, canonicals and feeds. */
export function absolute(path: string, site: URL | string | undefined): string {
  const origin = site ? new URL(site).origin : '';
  return `${origin}${href(path)}`;
}

/** True when `current` is `path` or a descendant of it. */
export function isActive(current: string, path: string): boolean {
  const norm = (p: string) => {
    const withoutBase =
      p.startsWith(href('/')) && href('/') !== '/' ? p.slice(href('/').length - 1) : p;
    return withoutBase.replace(/\/+$/, '') || '/';
  };
  const a = norm(current);
  const b = norm(path);
  if (b === '/') return a === '/';
  return a === b || a.startsWith(`${b}/`);
}
