import { $$, byId, dialogOpen, isEditable, mayShortcut } from './dom';

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
  const status = byId('cmdk-status');
  let rows: { el: HTMLElement; entry: Entry }[] = [];
  let cursor = 0;
  let lastFocus: Element | null = null;

  /* One polite message at a time, a beat after typing stops, so a screen
     reader is not handed a count for every keystroke. */
  let saying = 0;
  function say(message: string, wait = 0) {
    clearTimeout(saying);
    saying = window.setTimeout(() => status && (status.textContent = message), wait);
  }

  function select(next: number) {
    if (!rows.length) {
      input!.removeAttribute('aria-activedescendant');
      return;
    }
    cursor = (next + rows.length) % rows.length;
    rows.forEach((row, i) => row.el.setAttribute('aria-selected', String(i === cursor)));
    const el = rows[cursor].el;
    el.scrollIntoView({ block: 'nearest' });
    input!.setAttribute('aria-activedescendant', el.id);
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
      say(ok ? 'Email address copied' : `Could not copy. The address is ${email}`);
      // On a failure the address stays up to be read or copied by hand.
      if (ok) setTimeout(close, 550);
    },
  };

  /**
   * Rows are not links (see the template), so opening one is done here. A
   * modifier or the middle button opens a new tab, as a link would.
   */
  function activate(entry: Entry, event?: MouseEvent | KeyboardEvent) {
    if (entry.action) return ACTIONS[entry.action]?.();
    if (!entry.href) return;
    const newTab = !!event && (event.metaKey || event.ctrlKey || ('button' in event && event.button === 1));
    if (newTab || entry.external) {
      window.open(entry.href, '_blank', 'noopener,noreferrer');
      // A background tab leaves the palette where it was.
      if (!newTab) close();
      return;
    }
    close();
    location.href = entry.href;
  }

  function render() {
    const q = input!.value.trim().toLowerCase();
    const matches = entries.map((entry) => ({ entry, s: score(entry, q) })).filter((m) => m.s > 0);
    // With nothing typed the list keeps its authored order, so the section
    // headings stay contiguous. Ranking only applies to a search.
    if (q) matches.sort((a, b) => b.s - a.s || a.entry.label.localeCompare(b.entry.label));
    list!.replaceChildren();
    rows = [];
    let section: string | null = null;
    let parent: HTMLElement = list!;
    matches.forEach(({ entry }, i) => {
      if (!q && entry.section !== section) {
        section = entry.section;
        // A group named by its heading, so the section is read with the option.
        const group = document.createElement('div');
        group.setAttribute('role', 'group');
        const head = document.createElement('div');
        head.className = 'cmdk-group';
        head.id = `cmdk-group-${i}`;
        head.textContent = section;
        group.setAttribute('aria-labelledby', head.id);
        group.append(head);
        list!.append(group);
        parent = group;
      }
      const node = tpl!.content.firstElementChild!.cloneNode(true) as HTMLElement;
      node.id = `cmdk-row-${i}`;
      node.querySelector('.cmdk-label')!.textContent = entry.label;
      node.querySelector('.cmdk-hint')!.textContent = entry.hint ?? '';
      node.addEventListener('click', (event) => activate(entry, event));
      node.addEventListener('auxclick', (event) => event.button === 1 && activate(entry, event));
      // Keeps the middle button from starting autoscroll instead.
      node.addEventListener('mousedown', (event) => event.button === 1 && event.preventDefault());
      node.addEventListener('mousemove', () => select(rows.findIndex((r) => r.el === node)));
      parent.append(node);
      rows.push({ el: node, entry });
    });
    if (empty) empty.hidden = rows.length > 0;
    select(0);
  }

  function open() {
    if (dialog!.open) return;
    lastFocus = document.activeElement;
    input!.value = '';
    say('');
    render();
    dialog!.showModal();
    // Locking the root keeps the page behind from scrolling on iOS.
    document.documentElement.style.overflow = 'hidden';
    input!.focus();
  }

  function close() {
    clearTimeout(saying);
    dialog!.close();
  }
  dialog.addEventListener('close', () => {
    document.documentElement.style.overflow = '';
    if (lastFocus instanceof HTMLElement) lastFocus.focus();
  });
  // Clicking the backdrop lands on the dialog itself, never on its content.
  dialog.addEventListener('click', (event) => event.target === dialog && close());
  input.addEventListener('input', () => {
    render();
    say(rows.length ? `${rows.length} result${rows.length === 1 ? '' : 's'}` : 'Nothing matches that.', 400);
  });

  /** Arrow keys and Enter, as a table rather than a ladder of comparisons. */
  const MOVES: Record<string, (event: KeyboardEvent) => void> = {
    ArrowDown: () => select(cursor + 1),
    ArrowUp: () => select(cursor - 1),
    Home: () => select(0),
    End: () => select(rows.length - 1),
    Enter: (event) => rows[cursor] && activate(rows[cursor].entry, event),
  };
  input.addEventListener('keydown', (event) => {
    const move = MOVES[event.key];
    if (!move || event.isComposing) return;
    event.preventDefault();
    move(event);
  });
  for (const trigger of $$('[data-cmdk-open]')) trigger.addEventListener('click', open);

  /* Global keys: ⌘K anywhere but another field or dialog, and single letters
     only when focus is on the page itself (WCAG 2.1.4). `g` arms a jump for
     the next keypress. */
  let chord = 0;
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
      if (event.repeat || dialogOpen(dialog) || (isEditable(event.target) && event.target !== input)) return;
      event.preventDefault();
      return dialog.open ? close() : open();
    }
    // `/` sits behind Shift on some layouts; letters never do.
    if (!mayShortcut(event, { shift: event.key === '/' })) return;
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
