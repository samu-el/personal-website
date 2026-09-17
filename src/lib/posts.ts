import { getCollection, type CollectionEntry } from 'astro:content';
import { nav, type NavItem } from '@/lib/site';

/**
 * Astro warns on every read of an empty collection — six warnings a build
 * here, enough to train someone to ignore build output. Counting the files
 * through Vite's glob skips the read when there is nothing to read.
 */
const postFiles = import.meta.glob('/src/content/posts/*.{md,mdx}');
const hasAnyPostFile = Object.keys(postFiles).length > 0;

/**
 * Posts that may appear in production. `draft` hides work in progress;
 * `aiWritten` hides anything an AI wrote, because this site publishes only
 * Samuel's own words and the build should enforce that rather than trust
 * anyone to remember. Drafts show while developing, AI-written posts never.
 */
export async function publishedPosts(): Promise<CollectionEntry<'posts'>[]> {
  if (!hasAnyPostFile) return [];
  const posts = await getCollection('posts', ({ data }) => !data.aiWritten && (import.meta.env.DEV || !data.draft));
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** True when the Writing section should exist at all — nav, feed, sitemap and all. */
export async function hasWriting(): Promise<boolean> {
  return (await publishedPosts()).length > 0;
}

/**
 * The navigation as it should render: Writing drops out when nothing is
 * published, and the numbering is recomputed so there is no gap where it was.
 */
export async function visibleNav(): Promise<NavItem[]> {
  const writing = await hasWriting();
  return nav
    .filter((i) => writing || i.href !== '/writing')
    .map((item, i) => ({ ...item, index: String(i + 1).padStart(2, '0') }));
}

/** Eyebrow index for a page, e.g. "03" for /work. Empty if it is not in the nav. */
export async function navIndex(path: string): Promise<string> {
  const items = await visibleNav();
  return items.find((i) => i.href === path)?.index ?? '';
}
