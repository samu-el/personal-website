import { byId } from './dom';

/** Copies the address and says so, falling back to showing it when denied. */
export function copyEmail(reset = 2200) {
  const button = byId<HTMLButtonElement>('copy-email');
  const email = document.documentElement.dataset.email;
  if (!button || !email) return;
  const label = button.querySelector('[data-copy-label]');

  button.addEventListener('click', async () => {
    if (!label) return;
    label.textContent = await navigator.clipboard
      .writeText(email)
      .then(() => 'Copied')
      .catch(() => email);
    setTimeout(() => (label.textContent = 'Copy address'), reset);
  });
}
