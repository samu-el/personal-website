/**
 * fantasy.et's root is a landing pitch; the product is the squad on the pitch
 * with the coach beside it, at /dashboard. That route needs a session, so the
 * capture signs in through the site's own guest mode first: "Continue as
 * guest" with a public FPL team ID typed into the form (it starts empty). No
 * account, no credentials, nothing personal on screen. The session lives in
 * the capture's browser context only.
 *
 * Selectors are the form's id and the button's words, read from the
 * fantasy-pl repo (components/unified-login.tsx, components/guest-login.tsx).
 */
export const path = '/dashboard';

/** A public FPL team with a full squad, so the pitch is never empty. */
const TEAM_ID = '5878516';

/** @param {import('playwright').Page} page @param {{ demo: string }} project */
export async function prepare(page, project) {
  const login = new URL('/login?next=/dashboard', project.demo).toString();
  await page.goto(login, { waitUntil: 'networkidle', timeout: 45000 });
  await page.getByRole('button', { name: /continue as guest/i }).click();
  await page.locator('#teamId').waitFor({ state: 'visible' });
  await page.locator('#teamId').fill(TEAM_ID);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 45000 }),
    page.locator('#teamId').press('Enter'),
  ]);
}
