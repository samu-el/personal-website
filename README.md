# samuelmussie — personal site

The personal site of **Samuel Mussie**, a software engineer in Addis Ababa: bio, selected work,
writing, and the stack behind it.

Built with [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com), shipped as
static HTML, deployed to GitHub Pages by GitHub Actions. No client framework — the JavaScript on
a page is a theme toggle, a mobile menu, a scroll observer and a clock.

> This repository replaces a 2019 fork of `github/personal-website` (Jekyll). None of that code
> remains; the history does.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:4321
```

| Command              | What it does                                             |
| -------------------- | -------------------------------------------------------- |
| `npm run dev`        | Dev server with hot reload                               |
| `npm run build`      | Typecheck, then build to `dist/`                         |
| `npm run build:fast` | Build without the typecheck (what CI uses after `check`) |
| `npm run check`      | `astro check` — types across `.astro`, `.ts`, content    |
| `npm run preview`    | Serve the built `dist/` locally                          |
| `npm run images`     | Regenerate `public/og.png` and the app icons             |

Node 22+ is expected (see `.github/workflows/`).

### Smoke suite

`tests/verify.mjs` drives a real browser over every built route and asserts the things that
break silently on a static site: console errors, horizontal overflow, heading structure, links
with no accessible name, broken internal links, the theme toggle cycling and persisting, the
mobile menu, the work filter, the scroll reveal, and the RSS/sitemap/OG/JSON-LD output.

```bash
npm run build
npm run preview &
npm run verify
```

To check a deployed site instead, point it at the origin and base path:

```bash
BASE_URL=https://smr.et npm run verify
```

Both the route fetches and the browser honour `HTTPS_PROXY` when it is set.

---

## How the content is organised

Everything editable lives in two places: **`src/content/`** for long-form entries and
**`src/data/`** for structured facts. No copy is hard-coded into a page component.

```
src/
├── content/
│   ├── projects/*.md     # one file per project → /work/<slug>
│   └── posts/*.md        # one file per post   → /writing/<slug>
├── content.config.ts     # frontmatter schemas (build fails on a bad field)
├── data/
│   ├── experience.ts     # timeline, metrics
│   └── stack.ts          # tools by group, services
├── lib/
│   ├── site.ts           # name, role, email, nav, social links
│   ├── paths.ts          # base-path-aware href() helper
│   └── format.ts         # dates, reading time
├── components/           # Header, Footer, cards, Section, ThemeToggle, BaseHead
├── layouts/Layout.astro  # <head>, theme bootstrap, reveal observer
├── pages/                # routes
└── styles/
    ├── global.css        # design tokens, component classes, prose styles
    └── fonts.css         # self-hosted @font-face rules
```

### Adding a post

There are no posts. The Writing section — its nav link, the home-page section, the RSS feed and
its sitemap entry — appears automatically the moment a publishable post exists, and disappears
again when none do. So adding one is the only step.

Create `src/content/posts/my-post.md`:

```yaml
---
title: 'Title in sentence case'
description: 'One or two sentences. Used on cards, in <meta>, and in the RSS feed.'
pubDate: 2026-09-02
tags: ['Engineering leadership']
featured: false # true surfaces it on the home page
draft: false # true hides it from production but shows it in dev
---
Body in Markdown.
```

Reading time is computed from the body; set `readingTime` to override it.

**`aiWritten: true` means a post is never rendered in production**, in any environment — the
same treatment as `draft`, but not overridable by the dev server. This site publishes only
Samuel's own words, and the flag makes that a property of the build rather than something to
remember. It is enforced in `src/lib/posts.ts` and covered by the smoke suite.

The smoke suite reads its route list from the built sitemap, so a new page or a renamed post is
covered automatically.

### Adding a project

Same idea in `src/content/projects/`. The required fields are `title`, `blurb`, `period`,
`kind`, and `role`; `weight` sorts the list (higher first). See any existing file, or
`src/content.config.ts` for the full schema — a typo in a field name fails the build rather
than shipping quietly.

---

## Design system

One stylesheet, `src/styles/global.css`, holds all of it:

- **Colour** is two token sets — light on `:root`, dark on `.dark` — exposed to Tailwind as
  semantic utilities (`bg-bg`, `text-muted`, `border-line`, `text-accent`). Nothing in a
  component references a raw hex value, so a palette change is a single edit.
- **Type** is three families: Instrument Serif for display, Geist for body and UI, Geist Mono
  for labels and metadata. Self-hosted, latin subsets only, ~112 KB total.
- **Theme** is three-state: system → light → dark, cycled by the header toggle, resolved by an
  inline script before first paint so there is no flash.
- **Motion** is a scroll reveal that is opt-in from JS: elements are visible by default and the
  script only animates ones it is actively observing, so a blocked script cannot hide content.
  Everything respects `prefers-reduced-motion`.

---

## Deployment

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `master`.

The site is served from **https://smr.et**, at the root. Three things make that work, and all
three need to stay in place:

1. **DNS** — `smr.et` and `www.smr.et` resolve to Cloudflare, which proxies to GitHub Pages.
   Cloudflare's SSL/TLS mode must be **Full** (not Flexible, which causes a redirect loop with
   Pages).
2. **The repository setting** — Settings → Pages → Custom domain is set to `smr.et`.
3. **`public/CNAME`** — shipped in the build artifact so a deploy cannot clear the setting.
   It must live in `public/`, not the repository root: this workflow deploys the built `dist/`
   directory, and only `public/` is copied into it. A root `CNAME` is never seen by Pages.

Build defaults live in `astro.config.mjs` (`SITE=https://smr.et`, `BASE=/`) and are mirrored in
the deploy workflow, so no repository variables are required.

### Building for a GitHub Pages project site instead

If the domain ever goes away, nothing needs rewriting — every internal link goes through
`href()` in `src/lib/paths.ts`, which applies the base:

```bash
SITE=https://samu-el.github.io BASE=/personal-website npm run build
```

Either set those as repository variables (**Settings → Secrets and variables → Actions →
Variables**) or change the defaults in `astro.config.mjs`. Remove `public/CNAME` too.

## Licence

Code is MIT (see `LICENSE`). The written content in `src/content/`, `src/data/`, and the
copy in `src/pages/` is © Samuel Mussie — reuse the scaffolding, write your own words.
