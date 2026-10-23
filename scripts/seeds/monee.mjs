/**
 * Monee's web build is the app as a phone-shaped preview, keeping its ledger
 * in localStorage. The capture hands it a demo ledger (monee-ledger.json:
 * invented accounts, payees and a first name, nothing real) before the first
 * load, with the theme left on `system` so it follows the emulated scheme.
 *
 * The live /app sits behind a sign-in that no seeded storage gets past, so
 * this needs a local run of a build with no account server, the offline
 * edition:
 *
 *   EXPO_PUBLIC_MONEE_EDITION=offline bunx expo export --platform web --output-dir <dir>/app
 *   (serve <dir>, sending unknown paths under /app to app/index.html)
 *   SHOTS_ORIGIN=http://localhost:<port> npm run shots monee
 */
import { readFileSync } from 'node:fs';

export const path = '/app';
export const localOnly = 'the live /app is behind a sign-in';

const KEY = 'monee.snapshot.v1';
const DAY = 86_400_000;

/** Moves the ledger so its latest day is today: "this month" is never empty. */
function rebased() {
  const ledger = JSON.parse(readFileSync(new URL('./monee-ledger.json', import.meta.url), 'utf8'));
  const startOf = (t) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const latest = Math.max(...ledger.transactions.map((t) => t.occurredAt));
  const shift = Math.round((startOf(Date.now()) - startOf(latest)) / DAY) * DAY;
  const isoDay = (t) => new Date(t).toISOString().slice(0, 10);
  for (const t of ledger.transactions) {
    t.occurredAt += shift;
    if (t.receivedAt) t.receivedAt += shift;
    t.fxRateAsOf = isoDay(t.occurredAt);
  }
  const month = new Date();
  month.setDate(1);
  for (const b of ledger.budgets) b.startsOn = isoDay(startOf(month.getTime()) + DAY / 2);
  return JSON.stringify(ledger);
}

/** @param {import('playwright').Page} page */
export async function prepare(page) {
  // Only when empty, so a reload inside the capture keeps the same state.
  await page.addInitScript(
    ([key, value]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    [KEY, rebased()],
  );
}
