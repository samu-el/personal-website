import { byId } from './dom';
import { clock, since } from './time';

/**
 * Fills the "currently listening" card from the Worker at `endpoint`.
 *
 * The card holds its own shape as a skeleton until the first answer, then
 * shows one of three things: the track playing now with a live bar, a paused
 * track frozen where it stopped, or the last one that finished. An answer
 * that names no track at all hides the card.
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

/* The poll follows the endpoint rather than a clock: the Worker says how
   long its answer holds and how much of that is already spent, so asking
   earlier re-reads a byte-identical body. See docs/architecture.md. */
const MIN_MS = 4000;
const FALLBACK_MS = 10000;
/** A paused or finished track is not about to change on its own. */
const IDLE_MS = 30000;
const BACKOFF_MS = 5000;
const BACKOFF_MAX_MS = 5 * 60000;
/** Bound on the staleness correction, so a badly set clock cannot peg the bar. */
const MAX_AGE_MS = 60000;

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

  /** `loading` is entered before the first paint; `empty` removes the card. */
  function setState(next: 'loading' | 'ready' | 'empty') {
    section!.dataset.state = next;
    if (next !== 'loading') section!.removeAttribute('aria-busy');
    if (next === 'ready') {
      el.link?.removeAttribute('aria-hidden');
      el.link?.removeAttribute('tabindex');
    }
    section!.hidden = next === 'empty';
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

  /**
   * How long the answer just received stays true, in ms. s-maxage is what the
   * edge honours, max-age what a browser would; Age is what this copy has
   * already spent.
   */
  function freshnessLeft(res: Response) {
    const cc = res.headers.get('Cache-Control') ?? '';
    const ttl = Number((cc.match(/s-maxage=(\d+)/) ?? cc.match(/max-age=(\d+)/) ?? [])[1]);
    if (!Number.isFinite(ttl) || ttl <= 0) return 0;
    const age = Number(res.headers.get('Age')) || 0;
    // A beat of slack, so we land just after it turns over rather than just
    // before and having to come straight back.
    return Math.max(0, ttl - age) * 1000 + 100;
  }

  /** Replaces any pending poll. Jittered, so open tabs do not line up. */
  function schedule(ms: number) {
    clearTimeout(timer);
    if (document.hidden) return;
    timer = window.setTimeout(poll, ms + Math.random() * 400);
  }

  function paint(data: Payload) {
    /* An older deployed Worker sends no state, so infer it — otherwise the
       card reads "Paused" over a playing track while the two are out of step. */
    const state: State = data.state ?? (data.playing ? 'playing' : 'paused');
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
    const drawable =
      el.bar && el.progress && state !== 'recent' && duration > 0 && Number.isFinite(at);

    if (!drawable) {
      total = 0;
      if (el.progress) el.progress.hidden = true;
      stopTicker();
      return;
    }

    /* Add back however long the reading sat in the edge cache, so the bar
       starts where the track actually is. Clamped: this subtracts the edge's
       clock from the visitor's, and losing the correction costs only the few
       seconds it was worth. */
    const stamp = Number(data.fetchedAt);
    const age =
      live && Number.isFinite(stamp) ? Math.min(Math.max(Date.now() - stamp, 0), MAX_AGE_MS) : 0;

    // A new track must not glide backwards out of the old one's position.
    if (data.title !== lastTitle && el.bar) {
      el.bar.style.transition = 'none';
      requestAnimationFrame(() => (el.bar!.style.transition = ''));
    }

    base = Math.min(at + age, duration);
    baseAt = Date.now();
    total = duration;
    if (el.duration) el.duration.textContent = clock(duration);
    el.progress!.hidden = false;
    renderProgress();

    // A paused bar is rendered once and left alone: ticking it would advance
    // a track that is not moving.
    stopTicker();
    if (live) ticker = window.setInterval(() => document.hidden || renderProgress(), 1000);
  }

  async function poll() {
    let data: Payload | null = null;
    let res: Response | null = null;
    try {
      /* no-store bypasses the browser's HTTP cache, which Cloudflare's
         zone-level Browser Cache TTL would otherwise pin for four hours.
         s-maxage survives that rewrite, so the edge still shields Spotify. */
      res = await fetch(endpoint!, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (res.ok) data = await res.json();
    } catch {
      // Offline, blocked, or DNS still catching up.
    }

    if (data) {
      strikes = 0;
      /* A remembered answer means the Worker could not reach Spotify, and it
         has already told the edge how long to sit on it. */
      const idle = !data.playing || data.stale;
      schedule(Math.max(MIN_MS, freshnessLeft(res!) || (idle ? IDLE_MS : FALLBACK_MS)));
    } else {
      // Geometric and capped: a Worker that is down does not get better for
      // being asked twice a second.
      strikes += 1;
      schedule(Math.min(BACKOFF_MS * 2 ** (strikes - 1), BACKOFF_MAX_MS));
    }

    // A title is the only requirement. Paused counts, and so does the last
    // thing that finished — the card is about what he is listening to, not
    // whether a play button happens to be down.
    if (!data?.title) {
      setState('empty');
      total = 0;
      stopTicker();
      return;
    }
    paint(data);
  }

  /* Both events, because they do not fire interchangeably: switching tabs
     gives visibilitychange, returning from another application gives only
     focus. Going away cancels the pending poll rather than letting it fire
     into a background tab. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else poll();
  });
  window.addEventListener('focus', () => document.hidden || poll());

  setState('loading');
  poll();
}
