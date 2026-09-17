/**
 * Reads a content collection's front matter without a build, for the two
 * things that run outside Astro: the screenshot script and the smoke suite.
 *
 * A line matcher rather than a YAML parser — every field either script needs
 * is a plain scalar or a boolean, and pulling in a parser to read six of them
 * is more to keep working than it saves.
 */
import { readdirSync, readFileSync } from 'node:fs';

/** One entry per .md/.mdx file, with the fields both callers ask for. */
export function collection(name, root = new URL('../src/content/', import.meta.url)) {
  const dir = new URL(`${name}/`, root);
  return readdirSync(dir)
    .filter((f) => /\.mdx?$/.test(f))
    .map((file) => {
      const raw = readFileSync(new URL(file, dir), 'utf8');
      const field = (key) => (raw.match(new RegExp(`^${key}:\\s*'?(.+?)'?\\s*$`, 'm')) ?? [])[1];
      const flag = (key) => new RegExp(`^${key}:\\s*true\\s*$`, 'm').test(raw);
      return {
        file,
        raw,
        slug: file.replace(/\.mdx?$/, ''),
        title: field('title'),
        kind: field('kind'),
        demo: field('demo'),
        device: field('device') ?? 'desktop',
        hidden: flag('hidden'),
        draft: flag('draft'),
        aiWritten: flag('aiWritten'),
      };
    });
}
