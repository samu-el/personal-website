import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { analyzeLayout } from './detect.mjs';

/** @typedef {{ l: number, t: number, r: number, b: number }} Box */

/** @param {number} i @param {Box} rect @param {Record<string, unknown>} [extra] */
function node(i, rect, extra = {}) {
  return {
    i,
    parent: -1,
    label: `n${i}`,
    rect,
    vis: rect,
    decorative: false,
    layer: -1,
    inHScroll: false,
    clip: -1,
    clipOk: false,
    interactive: false,
    control: false,
    textX: 0,
    textY: 0,
    lineHeight: 20,
    truncated: false,
    abs: false,
    pad: null,
    flow: false,
    painted: false,
    contain: false,
    ellipsis: false,
    ...extra,
  };
}

/** @param {Record<string, unknown>} [over] @returns {any} */
function snap(over = {}) {
  return {
    viewport: { w: 400, h: 800 },
    doc: { scrollWidth: 400, clientWidth: 400 },
    nodes: [],
    blocks: [],
    rows: [],
    ...over,
  };
}

const kinds = (/** @type {any} */ s) => analyzeLayout(s).findings.map((f) => f.kind);

describe('analyzeLayout', () => {
  it('passes a page where everything fits', () => {
    const nodes = [node(0, { l: 0, t: 0, r: 400, b: 100 }), node(1, { l: 16, t: 10, r: 384, b: 90 }, { parent: 0 })];
    assert.deepEqual(kinds(snap({ nodes })), []);
  });

  it('flags a page that scrolls sideways', () => {
    assert.deepEqual(kinds(snap({ doc: { scrollWidth: 430, clientWidth: 400 } })), ['page-overflow']);
  });

  it('flags the outermost element past the viewport, not each descendant', () => {
    const nodes = [node(0, { l: 0, t: 0, r: 440, b: 100 }), node(1, { l: 0, t: 0, r: 440, b: 50 }, { parent: 0 })];
    assert.deepEqual(kinds(snap({ nodes })), ['viewport-overflow']);
  });

  it('ignores content inside a sideways scroller and decorative glows', () => {
    const nodes = [
      node(0, { l: 0, t: 0, r: 900, b: 50 }, { inHScroll: true }),
      node(1, { l: -40, t: 0, r: 440, b: 300 }, { decorative: true }),
    ];
    assert.deepEqual(kinds(snap({ nodes })), []);
  });

  it('flags a child cut off by its clipping container unless the container allows it', () => {
    const frame = node(0, { l: 0, t: 0, r: 300, b: 300 });
    const bench = node(1, { l: 0, t: 260, r: 300, b: 340 }, { parent: 0, clip: 0 });
    assert.deepEqual(kinds(snap({ nodes: [frame, bench] })), ['clipped']);
    assert.deepEqual(kinds(snap({ nodes: [frame, { ...bench, clipOk: true }] })), []);
    assert.deepEqual(kinds(snap({ nodes: [{ ...frame, ellipsis: true }, bench] })), []);
  });

  it("flags in-flow content that pokes out of its parent's box", () => {
    const frame = node(0, { l: 100, t: 0, r: 400, b: 300 });
    const wrap = node(1, { l: 60, t: 300, r: 380, b: 380 }, { parent: 0, flow: true });
    const bar = node(2, { l: 60, t: 300, r: 380, b: 340 }, { parent: 1, flow: true, painted: true });
    const glow = node(3, { l: 60, t: 0, r: 440, b: 300 }, { parent: 0, painted: true });
    const back = node(4, { l: 92, t: 0, r: 128, b: 36 }, { parent: 0, flow: true });
    const nodes = [frame, wrap, bar, glow, back];
    assert.deepEqual(
      analyzeLayout(snap({ viewport: { w: 1000, h: 800 }, nodes })).findings.map((f) => f.label),
      ['n2'],
    );
  });

  it('tells spilling text from tight display leading', () => {
    const tight = node(0, { l: 0, t: 0, r: 200, b: 80 }, { textY: 8, lineHeight: 80 });
    const spill = node(1, { l: 0, t: 0, r: 200, b: 20 }, { textY: 20, lineHeight: 20 });
    const wide = node(2, { l: 0, t: 0, r: 200, b: 20 }, { textX: 30 });
    assert.deepEqual(kinds(snap({ nodes: [tight] })), []);
    assert.deepEqual(kinds(snap({ nodes: [spill, wide] })), ['text-overflow', 'text-overflow']);
  });

  it('flags overlapping controls but not an icon button padded into its field', () => {
    const a = node(0, { l: 0, t: 0, r: 100, b: 40 }, { interactive: true });
    const b = node(1, { l: 90, t: 0, r: 190, b: 40 }, { interactive: true });
    assert.deepEqual(kinds(snap({ nodes: [a, b] })), ['overlap']);

    const field = node(0, { l: 0, t: 0, r: 200, b: 40 }, { interactive: true, pad: { l: 12, r: 40 } });
    const eye = node(1, { l: 164, t: 6, r: 192, b: 34 }, { interactive: true, abs: true });
    assert.deepEqual(kinds(snap({ nodes: [field, eye] })), []);
  });

  it('does not compare a fixed bar with the content scrolling under it', () => {
    const a = node(0, { l: 0, t: 760, r: 400, b: 800 }, { interactive: true, layer: 0 });
    const b = node(1, { l: 0, t: 770, r: 400, b: 790 }, { interactive: true });
    assert.deepEqual(kinds(snap({ nodes: [a, b] })), []);
  });

  it("flags a block off the page's left edge but not a centred one", () => {
    const blocks = [
      { label: 'header', left: 0, right: 400, inkLeft: 16, inkRight: 300 },
      { label: 'cards', left: 0, right: 400, inkLeft: 24, inkRight: 376 },
      { label: 'empty', left: 0, right: 400, inkLeft: 150, inkRight: 250 },
      { label: 'button', left: 140, right: 260, inkLeft: 140, inkRight: 260, parentLeft: 0, parentRight: 400 },
    ];
    const findings = analyzeLayout(snap({ blocks })).findings;
    assert.deepEqual(
      findings.map((f) => [f.kind, f.label]),
      [['edge', 'cards']],
    );
  });

  it('flags controls in one row that do not share a centre line', () => {
    const rows = [
      {
        label: 'ok',
        centers: [
          { label: 'a', center: 20 },
          { label: 'b', center: 20.5 },
        ],
      },
      {
        label: 'off',
        centers: [
          { label: 'a', center: 20 },
          { label: 'b', center: 26 },
        ],
      },
    ];
    assert.deepEqual(
      analyzeLayout(snap({ rows })).findings.map((f) => f.label),
      ['off'],
    );
  });
});
