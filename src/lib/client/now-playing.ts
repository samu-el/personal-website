import { byId } from './dom';
import { MIN_MS, nextPoll } from './schedule';
import { clock, since } from './time';

/**
 * Fills the "currently listening" card from the Worker at `endpoint`: playing
 * with a live bar, paused where it stopped, or the last track that finished.
 * No track hides the card; a failed read keeps what is on it. docs/architecture.md,
 * "Now playing".
 */

type State = 'playing' | 'paused' | 'recent';

interface Payload {
  playing?: boolean;
  state?: State;
  title?: string;
  artist?: string;
  album?: string;
  art?: string;
  url?: string;
  progressMs?: number;
  durationMs?: number;
  /** Epoch ms at which progressMs was read, so the bar can correct for age. */
  fetchedAt?: number;
  playedAt?: string;
  /** The Worker served a remembered answer because Spotify was unreachable. */
  stale?: boolean;
}

/** Bound on the staleness correction, so a badly set clock cannot peg the bar. */
const MAX_AGE_MS = 60000;
/** How long a good answer outlives failed reads — the Worker's own last-good window. */
const KEEP_MS = 10 * 60000;
/** A request that has not answered by now is abandoned and counted as a failure. */
const TIMEOUT_MS = 10000;
/** Remembers an empty answer, so the next visit does not reserve a card for nothing. */
const EMPTY_KEY = 'np-empty';

/** What the eyebrow says. A table, so adding a state is one line. */
const LABEL: Record<State, (data: Payload) => string> = {
  playing: () => 'Currently listening',
  paused: () => 'Paused',
  // "Last played" says when: a track that finished four hours ago and one
  // that finished a minute ago are different facts.
  recent: ({ playedAt }) => {
    const when = playedAt ? since(playedAt) : '';
    return when ? `Last played · ${when}` : 'Last played';
  },
};

