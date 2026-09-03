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
npm run dev        # http://localhost:4321/personal-website
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
npm run verify          # BASE_URL=… to point it at a deployed site instead
```

---

## How the content is organised

Everything editable lives in two places: **`src/content/`** for long-form entries and
**`src/data/`** for structured facts. No copy is hard-coded into a page component.

```
src/
├── content/
│   ├── projects/*.md     # one file per project → /work/<slug>
│   └── posts/*.md        # one file per essay   → /writing/<slug>
├── content.config.ts     # frontmatter schemas (build fails on a bad field)
├── data/
│   ├── experience.ts     # timeline, metrics, principles
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
Enable it once under **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The live URL is `https://samu-el.github.io/personal-website`.

### Moving to a custom domain

The site URL and base path are environment variables, so this is configuration, not a
find-and-replace:

1. Add `public/CNAME` containing the bare domain (e.g. `samuelmussie.dev`).
2. Set repository variables under **Settings → Secrets and variables → Actions → Variables**:
   - `SITE` = `https://samuelmussie.dev`
   - `BASE` = `/`
3. Point a `CNAME` DNS record at `samu-el.github.io`, then set the domain under
   **Settings → Pages**.

Every internal link goes through `href()` in `src/lib/paths.ts`, which prefixes the configured
base — so both deployments work from the same source.

---

## Licence

Code is MIT (see `LICENSE`). The written content in `src/content/`, `src/data/`, and the
copy in `src/pages/` is © Samuel Mussie — reuse the scaffolding, write your own words.
