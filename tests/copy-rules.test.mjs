/**
 * The AGENTS.md copy rules for the files agentlint cannot parse.
 *
 * agentlint (.agentlint/config.ts) reads JavaScript, TypeScript and JSON. Everything else the repository
 * tracks (Astro, Markdown, MDX, CSS, HTML, YAML, SVG and the rest) is read here, line by line.
 *
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

/** agentlint's grammars: these files are its job. */
const PARSED = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json']);
const BINARY = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.avif', '.woff', '.woff2', '.pdf']);

/** The character, its JS, CSS and HTML spellings. */
const EM_DASH = /—|\\u\{?2014\}?|\\2014|&mdash;|&#8212;|&#x2014;/i;
/** A middle dot between spaces, as the character or its entity. */
const MIDDLE_DOT = /\s(?:·|&middot;|&#183;)\s/gi;

const root = new URL('..', import.meta.url);
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\0')
  .filter((file) => file && !PARSED.has(extname(file)) && !BINARY.has(extname(file).toLowerCase()))
  .map((file) => ({ file, lines: readFileSync(new URL(file, root), 'utf8').split('\n') }));

const hits = (match) =>
  files.flatMap(({ file, lines }) => lines.flatMap((line, i) => (match(file, line) ? [`${file}:${i + 1}`] : [])));

test('no em dashes outside the files agentlint parses', () => {
  assert.deepEqual(
    hits((_, line) => EM_DASH.test(line)),
    [],
  );
});

test('no meta strings joined with middle dots in Astro markup', () => {
  assert.deepEqual(
    hits((file, line) => file.endsWith('.astro') && (line.match(MIDDLE_DOT) ?? []).length >= 2),
    [],
  );
});