export function nowPlaying() {
  const section = byId('now-playing');
  const endpoint = section?.dataset.endpoint;
  if (!section || !endpoint) return;

  const el = {
    link: byId<HTMLAnchorElement>('np-link'),
    title: byId('np-title'),
    artist: byId('np-artist'),
    art: byId<HTMLImageElement>('np-art'),
    sleeve: byId('np-sleeve'),
    eq: byId('np-eq'),
    state: byId('np-state'),
    progress: byId('np-progress'),
    bar: byId('np-bar'),
    elapsed: byId('np-elapsed'),
    duration: byId('np-duration'),
  };

  /* Where the bar is and when that was true. Progress is derived from these
     rather than stored, so a missed tick self-corrects on the next one. */
  let base = 0;
  let baseAt = 0;
  let total = 0;
  let ticker = 0;
  let timer = 0;
  let strikes = 0;
  let lastTitle = '';
  /** When the card last got an answer naming a track; 0 when it has none. */
  let goodAt = 0;
  /** The request on the wire, if any, and a counter that retires stale ones. */
  let inflight: AbortController | null = null;
  let seq = 0;
  /** When the last request went out, and when the schedule next wants one. */
  let askedAt = 0;
  let dueAt = 0;

  /* `loading` is entered before the first paint, and the inline script beside
     the markup has already decided whether the skeleton is showing. `empty`
     removes the card. */
  function setState(next: 'loading' | 'ready' | 'empty') {
    section!.dataset.state = next;
    if (next !== 'loading') section!.removeAttribute('aria-busy');
    if (next === 'ready') {
      el.link?.removeAttribute('aria-hidden');
      el.link?.removeAttribute('tabindex');
    }
    if (next !== 'loading') section!.hidden = next === 'empty';
    if (next !== 'loading') remember(next === 'empty');
  }

  function remember(empty: boolean) {
    try {
      if (empty) localStorage.setItem(EMPTY_KEY, '1');
      else localStorage.removeItem(EMPTY_KEY);
    } catch {
      // Storage blocked: every visit reserves the card, which is the safe default.
    }
  }

  function clear() {
    setState('empty');
    goodAt = 0;
    total = 0;
    stopTicker();
  }

  function stopTicker() {
    clearInterval(ticker);
    ticker = 0;
  }

  function renderProgress() {
    if (!total || !el.bar || !el.elapsed) return;
    const ms = Math.min(base + (Date.now() - baseAt), total);
    el.bar.style.width = `${((ms / total) * 100).toFixed(2)}%`;
    el.elapsed.textContent = clock(ms);
    // Ran off the end: the next poll knows what replaced it, and carrying on
    // would only be wrong faster.
    if (ms >= total) stopTicker();
  }

  /** Replaces any pending poll. Jittered, so open tabs do not line up. */
  function schedule(ms: number) {
    clearTimeout(timer);
    dueAt = Date.now() + ms;
    if (document.hidden) return;
    timer = window.setTimeout(poll, ms + Math.random() * 400);
  }

  function paint(data: Payload) {
    /* An older deployed Worker sends no state, so infer it — otherwise the
       card reads "Paused" over a playing track while the two are out of step. */
    const reported: State = data.state ?? (data.playing ? 'playing' : 'paused');
    // A remembered answer is not live, whatever it says: nobody knows the
    // track is still going, so no meter, no ticking bar, no "Currently".
    const state: State = data.stale && reported === 'playing' ? 'paused' : reported;
    const live = state === 'playing';
    if (el.title) el.title.textContent = data.title ?? '';
    if (el.artist) el.artist.textContent = data.artist ?? '';
    if (el.link && data.url) el.link.href = data.url;
    el.eq?.classList.toggle('is-still', !live);
    if (el.state) el.state.textContent = LABEL[state](data);
    paintArt(data);
    paintBar(data, state, live);
    lastTitle = data.title ?? '';
    setState('ready');
  }

  function paintArt({ art, album }: Payload) {
    if (!el.art) return;
    if (!art) {
      el.art.removeAttribute('src');
      el.art.style.opacity = '0';
      // An empty sleeve is the honest answer, not a grey block that looks
      // like it is still working.
      if (el.sleeve) el.sleeve.dataset.art = 'none';
      return;
    }
    if (el.art.src === art) return;
    // Fade in only once it has decoded, and retire the placeholder behind it
    // at the same moment.
    el.art.style.opacity = '0';
    el.art.src = art;
    el.art.alt = album ? `${album} — album art` : '';
    el.art.onload = () => {
      el.art!.style.opacity = '1';
      if (el.sleeve) el.sleeve.dataset.art = 'ready';
    };
  }

  function paintBar(data: Payload, state: State, live: boolean) {
    const duration = Number(data.durationMs);
    const at = Number(data.progressMs);
    // A finished track has no position, so there is no bar to draw. A paused
    // one does, and showing it frozen is the point.
    const drawable = el.bar && el.progress && state !== 'recent' && duration > 0 && Number.isFinite(at);
    if (!drawable) {
      total = 0;
      if (el.progress) el.progress.hidden = true;
      stopTicker();
      return;
    }

    /* Add back the time the reading sat at the edge. Clamped, because this
       subtracts the edge's clock from the visitor's. */
    const stamp = Number(data.fetchedAt);
    const age = live && Number.isFinite(stamp) ? Math.min(Math.max(Date.now() - stamp, 0), MAX_AGE_MS) : 0;
    // A new track must not glide backwards out of the old one's position.
    const jump = data.title !== lastTitle && el.bar;
    if (jump) el.bar!.style.transition = 'none';
    base = Math.min(at + age, duration);
    baseAt = Date.now();
    total = duration;
    if (el.duration) el.duration.textContent = clock(duration);
    el.progress!.hidden = false;
    renderProgress();
    if (jump) {
      // Commit the new width with no transition before handing it back, or
      // both land in one style pass and the bar animates the jump anyway.
      void el.bar!.offsetWidth;
      el.bar!.style.transition = '';
    }
    // A paused bar is rendered once and left alone: ticking it would advance
    // a track that is not moving.
    stopTicker();
    if (live) ticker = window.setInterval(() => document.hidden || renderProgress(), 1000);
  }

  async function poll() {
    // One at a time: a nudge while a request is out waits for its answer.
    if (inflight) return;
    clearTimeout(timer);
    const id = ++seq;
    const ctrl = (inflight = new AbortController());
    const limit = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    askedAt = Date.now();
    let data: Payload | null = null;
    let res: Response | null = null;
    try {
      /* no-store, or Cloudflare's Browser Cache TTL pins this for four hours.
         s-maxage survives that, so the edge still shields Spotify. */
      res = await fetch(endpoint!, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: ctrl.signal,
      });
      if (res.ok) data = await res.json();
    } catch {
      // Offline, blocked, timed out, or DNS still catching up.
    } finally {
      clearTimeout(limit);
      if (inflight === ctrl) inflight = null;
    }
    // Retired while out — the tab was hidden — so its answer is out of date.
    if (id !== seq) return;
    strikes = data ? 0 : strikes + 1;
    schedule(
      nextPoll({
        cacheControl: res?.headers.get('Cache-Control'),
        age: res?.headers.get('Age'),
        playing: data?.playing,
        stale: data?.stale,
        failures: strikes,
      }),
    );
    // A failed read says nothing about the music: keep the last good card
    // until it has aged out, and only give up on one that never had an answer.
    if (!data) {
      if (!goodAt || Date.now() - goodAt > KEEP_MS) clear();
      return;
    }
    // A title is the only requirement: paused and finished both count.
    if (!data.title) {
      clear();
      return;
    }
    goodAt = Date.now();
    paint(data);
  }

  /** Coming back asks now, unless the last ask was moments ago or it is backing off. */
  function nudge() {
    if (document.hidden || inflight) return;
    const now = Date.now();
    const soonest = Math.max(askedAt + MIN_MS, strikes ? dueAt : 0);
    if (now >= soonest) poll();
    else schedule(soonest - now);
  }

  /* Both events: switching tabs gives visibilitychange, returning from
     another application gives only focus. Going away cancels the poll and
     retires any request still out. */
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return nudge();
    clearTimeout(timer);
    seq++;
    inflight?.abort();
    inflight = null;
  });
  window.addEventListener('focus', nudge);
  setState('loading');
  poll();
}
