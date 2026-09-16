/**
 * Generates the .excalidraw scenes in this directory.
 *
 *   node docs/diagrams/build.mjs
 *
 * Diagrams as code: the scenes are data, so they are regenerated rather than
 * redrawn when the architecture moves. Each output opens directly at
 * excalidraw.com (File → Open) and stays editable there.
 */
import { writeFile } from 'node:fs/promises';

/* The site's own palette, so the drawings and the thing they describe agree. */
const INK = '#16171a';
const MUTED = '#6b6d76';
const GOLD = '#a15c00';
const GOLD_BG = '#fdf0dc';
const JADE = '#1d7a52';
const JADE_BG = '#e3f3ec';
const PAPER = '#f4f1ea';
const BLUE = '#1e4a8a';
const BLUE_BG = '#e5edf8';

let seq = 0;
const id = () => `el${(seq += 1).toString(36).padStart(4, '0')}`;
const nonce = () => Math.floor(Math.random() * 2 ** 31);

/** Fields every element carries, so each helper only states what differs. */
const base = (over) => ({
  angle: 0,
  strokeColor: INK,
  backgroundColor: 'transparent',
  fillStyle: 'solid',
  strokeWidth: 1,
  strokeStyle: 'solid',
  roughness: 1,
  opacity: 100,
  groupIds: [],
  frameId: null,
  roundness: null,
  seed: nonce(),
  version: 1,
  versionNonce: nonce(),
  isDeleted: false,
  boundElements: [],
  updated: 1,
  link: null,
  locked: false,
  ...over,
});

const CHAR_W = 0.58; // rough advance width of the hand-drawn face, per px of size

/** A standalone line of text. */
export function text(x, y, value, { size = 16, color = INK, align = 'left', width } = {}) {
  const lines = String(value).split('\n');
  const w = width ?? Math.max(...lines.map((l) => l.length)) * size * CHAR_W;
  return base({
    id: id(),
    type: 'text',
    x,
    y,
    width: w,
    height: lines.length * size * 1.25,
    strokeColor: color,
    text: value,
    originalText: value,
    fontSize: size,
    fontFamily: 1,
    textAlign: align,
    verticalAlign: 'top',
    containerId: null,
    lineHeight: 1.25,
    autoResize: true,
  });
}

/** A labelled box. Returns [container, label] so arrows can bind to it. */
export function box(x, y, w, h, label, { fill = 'transparent', color = INK, size = 16 } = {}) {
  const container = base({
    id: id(),
    type: 'rectangle',
    x,
    y,
    width: w,
    height: h,
    strokeColor: color,
    backgroundColor: fill,
    roundness: { type: 3 },
  });
  const t = base({
    id: id(),
    type: 'text',
    x: x + 8,
    y: y + h / 2 - size * 0.62,
    width: w - 16,
    height: String(label).split('\n').length * size * 1.25,
    strokeColor: color,
    text: label,
    originalText: label,
    fontSize: size,
    fontFamily: 1,
    textAlign: 'center',
    verticalAlign: 'middle',
    containerId: container.id,
    lineHeight: 1.25,
    autoResize: false,
  });
  container.boundElements = [{ id: t.id, type: 'text' }];
  container.__label = t;
  return container;
}

/** Flattens boxes and their bound labels into the element list. */
export const flat = (els) =>
  els.flatMap((el) => {
    if (!el.__label) return [el];
    const { __label, ...rest } = el;
    return [rest, __label];
  });

/**
 * An arrow between two boxes, bound at both ends so it follows them when
 * either is dragged in the editor.
 */
export function arrow(
  from,
  to,
  { label, dashed = false, color = MUTED, gap = 6, offset = 0 } = {},
) {
  const fx = from.x + from.width / 2;
  const fy = from.y + from.height / 2;
  const tx = to.x + to.width / 2;
  const ty = to.y + to.height / 2;
  const horizontal = Math.abs(tx - fx) > Math.abs(ty - fy);

  // `offset` shifts the run sideways, so two arrows between the same pair do
  // not land on top of each other.
  const [sx, sy] = horizontal
    ? [tx > fx ? from.x + from.width + gap : from.x - gap, fy + offset]
    : [fx + offset, ty > fy ? from.y + from.height + gap : from.y - gap];
  const [ex, ey] = horizontal
    ? [tx > fx ? to.x - gap : to.x + to.width + gap, ty + offset]
    : [tx + offset, ty > fy ? to.y - gap : to.y + to.height + gap];

  const el = base({
    id: id(),
    type: 'arrow',
    x: sx,
    y: sy,
    width: Math.abs(ex - sx),
    height: Math.abs(ey - sy),
    strokeColor: color,
    strokeStyle: dashed ? 'dashed' : 'solid',
    points: [
      [0, 0],
      [ex - sx, ey - sy],
    ],
    lastCommittedPoint: null,
    startBinding: { elementId: from.id, focus: 0, gap },
    endBinding: { elementId: to.id, focus: 0, gap },
    startArrowhead: null,
    endArrowhead: 'arrow',
    elbowed: false,
  });

  from.boundElements = [...(from.boundElements ?? []), { id: el.id, type: 'arrow' }];
  to.boundElements = [...(to.boundElements ?? []), { id: el.id, type: 'arrow' }];

  const out = [el];
  if (label) {
    out.push(
      text((sx + ex) / 2 - label.length * 3.6, (sy + ey) / 2 - 20, label, {
        size: 12,
        color: MUTED,
      }),
    );
  }
  return out;
}

/** A section heading with a rule under it. */
export const heading = (x, y, title, subtitle) => [
  text(x, y, title, { size: 28 }),
  ...(subtitle ? [text(x, y + 36, subtitle, { size: 14, color: MUTED })] : []),
];

export const scene = (elements) => ({
  type: 'excalidraw',
  version: 2,
  source: 'https://smr.et — docs/diagrams/build.mjs',
  elements: flat(elements),
  appState: { gridSize: null, viewBackgroundColor: '#ffffff' },
  files: {},
});

export async function write(name, elements) {
  const out = new URL(`./${name}.excalidraw`, import.meta.url);
  await writeFile(out, JSON.stringify(scene(elements), null, 2) + '\n');
  console.log(`${name}.excalidraw  ${flat(elements).length} elements`);
}

export const palette = { INK, MUTED, GOLD, GOLD_BG, JADE, JADE_BG, PAPER, BLUE, BLUE_BG };
