/**
 * Everything that is true of the built HTML, checked without a browser.
 *
 * These assertions used to run inside the smoke suite, which meant opening
 * Chromium and walking every route to read properties that are sitting in
 * `dist/` as text. They are the same assertions; they now cost a file read.
 * What genuinely needs layout, script or a pointer stays in browser.mjs.
 *
 * Run with: npm run build && npm run test:static
 */
import { globSync, readFileSync } from 'node:fs';
import { collection } from '../scripts/frontmatter.mjs';
import { issues as makeIssues } from './harness.mjs';

const issues = makeIssues();
const flag = (bad, msg) => bad && issues.push(msg);

/* <template> contents are stripped: they are inert prototypes the script
   clones and fills, never part of the live DOM, and the browser suite this
   replaced could not see them either. */
const pages = globSync('dist/**/*.html').map((file) => ({
  route: '/' + file.replace(/^dist\//, ''),
  html: readFileSync(file, 'utf8').replace(/<template[\s\S]*?<\/template>/g, ''),
}));
if (pages.length < 5) throw new Error(`only ${pages.length} built pages — did the build run?`);
console.log(`Checking ${pages.length} built pages…`);

/** Tag soup, deliberately: one regex beats a parser dependency for this. */
const all = (html, re) => [...html.matchAll(re)].map((m) => m[0]);
const attr = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
const built = new Set(pages.map((p) => p.route.replace(/index\.html$/, '')));

for (const { route, html } of pages) {
  const h1s = all(html, /<h1[\s>]/g).length;
  flag(h1s !== 1, `${route} has ${h1s} <h1>`);

  for (const img of all(html, /<img\b[^>]*>/g)) {
    // A minifier writes an empty alt as a bare attribute, which still counts.
    flag(!/\balt(=|[\s/>])/.test(img), `${route} img without alt: ${img.slice(0, 70)}`);
  }

  // A link needs something a screen reader can announce: text, or a label.
  for (const link of all(html, /<a\b[^>]*>[\s\S]*?<\/a>/g)) {
    const named = /aria-label=/.test(link) || link.replace(/<[^>]*>/g, '').trim().length > 0;
    flag(!named, `${route} link with no accessible name: ${attr(link, 'href')}`);
  }

  // Internal links must resolve to something the build actually emitted.
  for (const link of all(html, /<a\b[^>]*href="\/[^"]*"[^>]*>/g)) {
    const href = attr(link, 'href').split(/[?#]/)[0];
    const target = href.endsWith('/') ? `${href}index.html` : href;
    const ok = built.has(href) || built.has(target) || globSync(`dist${target}`).length > 0;
    flag(!ok, `broken internal link on ${route}: ${href}`);
  }
}

// The home page carries the identity every scraper reads.
{
  const home = pages.find((p) => p.route === '/index.html').html;
  flag(!/<title>[^<]*Samuel Mussie/.test(home), 'home title is missing the name');
  flag(!/name="description" content="[^"]+"/.test(home), 'home has no meta description');
  const og = home.match(/property="og:image" content="([^"]+)"/)?.[1];
  flag(!og?.startsWith('https://'), `og:image is not absolute: ${og}`);
  flag(!og?.endsWith('/og.png'), `og:image wrong: ${og}`);
  const canonical = home.match(/rel="canonical" href="([^"]+)"/)?.[1];
  flag(!canonical?.startsWith('https://'), `canonical is not absolute https: ${canonical}`);
  try {
    const ld = JSON.parse(home.match(/application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1]);
    flag(ld['@type'] !== 'Person' || ld.name !== 'Samuel Mussie', 'Person schema wrong');
  } catch {
    issues.push('Person JSON-LD is missing or not valid JSON');
  }
}

// Feeds and the files that point at them.
for (const [file, must] of [
  ['dist/sitemap-index.xml', ['<sitemapindex']],
  ['dist/robots.txt', ['Sitemap:', 'User-agent: *']],
  ['dist/rss.xml', ['<rss', '<language>en-us</language>']],
  ['dist/humans.txt', ['Samuel Mussie']],
  ['dist/api/now-playing.json', ['"playing"']],
]) {
  const body = globSync(file).length ? readFileSync(file, 'utf8') : null;
  if (!body) {
    issues.push(`${file} was not built`);
    continue;
  }
  for (const m of must) flag(!body.includes(m), `${file} missing: ${m}`);
}

/* Showcase invariants. Slugs come from the content directory so this holds as
   the showcase changes: a hidden project must have no page, a shown one must,
   and client work must carry no outbound link that would identify it. */
const projects = collection('projects');
const published = projects.filter((p) => !p.hidden && !p.draft);
for (const p of projects) {
  const exists = globSync(`dist/work/${p.slug}/index.html`).length > 0;
  flag(p.hidden && exists, `hidden project /work/${p.slug} was built`);
  flag(!p.hidden && !p.draft && !exists, `showcased project /work/${p.slug} was not built`);
  flag(p.kind === 'Client work' && /^(repo|demo):/m.test(p.raw), `${p.file} is client work but links out`);
}

// The Writing section exists only when something is published in it.
const hasPosts = collection('posts').some((p) => !p.aiWritten && !p.draft);
const home = pages.find((p) => p.route === '/index.html').html;
const navHasWriting = /<a[^>]+href="\/writing\/?"/.test(home);
flag(navHasWriting !== hasPosts, `nav ${navHasWriting ? 'shows' : 'hides'} Writing; posts exist: ${hasPosts}`);
flag(
  !hasPosts && readFileSync('dist/sitemap-0.xml', 'utf8').includes('/writing/</loc>'),
  'empty /writing is listed in the sitemap',
);

/* A project heading and its detail page share a view-transition name, or the
   browser cross-fades where it should morph. */
const work = pages.find((p) => p.route === '/work/index.html').html;
const names = [...work.matchAll(/view-transition-name:(project-[\w-]+)/g)].map((m) => m[1]);
flag(names.length !== published.length, `${names.length} of ${published.length} work cards carry a transition name`);
for (const name of names) {
  const slug = name.replace(/^project-/, '');
  const detail = globSync(`dist/work/${slug}/index.html`);
  if (!detail.length) {
    issues.push(`/work/${slug} was not built`);
    continue;
  }
  const html = readFileSync(detail[0], 'utf8');
  flag(!new RegExp(`<h1[^>]*view-transition-name:${name}`).test(html), `/work/${slug} h1 lacks ${name}`);
}

issues.report();
