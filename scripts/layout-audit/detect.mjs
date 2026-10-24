// Layout audit: the in-page collector and the pure analysis behind `npm run audit:layout`.
//
// `collectLayout` runs inside the browser (Playwright serialises it, so it must stay self-contained: no imports,
// no closures over module scope). It measures the page and returns plain data. `analyzeLayout` turns that data
// into findings and is pure, so `detect.test.ts` covers it without a browser.
//
// Opt-outs, for the few places where content runs past its box on purpose:
//   data-audit-clip-ok   on a clipping container whose children may extend past it (a marquee, a carousel);
//                        its content is also left out of the page's left edge.
//   data-audit-ignore    on an element whose subtree the audit skips entirely.

/**
 * @typedef {{ l: number, t: number, r: number, b: number }} Box
 * @typedef {{
 *   i: number, parent: number, label: string, rect: Box, vis: Box | null,
 *   decorative: boolean, layer: number, inHScroll: boolean,
 *   clip: number, clipOk: boolean, interactive: boolean, control: boolean,
 *   textX: number, textY: number, lineHeight: number, truncated: boolean,
 *   abs: boolean, pad: { l: number, r: number } | null, flow: boolean, painted: boolean, contain: boolean, ellipsis: boolean,
 * }} Node
 * @typedef {{
 *   label: string, left: number, right: number, inkLeft: number, inkRight: number,
 *   parentLeft?: number, parentRight?: number,
 * }} Block
 * @typedef {{ label: string, centers: { label: string, center: number }[] }} Row
 * @typedef {{
 *   viewport: { w: number, h: number },
 *   doc: { scrollWidth: number, clientWidth: number },
 *   nodes: Node[], blocks: Block[], rows: Row[],
 * }} Snapshot
 * @typedef {{ kind: string, label: string, detail: string }} Finding
 */

