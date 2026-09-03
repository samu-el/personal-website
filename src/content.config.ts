import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    /** One-line description used on cards and in meta tags. */
    blurb: z.string(),
    /** Free-form period label, e.g. "2025" or "2023 — present". */
    period: z.string(),
    /** Sort key: higher floats to the top. */
    weight: z.number().default(0),
    kind: z.enum(['Product', 'Platform', 'Tool', 'Open source', 'Client work']),
    role: z.string(),
    status: z.enum(['Live', 'Shipped', 'Archived', 'Ongoing', 'Experiment']).default('Shipped'),
    stack: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    repo: z.url().optional(),
    demo: z.url().optional(),
    /** Shown on the home page when true. */
    featured: z.boolean().default(false),
    /**
     * Kept out of the showcase: no detail page, no card, no sitemap entry.
     * A hidden project with a `repo` still appears as one line in the
     * "Also public" list on /work; one without disappears entirely.
     */
    hidden: z.boolean().default(false),
    /** Numeric facts rendered as a small stat row on the detail page. */
    stats: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
    draft: z.boolean().default(false),
  }),
});

const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    /** Rough read time in minutes; computed at build time if omitted. */
    readingTime: z.number().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, posts };
