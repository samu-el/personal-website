/**
 * Monee publishes its own app screenshots, so the preview is taken from those
 * rather than photographed from a running app.
 *
 * It used to be a seeded capture: monee.smr.et served the app at its root, the
 * web build kept its whole state as one JSON snapshot in localStorage, and
 * writing that key before boot skipped first-run onboarding and landed on a
 * populated dashboard. That is gone. The root is now a marketing page — shot
 * in the phone frame this site draws, it comes back as that page's own phone
 * mockup inside a phone — and the app moved behind a login at /app that no
 * amount of seeded storage gets past.
 *
 * Those same marketing pages ship the screenshots below, which is a better
 * source than the seeded capture ever was: they are the product's own picture
 * of itself, they need no account to read, and they update here whenever
 * Monee replaces them. The demo-ledger snapshot that drove the old capture is
 * in this file's history if a reachable demo mode ever brings it back.
 *
 * The other published screen is /app-budgets.png. One preview is shown per
 * project, and the dashboard carries more of the product.
 */
export const image = '/app-home.png';