/** Measure the page. Runs in the browser. @returns {Snapshot} */
export function collectLayout() {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  /** @type {Map<Element, number>} */
  const index = new Map();
  /** @type {any[]} */
  const nodes = [];
  const box = (/** @type {DOMRect} */ r) => ({ l: r.left, t: r.top + scrollY, r: r.right, b: r.bottom + scrollY });
  const isClip = (/** @type {string} */ v) => v === 'hidden' || v === 'clip';
  const isScroll = (/** @type {string} */ v) => v === 'auto' || v === 'scroll';
  const label = (/** @type {Element} */ el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const aria = el.getAttribute('aria-label');
    if (aria) s += `[aria-label="${aria.slice(0, 30)}"]`;
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3) : [];
    if (cls.length && cls[0]) s += '.' + cls.join('.');
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 32);
    if (text) s += ` "${text}"`;
    return s;
  };
  const CLEAR = /rgba\([^)]*,\s*0\)$/;
  /** Whether the element paints something of its own: media, a fill, a frame. */
  const paints = (/** @type {Element} */ el, /** @type {CSSStyleDeclaration} */ cs) => {
    const tag = el.tagName.toLowerCase();
    if (['img', 'svg', 'video', 'canvas', 'picture'].includes(tag)) return true;
    const bg = cs.backgroundColor;
    if (bg && bg !== 'transparent' && !CLEAR.test(bg)) return true;
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
    for (const side of ['Left', 'Right', 'Top', 'Bottom']) {
      const w = parseFloat(cs.getPropertyValue(`border-${side.toLowerCase()}-width`));
      const style = cs.getPropertyValue(`border-${side.toLowerCase()}-style`);
      const color = cs.getPropertyValue(`border-${side.toLowerCase()}-color`);
      if (w > 0 && style !== 'none' && !CLEAR.test(color)) return true;
    }
    return false;
  };
  const INTERACTIVE =
    "a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=link],[role=switch],[role=checkbox],[role=combobox],[tabindex]:not([tabindex='-1'])";
  const CONTROL =
    'button,input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea,[role=button],[role=combobox],[role=tab]';

  /** @type {{el: Element, parent: number, decorative: boolean, layer: number, inHScroll: boolean, clip: number, clipOk: boolean, visClip: Box | null, parentBox: boolean}[]} */
  const stack = [];
  const walk = (
    /** @type {Element} */ el,
    /** @type {number} */ parent,
    /** @type {boolean} */ decorative,
    /** @type {number} */ layer,
    /** @type {boolean} */ inHScroll,
    /** @type {number} */ clip,
    /** @type {boolean} */ clipOk,
    /** @type {Box | null} */ visClip,
    /** @type {boolean} */ parentBox,
  ) => {
    stack.push({ el, parent, decorative, layer, inHScroll, clip, clipOk, visClip, parentBox });
  };
  for (const child of Array.from(document.body.children)) walk(child, -1, false, -1, false, -1, false, null, false);
  while (stack.length) {
    const item = /** @type {NonNullable<ReturnType<typeof stack.pop>>} */ (stack.pop());
    const { el } = item;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'template' || tag === 'astro-dev-toolbar')
      continue;
    if (el.hasAttribute('data-audit-ignore')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none') continue;
    const visible =
      typeof el.checkVisibility === 'function'
        ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
        : cs.visibility !== 'hidden';
    const r = el.getBoundingClientRect();
    const srOnly = cs.position === 'absolute' && r.width <= 1 && r.height <= 1;
    const clippedAway =
      (cs.clipPath !== 'none' && cs.clipPath.includes('inset(50%')) || (cs.clip && cs.clip !== 'auto');
    const decorative =
      item.decorative ||
      el.getAttribute('aria-hidden') === 'true' ||
      ((cs.position === 'absolute' || cs.position === 'fixed') &&
        cs.pointerEvents === 'none' &&
        !(el.textContent || '').trim());
    const layer = cs.position === 'fixed' || cs.position === 'sticky' ? nodes.length : item.layer;
    const i = nodes.length;
    index.set(el, i);
    const rect = box(r);
    const vis = item.visClip
      ? {
          l: Math.max(rect.l, item.visClip.l),
          t: Math.max(rect.t, item.visClip.t),
          r: Math.min(rect.r, item.visClip.r),
          b: Math.min(rect.b, item.visClip.b),
        }
      : rect;
    const shown = visible && !srOnly && !clippedAway && r.width > 0 && r.height > 0;
    let ownText = false;
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType === 3 && (n.textContent || '').trim()) ownText = true;
    }
    const overflowVisible = cs.overflowX === 'visible' && cs.overflowY === 'visible';
    const inline = cs.display === 'inline' || cs.display === 'contents';
    // Scroll overflow alone also counts an enlarged hit area (a `::after` with negative insets), which is not
    // text: a spill counts only as far as the element's own text runs actually reach past its box.
    let textX = 0;
    let textY = 0;
    if (ownText && overflowVisible && !inline) {
      const inL = r.left + el.clientLeft;
      const inT = r.top + el.clientTop;
      let runX = 0;
      let runY = 0;
      for (const n of Array.from(el.childNodes)) {
        if (n.nodeType !== 3 || !(n.textContent || '').trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const tr of Array.from(range.getClientRects())) {
          runX = Math.max(runX, tr.right - (inL + el.clientWidth), inL - tr.left);
          runY = Math.max(runY, tr.bottom - (inT + el.clientHeight));
        }
      }
      textX = Math.round(Math.min(el.scrollWidth - el.clientWidth, runX));
      textY = Math.round(Math.min(el.scrollHeight - el.clientHeight, runY));
    }
    const truncated = ownText && cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1;
    const fontSize = parseFloat(cs.fontSize) || 16;
    const lineHeight = cs.lineHeight === 'normal' ? fontSize * 1.2 : parseFloat(cs.lineHeight) || fontSize * 1.2;
    const field = tag === 'input' || tag === 'textarea' || tag === 'select';
    nodes.push({
      i,
      parent: item.parent,
      label: label(el),
      rect,
      vis: shown && vis.r > vis.l && vis.b > vis.t ? vis : null,
      decorative,
      layer,
      inHScroll: item.inHScroll,
      clip: item.clip,
      clipOk: item.clipOk,
      interactive: shown && el.matches(INTERACTIVE),
      control: shown && el.matches(CONTROL),
      textX,
      textY,
      lineHeight,
      truncated,
      abs: cs.position === 'absolute',
      pad: field ? { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0 } : null,
      flow: item.parentBox && !inline && cs.position !== 'absolute' && cs.position !== 'fixed',
      painted: shown && paints(el, cs),
      // Deliberate truncation: what a `truncate` or line clamp hides is meant to be hidden.
      ellipsis: cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp !== undefined && cs.webkitLineClamp !== 'none'),
      contain: false,
    });
    if (tag === 'svg') continue;
    const clipsX = isClip(cs.overflowX);
    const clipsY = isClip(cs.overflowY);
    const scrollsX = isScroll(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
    const scrollsY = isScroll(cs.overflowY);
    const clipsHere = (clipsX || clipsY) && el !== document.body && el !== document.documentElement;
    nodes[i].contain = clipsHere || scrollsX || scrollsY;
    let visClip = item.visClip;
    if (clipsHere || scrollsX || scrollsY || cs.contain.includes('paint')) {
      const c = rect;
      visClip = visClip
        ? {
            l: Math.max(c.l, visClip.l),
            t: Math.max(c.t, visClip.t),
            r: Math.min(c.r, visClip.r),
            b: Math.min(c.b, visClip.b),
          }
        : c;
    }
    const children = Array.from(el.children);
    for (let k = children.length - 1; k >= 0; k--) {
      walk(
        children[k],
        i,
        decorative,
        layer,
        item.inHScroll || scrollsX || scrollsY,
        clipsHere ? i : scrollsX || scrollsY ? -1 : item.clip,
        clipsHere ? el.hasAttribute('data-audit-clip-ok') : item.clipOk,
        visClip,
        // A child is measured against this box only when it is a real block box that does not scroll.
        !inline && !scrollsX && !scrollsY && el !== document.body && el !== document.documentElement,
      );
    }
  }

  // Top-level blocks: the children of <main>, descending through lone wrappers.
  const main = document.querySelector('main') || document.body;
  const shownBlock = (/** @type {Element} */ el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.position === 'fixed' || cs.position === 'absolute') return false;
    if (el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('data-audit-ignore')) return false;
    if (cs.display === 'contents') return true;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const flatten = (/** @type {Element[]} */ els) =>
    els.flatMap((el) =>
      getComputedStyle(el).display === 'contents' ? Array.from(el.children).filter(shownBlock) : [el],
    );
  let blockEls = flatten(Array.from(main.children).filter(shownBlock));
  for (let guard = 0; blockEls.length === 1 && guard < 6; guard++) {
    const kids = flatten(Array.from(blockEls[0].children).filter(shownBlock));
    if (kids.length < 1) break;
    blockEls = kids;
  }
  // The page's own box: the element holding the blocks (or the first ancestor with a box when that is
  // `display: contents`).
  let pageEl = /** @type {Element} */ ((blockEls[0] && blockEls[0].parentElement) || main);
  while (pageEl.parentElement && getComputedStyle(pageEl).display === 'contents') pageEl = pageEl.parentElement;
  const pageBox = pageEl.getBoundingClientRect();
  const inkOf = (/** @type {Element} */ root) => {
    let l = Infinity;
    let rr = -Infinity;
    /** @param {Element} el @param {{ l: number, r: number }} cl the horizontal clip inherited from ancestors */
    const visit = (el, cl) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      // aria-hidden icons are ink; out-of-flow decoration (glows, blooms) is not.
      const outOfFlow = cs.position === 'absolute' || cs.position === 'fixed';
      if (outOfFlow && (cs.pointerEvents === 'none' || el.getAttribute('aria-hidden') === 'true')) return;
      if (cs.position === 'fixed') return;
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) {
        if (cs.display !== 'contents') return;
      }
      // A band across the whole page (a filter strip's fill and rule) is a background, not where the content
      // starts.
      const band = r.left <= pageBox.left + 1 && r.right >= pageBox.right - 1;
      const sl = Math.max(r.left, cl.l);
      const sr = Math.min(r.right, cl.r);
      if (paints(el, cs) && !band && sr > sl) {
        l = Math.min(l, sl);
        rr = Math.max(rr, sr);
      }
      // What a marquee or carousel scrolls through is not where the page's content starts.
      if (el.tagName.toLowerCase() === 'svg' || el.hasAttribute('data-audit-clip-ok')) return;
      const clips = isScroll(cs.overflowX) || isClip(cs.overflowX);
      const inner = clips && cs.display !== 'contents' ? { l: Math.max(cl.l, r.left), r: Math.min(cl.r, r.right) } : cl;
      for (const n of Array.from(el.childNodes)) {
        if (n.nodeType === 3 && (n.textContent || '').trim()) {
          const range = document.createRange();
          range.selectNodeContents(n);
          for (const tr of Array.from(range.getClientRects())) {
            const tl = Math.max(tr.left, inner.l);
            const tright = Math.min(tr.right, inner.r);
            if (tright - tl < 1) continue;
            l = Math.min(l, tl);
            rr = Math.max(rr, tright);
          }
        } else if (n.nodeType === 1) {
          visit(/** @type {Element} */ (n), inner);
        }
      }
    };
    visit(root, { l: -Infinity, r: Infinity });
    return { l, r: rr };
  };
  const blocks = blockEls
    .map((el) => {
      const r = el.getBoundingClientRect();
      let frame = el.parentElement || el;
      while (frame.parentElement && getComputedStyle(frame).display === 'contents') frame = frame.parentElement;
      const pr = frame.getBoundingClientRect();
      const ink = inkOf(el);
      return {
        label: label(el),
        left: r.left,
        right: r.right,
        parentLeft: pr.left,
        parentRight: pr.right,
        inkLeft: ink.l,
        inkRight: ink.r,
      };
    })
    .filter((b) => Number.isFinite(b.inkLeft));

  // Rows of controls: flex rows whose control children share a line.
  /** @type {Row[]} */
  const rows = [];
  for (const el of Array.from(document.querySelectorAll('*'))) {
    const cs = getComputedStyle(el);
    if (!(cs.display === 'flex' || cs.display === 'inline-flex') || !cs.flexDirection.startsWith('row')) continue;
    if (el.closest('[aria-hidden=true],[data-audit-ignore]')) continue;
    const controls = Array.from(el.children).filter((c) => {
      if (!c.matches(CONTROL) && !c.querySelector(':scope > ' + CONTROL.split(',').join(',:scope > '))) return false;
      const r = c.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(c).position !== 'absolute';
    });
    if (controls.length < 2) continue;
    const measured = controls.map((c) => {
      const r = c.getBoundingClientRect();
      return { label: label(c), top: r.top, bottom: r.bottom, center: (r.top + r.bottom) / 2 };
    });
    // Compare only controls on the first line (a wrapping row starts a new line).
    const first = measured.filter((m) => m.top < measured[0].bottom && m.bottom > measured[0].top);
    if (first.length >= 2)
      rows.push({ label: label(el), centers: first.map((m) => ({ label: m.label, center: m.center })) });
  }

  return {
    viewport: { w: vw, h: vh },
    doc: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
    nodes,
    blocks,
    rows,
  };
}

