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

## Live feeds

The **Now** page (`/now`) reads three sources at build time, in
`src/lib/feeds.ts`:

| Source           | Endpoint                                    | Auth                                                                              |
| ---------------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| GitHub activity  | `/users/samu-el` and `/users/samu-el/repos` | none required; `GITHUB_TOKEN` is used when set, to avoid the anonymous rate limit |
| Spotify history  | `/v1/me/player/recently-played`             | client id, client secret and a refresh token, from the environment                |
| Letterboxd diary | `letterboxd.com/rocin4nte/rss/`             | none                                                                              |

"Recently pushed" drops anything pushed longer ago than `MAX_REPO_AGE_DAYS`
(two years) and lets the list run short. A fixed-length list backfills from
further down the history whenever something is excluded, which is how a
five-year-old repository ends up presented as recent activity. The language
summary still spans every public repository, aged out or not.

Forks are excluded from "recently pushed" as somebody else's work.

Old coursework and throwaways are kept out of the list by name in
`HIDDEN_REPOS` — the API counts them as activity, but they are not a signal
worth showing. Edit that set to change what appears.

Both are allowed to fail. On a network error, a rate limit or an unexpected
payload the fetch returns `null`, the section that would have used it is not
rendered, and the build still succeeds — the home page's repository count
falls back to the curated figure in `src/data/experience.ts`. Nothing is
cached to disk on purpose: a stale "recently pushed" list is worse than none,
and rendering each item's own date means the page never claims its own
freshness.

A `schedule` trigger in `deploy.yml` rebuilds daily at 05:00 UTC (08:00 in
Addis Ababa) so the feeds stay current between pushes.

### Currently listening

The live card on `/now` is filled in the browser from
`GET /api/now-playing.json`, served by the Cloudflare Worker in `worker/`.
A static site cannot hold a secret; the Worker can, so the credentials stay
server-side and the browser only sees a trimmed `{ playing, title, artist,
art, url }`.

The route sits on this site's own domain, so the fetch is same-origin: no CORS
preflight, no third-party request. `public/api/now-playing.json` answers
`{ "playing": false }` as a fallback, which the Worker route shadows in
production — without it a browser would log a failed request for an endpoint
that is not deployed yet. The smoke suite asserts that fallback exists.

See `worker/README.md` for deployment. Note that the Worker needs a refresh
token carrying `user-read-currently-playing`, which
`scripts/spotify-token.mjs` now requests alongside the history scope.

### Artwork

Album art and film posters are hotlinked from `i.scdn.co` and `a.ltrbxd.com`
with `referrerpolicy="no-referrer"`, fixed dimensions and `loading="lazy"`.
They are deliberately _not_ run through Astro's remote image optimisation:
that downloads at build time and would fail the build if a CDN hiccupped,
which contradicts the rule that no feed may ever break a deploy. The trade is
two third-party image hosts at runtime. Moving them behind a Worker proxy
would make them first-party again if that ever matters.

### Spotify

Three secrets, none of which may ever reach the browser. They are read through
`process.env` in `src/lib/feeds.ts` at build time; Astro inlines only
`PUBLIC_*` variables into client JavaScript, so a value read that way cannot
end up in the output. With none of them set the section is simply absent, which
is the expected state of a fresh clone; with some of them set the build warns,
because that is a misconfiguration rather than a choice.

1. Create an app at developer.spotify.com and add `http://127.0.0.1:8888/callback`
   to its redirect URIs. It has to be the IP literal — Spotify requires HTTPS
   except for loopback addresses, and `localhost` is not accepted.
2. Mint a refresh token once, locally. It prints the token and writes nothing
   to disk:

   ```
   SPOTIFY_CLIENT_ID=… SPOTIFY_CLIENT_SECRET=… node scripts/spotify-token.mjs
   ```

3. Add `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and
   `SPOTIFY_REFRESH_TOKEN` as repository secrets under Settings → Secrets and
   variables → Actions. The deploy workflow passes them to the build; CI does
   not, so pull requests build without the feed.

**This app's refresh token expires after 180 days.** When it does the fetch
starts failing, the section disappears, and step 2 has to be repeated. The site
keeps building throughout.

The parsers are pure and unit-tested against fixtures — `npm run test:unit`.
That matters because the GitHub user-level endpoints are unreachable from some
sandboxes, so the transform cannot always be exercised against a live
response.

## Deployment

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `master`.

The site is served from **https://smr.et**, at the root. Three things make that work, and all
three need to stay in place:

1. **DNS** — `smr.et` and `www.smr.et` resolve to Cloudflare, which proxies to GitHub Pages.
   Cloudflare's SSL/TLS mode must be **Full** (not Flexible, which causes a redirect loop with
   Pages).
2. **The repository setting** — Settings → Pages → Custom domain is set to `smr.et`.
3. **Two `CNAME` files, both required.** `CNAME` at the repository root is what GitHub treats
   as the source of truth for the custom-domain setting — the Pages UI writes it, and **deleting
   it clears the domain**, which takes the site down. `public/CNAME` is the copy that ends up
   inside the deployed `dist/`, since Astro copies only `public/`. Keep both; do not "tidy up"
   either one.

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
