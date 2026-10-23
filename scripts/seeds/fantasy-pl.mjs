/**
 * fantasy.et's root is a landing pitch; the product is the squad on the pitch
 * with the coach beside it, at /dashboard. That route needs a session, so the
 * capture signs in through the site's own guest mode first: "Continue as
 * guest" with the sample FPL team ID the form already holds. No account, no
 * credentials, nothing personal on screen. The session lives in the capture's
 * browser context only.
 *
 * Selectors are the form's id and the button's words, read from the
 * fantasy-pl repo (components/unified-login.tsx, components/guest-login.tsx).
 */
export const path = '/dashboard';

/** @param {import('playwright').Page} page @param {{ demo: string }} project */
export async function prepare(page, project) {
  const login = new URL('/login?next=/dashboard', project.demo).toString();
  await page.goto(login, { waitUntil: 'networkidle', timeout: 45000 });
  await page.getByRole('button', { name: /continue as guest/i }).click();
  await page.locator('#teamId').waitFor({ state: 'visible' });
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 45000 }),
    page.locator('#teamId').press('Enter'),
  ]);
}
