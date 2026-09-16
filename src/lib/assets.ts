import type { ImageMetadata } from 'astro';

/**
 * Finds `<id>.<ext>` at the end of an `import.meta.glob` key, ignoring the
 * extension — so a preview or logo is matched by project id and nothing in
 * the content files has to track the filesystem.
 *
 * Written without a regex on purpose: the obvious version — a character class
 * containing a slash, then a template literal starting with one — is valid
 * TypeScript but breaks prettier-plugin-astro's tokenizer, which then runs
 * past the closing fence and reports dozens of phantom errors.
 */
export function byId(map: Record<string, { default: ImageMetadata }>, id: string) {
  const suffix = '/' + id;
  const hit = Object.entries(map).find(([path]) => {
    const dot = path.lastIndexOf('.');
    return (dot === -1 ? path : path.slice(0, dot)).endsWith(suffix);
  });
  return hit?.[1].default;
}
