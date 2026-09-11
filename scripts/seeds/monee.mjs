/**
 * Demo ledger for the Monee screenshot.
 *
 * Monee's web build keeps its whole state as one JSON snapshot in
 * localStorage — `src/db/web-repository.ts` in that repo — and treats the
 * presence of that key as "this ledger has been used before". Writing it
 * before the app boots therefore skips first-run onboarding and lands on a
 * populated dashboard, which is what the screenshot is for. Driving the
 * onboarding form instead would capture an empty app and depend on the
 * placeholder text of whatever build happens to be deployed.
 *
 * The snapshot is merged over the app's own EMPTY_SNAPSHOT, so this only has
 * to name the fields it cares about. Everything here is invented demo data —
 * it is a screenshot of the product, not of anyone's finances.
 */

const KEY = 'monee.snapshot.v1';

/** ETB has two minor units, so every amount below is in cents. */
const birr = (major) => Math.round(major * 100);

/** Days ago at a fixed hour, so a capture does not depend on the clock. */
function daysAgo(days, hour = 12) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, 0, 0, 0);
  return date.getTime();
}

const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * Mirrors seedCategories() in the app: the seed list in order, each carrying a
 * message key rather than literal text, with colorSlot handed out per kind in
 * list order. Getting the slots wrong would recolour the charts.
 */
const SEED_CATEGORIES = [
  ['food', 'restaurant', 'EXPENSE'],
  ['shopping', 'bag-handle', 'EXPENSE'],
  ['transport', 'bus', 'EXPENSE'],
  ['housing', 'home', 'EXPENSE'],
  ['bills', 'receipt', 'EXPENSE'],
  ['entertainment', 'game-controller', 'EXPENSE'],
  ['car', 'car', 'EXPENSE'],
  ['travel', 'airplane', 'EXPENSE'],
  ['family', 'people', 'EXPENSE'],
  ['health', 'medkit', 'EXPENSE'],
  ['education', 'school', 'EXPENSE'],
  ['groceries', 'cart', 'EXPENSE'],
  ['gifts-given', 'gift', 'EXPENSE'],
  ['sport', 'barbell', 'EXPENSE'],
  ['beauty', 'sparkles', 'EXPENSE'],
  ['work', 'briefcase', 'EXPENSE'],
  ['subscriptions', 'newspaper', 'EXPENSE'],
  ['donations', 'heart', 'EXPENSE'],
  ['reconciliation', 'git-compare', 'EXPENSE'],
  ['other-expense', 'ellipsis-horizontal-circle', 'EXPENSE'],
  ['salary', 'cash', 'INCOME'],
  ['business', 'storefront', 'INCOME'],
  ['gifts', 'gift', 'INCOME'],
  ['extra-income', 'add-circle', 'INCOME'],
  ['loan', 'hand-left', 'INCOME'],
  ['parental-leave', 'happy', 'INCOME'],
  ['insurance-payout', 'shield-checkmark', 'INCOME'],
  ['reconciliation-income', 'git-compare', 'INCOME'],
];

function categories() {
  const slots = {};
  return SEED_CATEGORIES.map(([id, icon, kind], index) => {
    const colorSlot = slots[kind] ?? 0;
    slots[kind] = colorSlot + 1;
    return { id, nameKey: id, icon, kind, isSystem: true, sortOrder: index, colorSlot };
  });
}

const ACCOUNTS = [
  {
    id: 'acc-cbe',
    name: 'CBE main',
    type: 'BANK',
    currency: 'ETB',
    openingBalanceMinor: birr(38400),
    currentBalanceMinor: birr(42850.75),
    archived: false,
    sortOrder: 0,
  },
  {
    id: 'acc-telebirr',
    name: 'telebirr',
    type: 'WALLET',
    currency: 'ETB',
    openingBalanceMinor: birr(2000),
    currentBalanceMinor: birr(3120.5),
    archived: false,
    sortOrder: 1,
  },
  {
    id: 'acc-cash',
    name: 'Cash',
    type: 'CASH',
    currency: 'ETB',
    openingBalanceMinor: birr(1500),
    currentBalanceMinor: birr(940),
    archived: false,
    sortOrder: 2,
  },
];

