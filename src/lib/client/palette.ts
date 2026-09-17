import { byId } from './dom';

/** One row: a link, or an action the palette performs itself. */
interface Entry {
  label: string;
  section: string;
  href?: string;
  hint?: string;
  keywords?: string;
  external?: boolean;
  action?: 'theme' | 'copy-email';
}

interface Data {
  entries: Entry[];
  /** `g` then this key jumps to that path. */
  goto: Record<string, string>;
  email: string;
}

/**
 * Subsequence match: every character of the query must appear in order.
 * Contiguous runs and matches on the visible label score higher, so typing
 * "mon" puts Monee above anything that merely mentions money.
 */
function score(entry: Entry, q: string) {
  if (!q) return 1;
  const label = entry.label.toLowerCase();
  if (label.startsWith(q)) return 1000;
  if (label.includes(q)) return 700;
  const haystack = `${label} ${entry.section} ${entry.hint ?? ''} ${entry.keywords ?? ''}`.toLowerCase().trim();
  let i = 0;
  let points = 0;
  let streak = 0;
  for (const ch of haystack) {
    if (ch !== q[i]) {
      streak = 0;
      continue;
    }
    i += 1;
    streak += 1;
    points += streak;
    if (i === q.length) break;
  }
  return i === q.length ? points : 0;
}

export function commandPalette() {
  const data = byId('cmdk-data');
  const dialog = byId<HTMLDialogElement>('cmdk');
  const input = byId<HTMLInputElement>('cmdk-input');
  const list = byId('cmdk-list');
  const tpl = byId<HTMLTemplateElement>('cmdk-row');
  if (!data || !dialog || !input || !list || !tpl || typeof dialog.showModal !== 'function') return;
  const { entries, goto, email }: Data = JSON.parse(data.textContent ?? '{}');
  const empty = byId('cmdk-empty');
  let rows: { el: HTMLElement; link: HTMLAnchorElement }[] = [];
  let cursor = 0;
  let lastFocus: Element | null = null;

  function select(next: number) {
    if (!rows.length) return;
    cursor = (next + rows.length) % rows.length;
    rows.forEach((row, i) => row.el.setAttribute('aria-selected', String(i === cursor)));
    const el = rows[cursor].el;
    el.scrollIntoView({ block: 'nearest' });
    if (el.id) input!.setAttribute('aria-activedescendant', el.id);
  }

  /** What the palette can do besides navigate. */
  const ACTIONS: Record<string, () => void> = {
    theme: () => byId('theme-toggle')?.click(),
    'copy-email': async () => {
      let ok = false;
      try {
        await navigator.clipboard.writeText(email);
        ok = true;
      } catch {
        /* no clipboard, or permission refused: show the address instead */
      }
      const hint = rows[cursor]?.el.querySelector('.cmdk-hint');
      if (hint) hint.textContent = ok ? 'Copied' : email;
      setTimeout(close, 550);
    },
  };

  function render() {
    const q = input!.value.trim().toLowerCase();
    const matches = entries.map((entry) => ({ entry, s: score(entry, q) })).filter((m) => m.s > 0);
    // With nothing typed the list keeps its authored order, so the section
    // headings stay contiguous. Ranking only applies to a search.
    if (q) matches.sort((a, b) => b.s - a.s || a.entry.label.localeCompare(b.entry.label));
    list!.replaceChildren();
    rows = [];
    let section: string | null = null;
    matches.forEach(({ entry }, i) => {
      if (!q && entry.section !== section) {
        section = entry.section;
        const head = document.createElement('li');
        head.className = 'cmdk-group';
        head.setAttribute('role', 'presentation');
        head.textContent = section;
        list!.append(head);
      }
      const node = tpl!.content.firstElementChild!.cloneNode(true) as HTMLElement;
      node.id = `cmdk-row-${i}`;
      const link = node.querySelector('a')!;
      node.querySelector('.cmdk-label')!.textContent = entry.label;
      node.querySelector('.cmdk-hint')!.textContent = entry.hint ?? '';
      if (entry.href) {
        link.href = entry.href;
        if (entry.external) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
      } else {
        link.setAttribute('role', 'button');
        link.tabIndex = -1;
      }
      link.addEventListener('click', (event) => {
        if (!entry.action) return close();
        event.preventDefault();
        ACTIONS[entry.action]?.();
      });
      node.addEventListener('mousemove', () => select(rows.findIndex((r) => r.el === node)));
      list!.append(node);
      rows.push({ el: node, link });
    });
    if (empty) empty.hidden = rows.length > 0;
    select(0);
  }

  function open() {
    if (dialog!.open) return;
    lastFocus = document.activeElement;
    input!.value = '';
    render();
    dialog!.showModal();
    // Locking the root keeps the page behind from scrolling on iOS.
    document.documentElement.style.overflow = 'hidden';
    input!.focus();
  }

  function close() {
    dialog!.close();
  }
  dialog.addEventListener('close', () => {
    document.documentElement.style.overflow = '';
    if (lastFocus instanceof HTMLElement) lastFocus.focus();
  });
  // Clicking the backdrop lands on the dialog itself, never on its content.
  dialog.addEventListener('click', (event) => event.target === dialog && close());
  input.addEventListener('input', render);

  /** Arrow keys and Enter, as a table rather than a ladder of comparisons. */
  const MOVES: Record<string, () => void> = {
    ArrowDown: () => select(cursor + 1),
    ArrowUp: () => select(cursor - 1),
    Home: () => select(0),
    End: () => select(rows.length - 1),
    Enter: () => rows[cursor]?.link.click(),
  };
  input.addEventListener('keydown', (event) => {
    const move = MOVES[event.key];
    if (!move) return;
    event.preventDefault();
    move();
  });
  byId('cmdk-open')?.addEventListener('click', open);

  /* Global keys: ⌘K anywhere, and single letters when nothing else has the
     keyboard. `g` arms a jump for the next keypress. */
  const typing = (el: EventTarget | null) =>
    el instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);
  let chord = 0;
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      return dialog.open ? close() : open();
    }
    if (dialog.open || event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) {
      return;
    }
    const key = event.key.toLowerCase();
    if (chord && Date.now() - chord < 1200) {
      chord = 0;
      const path = goto[key];
      if (path) {
        event.preventDefault();
        location.href = path;
        return;
      }
    }
    chord = key === 'g' ? Date.now() : 0;
    if (key === 'g') return;
    if (key === '/') {
      event.preventDefault();
      open();
    } else if (key === 't') {
      byId('theme-toggle')?.click();
    }
  });
}