const TOL = 1;

/**
 * Turn a snapshot into findings. Pure.
 * @param {Snapshot} snap
 * @returns {{ findings: Finding[], truncated: string[] }}
 */
export function analyzeLayout(snap) {
  /** @type {Finding[]} */
  const findings = [];
  const { nodes } = snap;
  const vw = snap.viewport.w;

  if (snap.doc.scrollWidth > snap.doc.clientWidth + TOL) {
    findings.push({
      kind: 'page-overflow',
      label: 'html',
      detail: `page scrolls sideways by ${Math.round(snap.doc.scrollWidth - snap.doc.clientWidth)}px`,
    });
  }

  /** @type {Set<number>} */
  const flaggedViewport = new Set();
  /** @type {Set<number>} */
  const flaggedClip = new Set();
  for (const n of nodes) {
    if (!n.vis || n.decorative) continue;
    const parentFlaggedV = n.parent >= 0 && flaggedViewport.has(n.parent);
    if (!n.inHScroll && (n.vis.r > vw + TOL || n.vis.l < -TOL)) {
      flaggedViewport.add(n.i);
      if (!parentFlaggedV) {
        const past =
          n.vis.r > vw + TOL
            ? `${Math.round(n.vis.r - vw)}px past the right edge`
            : `${Math.round(-n.vis.l)}px past the left edge`;
        findings.push({ kind: 'viewport-overflow', label: n.label, detail: past });
      }
    }
  }
  for (const n of nodes) {
    if (n.decorative || n.clip < 0 || n.clipOk) continue;
    if (n.rect.r - n.rect.l <= 0 || n.rect.b - n.rect.t <= 0) continue;
    const c = nodes[n.clip];
    if (!c || !c.vis || c.ellipsis) continue;
    const out = Math.max(c.rect.l - n.rect.l, n.rect.r - c.rect.r, c.rect.t - n.rect.t, n.rect.b - c.rect.b);
    if (out > TOL + 1) {
      flaggedClip.add(n.i);
      if (n.parent >= 0 && flaggedClip.has(n.parent)) continue;
      findings.push({ kind: 'clipped', label: n.label, detail: `cut off ${Math.round(out)}px by ${c.label}` });
    }
  }

  // Painted, in-flow content outside an ancestor's box: a negative margin, a fixed width or a flex item that
  // will not shrink pokes out of its container even when nothing clips it. A transparent hit area (a ghost
  // back button pulled into the gutter) is not measured: only what paints.
  /** @type {Set<number>} */
  const flaggedPoke = new Set();
  for (const n of nodes) {
    if (!n.vis || n.decorative || !n.painted || !n.flow || n.inHScroll) continue;
    if (flaggedViewport.has(n.i) || flaggedClip.has(n.i)) continue;
    let ancestorFlagged = false;
    for (let a = n.parent; a >= 0; a = nodes[a].parent) if (flaggedPoke.has(a)) ancestorFlagged = true;
    if (ancestorFlagged) continue;
    for (let cur = n; cur.flow && cur.parent >= 0; cur = nodes[cur.parent]) {
      const p = nodes[cur.parent];
      const out = Math.max(p.rect.l - n.rect.l, n.rect.r - p.rect.r);
      if (out > TOL + 1) {
        flaggedPoke.add(n.i);
        findings.push({ kind: 'pokes-out', label: n.label, detail: `${Math.round(out)}px outside ${p.label}` });
        break;
      }
      if (p.contain) break;
    }
  }

  /** @type {string[]} */
  const truncated = [];
  for (const n of nodes) {
    if (!n.vis || n.decorative) continue;
    if (n.textX > TOL)
      findings.push({ kind: 'text-overflow', label: n.label, detail: `text spills ${n.textX}px sideways` });
    // Display type with a line height under 1 lets glyphs rise past the box by design: only a spill of half a
    // line or more is text that does not fit.
    else if (n.textY > Math.max(TOL + 1, n.lineHeight / 2))
      findings.push({ kind: 'text-overflow', label: n.label, detail: `text spills ${n.textY}px below` });
    if (n.truncated) truncated.push(n.label);
  }

  const inter = nodes.filter((n) => n.interactive && n.vis && !n.decorative);
  const ancestors = (/** @type {Node} */ n) => {
    const set = new Set();
    for (let p = n.parent; p >= 0; p = nodes[p].parent) set.add(p);
    return set;
  };
  const anc = new Map(inter.map((n) => [n.i, ancestors(n)]));
  for (let a = 0; a < inter.length; a++) {
    for (let b = a + 1; b < inter.length; b++) {
      const x = inter[a];
      const y = inter[b];
      if (x.layer !== y.layer) continue;
      if (anc.get(x.i)?.has(y.i) || anc.get(y.i)?.has(x.i)) continue;
      const xv = /** @type {Box} */ (x.vis);
      const yv = /** @type {Box} */ (y.vis);
      const w = Math.min(xv.r, yv.r) - Math.max(xv.l, yv.l);
      const h = Math.min(xv.b, yv.b) - Math.max(xv.t, yv.t);
      // An icon button inside a field (show password, clear search) is fine when the field pads its text clear.
      const inField = (/** @type {Node} */ f, /** @type {Node} */ o) =>
        f.pad && o.abs && o.rect.l >= f.rect.r - f.pad.r - TOL && o.rect.r <= f.rect.r + TOL
          ? true
          : !!(f.pad && o.abs && o.rect.r <= f.rect.l + f.pad.l + TOL && o.rect.l >= f.rect.l - TOL);
      if (inField(x, y) || inField(y, x)) continue;
      if (w > 2 && h > 2) {
        findings.push({
          kind: 'overlap',
          label: x.label,
          detail: `overlaps ${y.label} by ${Math.round(w)}x${Math.round(h)}px`,
        });
      }
    }
  }

  // Left edges of the top-level blocks. Centred blocks and side columns (more than 64px in) are left out.
  const lefts = snap.blocks
    .filter((b) => {
      const centred = (/** @type {number} */ l, /** @type {number} */ r) => {
        const inL = b.inkLeft - l;
        const inR = r - b.inkRight;
        return inL > 8 && Math.abs(inL - inR) < 4 && b.inkRight - b.inkLeft < 0.8 * (r - l);
      };
      return !centred(b.left, b.right) && !centred(b.parentLeft ?? b.left, b.parentRight ?? b.right);
    })
    .map((b) => ({ label: b.label, x: b.inkLeft }));
  if (lefts.length >= 2) {
    const min = Math.min(...lefts.map((b) => b.x));
    const off = lefts.filter((b) => b.x - min > 2 && b.x - min <= 64);
    for (const b of off) {
      findings.push({
        kind: 'edge',
        label: b.label,
        detail: `starts ${Math.round(b.x - min)}px right of the page's left edge`,
      });
    }
  }

  for (const row of snap.rows) {
    const cs = row.centers.map((c) => c.center);
    const spread = Math.max(...cs) - Math.min(...cs);
    if (spread > 2) {
      findings.push({
        kind: 'misaligned-row',
        label: row.label,
        detail: `control centres differ by ${Math.round(spread)}px`,
      });
    }
  }

  return { findings, truncated };
}