/** [days ago, account, direction, major amount, category, payee] */
const ENTRIES = [
  [0, 'acc-telebirr', 'DEBIT', 240, 'transport', 'Ride'],
  [0, 'acc-cbe', 'DEBIT', 1850, 'groceries', 'Shoa Supermarket'],
  [1, 'acc-cash', 'DEBIT', 160, 'food', 'Tomoca'],
  [1, 'acc-cbe', 'DEBIT', 3200, 'bills', 'Ethio Telecom'],
  [2, 'acc-telebirr', 'DEBIT', 95, 'transport', 'Ride'],
  [3, 'acc-cbe', 'DEBIT', 6400, 'shopping', 'Sheger Mall'],
  [4, 'acc-cbe', 'CREDIT', 62000, 'salary', 'Mereb'],
  [5, 'acc-cash', 'DEBIT', 400, 'food', 'Kategna'],
  [6, 'acc-cbe', 'DEBIT', 1200, 'subscriptions', 'Spotify'],
  [8, 'acc-telebirr', 'DEBIT', 320, 'groceries', 'Fresh Corner'],
  [9, 'acc-cbe', 'DEBIT', 18000, 'housing', 'Rent'],
  [11, 'acc-cbe', 'DEBIT', 2400, 'health', 'Pharmacy'],
  [13, 'acc-telebirr', 'CREDIT', 5000, 'business', 'Client transfer'],
  [15, 'acc-cbe', 'DEBIT', 890, 'entertainment', 'Cinema'],
  [18, 'acc-cash', 'DEBIT', 260, 'food', 'Lunch'],
  [21, 'acc-cbe', 'DEBIT', 4300, 'car', 'Fuel'],
];

function transactions() {
  return ENTRIES.map(([days, accountId, direction, major, categoryId, payee], index) => {
    const occurredAt = daysAgo(days, 9 + (index % 8));
    const amountMinor = birr(major);
    return {
      id: `txn-${String(index + 1).padStart(2, '0')}`,
      accountId,
      direction,
      amountMinor,
      currency: 'ETB',
      // Everything is already in the base currency, so the rate is identity
      // and inherited rather than fetched. No network in a screenshot.
      baseAmountMinor: amountMinor,
      baseCurrency: 'ETB',
      fxRate: '1',
      fxRateSource: 'INHERITED',
      fxRateAsOf: isoDate(occurredAt),
      occurredAt,
      categoryId,
      payee,
      status: 'CONFIRMED',
      createdBy: 'MANUAL',
    };
  });
}

const BUDGETS = [
  {
    id: 'bud-groceries',
    name: 'Groceries',
    scope: 'CATEGORY',
    scopeId: 'groceries',
    amountMinor: birr(6000),
    currency: 'ETB',
    period: 'MONTH',
    startsOn: isoDate(daysAgo(21)),
    rollover: false,
    alertThresholds: [0.8, 1],
  },
  {
    id: 'bud-eating-out',
    name: 'Eating out',
    scope: 'CATEGORY',
    scopeId: 'food',
    amountMinor: birr(3000),
    currency: 'ETB',
    period: 'MONTH',
    startsOn: isoDate(daysAgo(21)),
    rollover: false,
    alertThresholds: [0.8, 1],
  },
];

/**
 * Runs before the app's own scripts, so the store hydrates from this rather
 * than deciding it is a first run.
 *
 * @param {import('playwright').Page} page
 */
export async function prepare(page) {
  const snapshot = {
    baseCurrency: 'ETB',
    themePreference: 'dark',
    accounts: ACCOUNTS,
    categories: categories(),
    transactions: transactions(),
    budgets: BUDGETS,
  };

  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Storage disabled: the app falls back to first-run, and the capture
        // is a worse screenshot rather than a failed one.
      }
    },
    [KEY, JSON.stringify(snapshot)],
  );
}

/**
 * Where to land after seeding. The dashboard is the screen worth showing.
 */
export const path = '/app';

/**
 * Why this project is not re-captured automatically.
 *
 * monee.smr.et has grown a front door since the committed screenshot was
 * taken. `/` is now a marketing page — captured in the phone frame this site
 * draws, it comes back as that page's own phone mockup inside a phone — and
 * the app moved to `/app`, which now opens on a login screen that the
 * localStorage snapshot above cannot get past. Neither is a picture of the
 * product.
 *
 * The committed screenshot is a seeded dashboard and still matches the app,
 * down to the layout in Monee's own marketing mockup, so it is kept rather
 * than replaced with a login form. Remove this when the app has a demo mode
 * the script can reach, then re-run `npm run shots monee`, which ignores the
 * hold.
 */
export const hold = 'the app now opens on a login screen; keeping the seeded dashboard';
