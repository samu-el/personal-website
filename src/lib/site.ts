/**
 * Single source of truth for identity, navigation and social links.
 * Facts here are drawn from public sources — see PROFILE.md for provenance.
 */

export const site = {
  name: 'Samuel Mussie',
  shortName: 'Samuel',
  /** Still used by the favicon and app icons (public/favicon.svg,
   *  scripts/assets/icon.html) — a face is not legible at 16px. */
  initials: 'SM',
  role: 'Software Engineer',
  location: 'Addis Ababa, Ethiopia',
  /** For tight spots — the header wordmark, the social card. */
  locationShort: 'Addis Ababa',
  /** Current employer. Referenced in the timeline only — not part of the pitch. */
  company: 'Mereb Technologies',
  companyUrl: 'https://www.mereb.tech',
  locale: 'en',
  timezone: 'Africa/Addis_Ababa',
  email: 'samuel@mereb.tech',
  /** Used in <title> suffix and OG site name. */
  title: 'Samuel Mussie — Software Engineer',
  tagline: 'No software engineering problem is too big to solve.',
  description:
    'Samuel Mussie is a software engineer in Addis Ababa. A decade of building web and mobile products end to end — Python and TypeScript services, React and Next.js front ends, Flutter and native mobile, and the retrieval systems behind AI features that hold up in production.',
} as const;

export type NavItem = { label: string; href: string; index: string };

export const nav: NavItem[] = [
  { label: 'Home', href: '/', index: '01' },
  { label: 'About', href: '/about', index: '02' },
  { label: 'Work', href: '/work', index: '03' },
  { label: 'Writing', href: '/writing', index: '04' },
  { label: 'Stack', href: '/stack', index: '05' },
  { label: 'Contact', href: '/contact', index: '06' },
];

export type Social = {
  label: string;
  handle: string;
  href: string;
  icon: string;
};

export const socials: Social[] = [
  {
    label: 'GitHub',
    handle: '@samu-el',
    href: 'https://github.com/samu-el',
    icon: 'simple-icons:github',
  },
  {
    label: 'LinkedIn',
    handle: 'in/samu-el',
    href: 'https://www.linkedin.com/in/samu-el/',
    icon: 'simple-icons:linkedin',
  },
  {
    label: 'Email',
    handle: site.email,
    href: `mailto:${site.email}`,
    icon: 'lucide:mail',
  },
];
