import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
  schema: z
    .object({
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
      /**
       * The source exists but is not public. Renders as a plain "Private source"
       * label where the link would be, so an absent Source button reads as a
       * deliberate fact rather than an omission.
       */
      repoPrivate: z.boolean().default(false),
      demo: z.url().optional(),
      /**
       * What the demo is, so the preview is framed as the right thing. A
       * mobile app's web build in a 16:10 desktop frame is mostly background.
       */
      device: z.enum(['desktop', 'phone']).default('desktop'),
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
    })
    // Claiming a public URL and a private source at once is a contradiction,
    // and a stale repo link on a repository that has since been made private
    // is exactly how a Source button starts 404ing. Fail the build instead.
    .refine((d) => !(d.repo && d.repoPrivate), {
      message: 'a project cannot set both repo and repoPrivate',
      path: ['repoPrivate'],
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
    /**
     * Written or drafted by an AI rather than by Samuel. Treated exactly like
     * `draft` in production: never rendered, never in the feed or sitemap.
     * The flag exists so the policy is enforced by the build rather than
     * remembered — flip it to false only for something you actually wrote.
     */
    aiWritten: z.boolean().default(false),
  }),
});

export const collections = { projects, posts };
