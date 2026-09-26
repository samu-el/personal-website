import { byId } from './dom';

/** Copies the address and says so, falling back to showing it when denied. */
export function copyEmail(reset = 2200) {
  const button = byId<HTMLButtonElement>('copy-email');
  const status = byId('copy-email-status');
  const email = document.documentElement.dataset.email;
  if (!button || !email) return;
  const label = button.querySelector('[data-copy-label]');
  let timer = 0;
  button.addEventListener('click', async () => {
    if (!label) return;
    let copied = false;
    try {
      // Undefined outside a secure context, so this can throw before it rejects.
      await navigator.clipboard.writeText(email);
      copied = true;
    } catch {
      // Denied or unavailable: showing the address lets it be copied by hand.
    }
    label.textContent = copied ? 'Copied' : email;
    if (status) status.textContent = copied ? 'Email address copied' : `Copy failed. The address is ${email}`;
    // A second click restarts the countdown rather than being cut short by the first.
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      label.textContent = 'Copy address';
      if (status) status.textContent = '';
    }, reset);
  });
}
