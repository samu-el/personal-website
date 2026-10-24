import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import type { CollectionEntry } from 'astro:content';
import { byId } from '@/lib/assets';

/**
 * A project's captures, one per site theme: `<id>.webp` is light and
 * `<id>-dark.webp` dark (scripts/shots.mjs writes both). A product with one
 * look ships only `<id>.webp`, shown in both themes. docs/architecture.md,
 * "Screenshots".
 */
const files = import.meta.glob<{ default: ImageMetadata }>('/src/assets/previews/*.{png,jpg,jpeg,webp,avif}', {
  eager: true,
});

export type Theme = 'light' | 'dark';

/** What `<Image>` and `getImage()` are both handed, so the two cannot drift. */
export interface PreviewImage {
  src: ImageMetadata;
  widths: number[];
  sizes: string;
}

export interface Previews {
  light: PreviewImage;
  /** Absent for a product with one look. */
  dark?: PreviewImage;
}

/** A desktop capture across the page's `.wrap`, as /work and each detail page show it. */
export const WRAP_SIZES = '(min-width: 1440px) 1312px, 92vw';

/**
 * The captures for a project at the width its frame renders, or undefined
 * when there is none yet. `sizes` is for a desktop capture and defaults to the
 * /work row's layout; a phone frame is 16rem on a phone and 19rem from 640px up.
 */
export function previewsFor(project: CollectionEntry<'projects'>, sizes?: string): Previews | undefined {
  const phone = project.data.device === 'phone';
  const base = {
    widths: phone ? [320, 480, 880] : [640, 960, 1280, 1600],
    sizes: phone ? '(min-width: 640px) 19rem, 16rem' : (sizes ?? '(min-width: 1024px) 58vw, 100vw'),
  };
  const light = byId(files, project.id);
  if (!light) return undefined;
  const dark = byId(files, `${project.id}-dark`);
  return { light: { src: light, ...base }, dark: dark && { src: dark, ...base } };
}

/** One `<link rel="preload">` per theme, for Layout's head. */
export interface PreviewPreload {
  theme: Theme;
  srcset: string;
  sizes: string;
}

/**
 * The first capture on a page is its LCP, and with a pair neither image can
 * be eager: which one shows is decided by the theme script, before first
 * paint. So the head carries an inert preload for each, and that script
 * activates the one it picks (Layout.astro). A single capture needs none: it
 * is an ordinary eager image the preload scanner already finds.
 */
export async function previewPreloads(previews: Previews | undefined): Promise<PreviewPreload[]> {
  if (!previews?.dark) return [];
  const pairs = [
    ['light', previews.light],
    ['dark', previews.dark],
  ] as const;
  return Promise.all(
    pairs.map(async ([theme, image]) => {
      const { srcSet } = await getImage(image);
      return { theme, srcset: srcSet.attribute, sizes: image.sizes };
    }),
  );
}
