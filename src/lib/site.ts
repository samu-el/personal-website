/**
 * Single source of truth for identity, navigation and social links.
 * Facts here are drawn from public sources — see PROFILE.md for provenance.
 */

export const site = {
  name: 'Samuel Mussie',
  shortName: 'Samuel',
  initials: 'SM',
  role: 'Co-founder & CTO',
  company: 'Mereb Technologies',
  companyUrl: 'https://www.mereb.tech',
  location: 'Addis Ababa, Ethiopia',
  locale: 'en',
  timezone: 'Africa/Addis_Ababa',
  email: 'samuel@mereb.tech',
  /** Used in <title> suffix and OG site name. */
  title: 'Samuel Mussie — Co-founder & CTO, Mereb Technologies',
  tagline: 'Building senior engineering teams out of Addis Ababa.',
  description:
    'Samuel Mussie is co-founder and CTO of Mereb Technologies in Addis Ababa, where he builds dedicated senior engineering teams for SaaS companies in Europe and the US.',
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
    label: 'LinkedIn',
    handle: 'in/samu-el',
    href: 'https://www.linkedin.com/in/samu-el/',
    icon: 'simple-icons:linkedin',
  },
  {
    label: 'GitHub',
    handle: '@samu-el',
    href: 'https://github.com/samu-el',
    icon: 'simple-icons:github',
  },
  {
    label: 'Email',
    handle: site.email,
    href: `mailto:${site.email}`,
    icon: 'lucide:mail',
  },
  {
    label: 'Mereb',
    handle: 'mereb.tech',
    href: 'https://www.mereb.tech',
    icon: 'lucide:building-2',
  },
];
