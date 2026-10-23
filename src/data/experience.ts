export type Role = {
  org: string;
  title: string;
  from: string;
  to: string;
  location: string;
  url?: string;
  summary: string;
  highlights: string[];
  tags: string[];
  current?: boolean;
};

/**
 * Career timeline.
 *
 * Deliberately factual: what was built, on what stack, where and when. No
 * opinions, no anecdotes, no claims about how Samuel thinks. Those are his to
 * write. See PROFILE.md for what still needs confirming.
 */
export const roles: Role[] = [
  {
    org: 'Mereb Technologies',
    title: 'Software Engineer',
    from: '2020',
    to: 'Present',
    location: 'Addis Ababa, Ethiopia',
    url: 'https://www.mereb.tech',
    current: true,
    summary:
      'Web and mobile product development for clients in Europe and the US: multi-tenant SaaS platforms, procurement and telemedicine systems, mobile applications, and AI-assisted features.',
    highlights: [
      'Data modelling, schema design and migrations on PostgreSQL.',
      'Service boundaries and API contracts for long-running products.',
      'Front ends in TypeScript, React and Next.js.',
      'Mobile in Flutter and React Native.',
      'Retrieval pipelines, vector search and evaluation sets for AI features.',
      'Deployment pipelines, observability and on-call.',
    ],
    tags: ['TypeScript', 'Python', 'React', 'PostgreSQL', 'AI systems'],
  },
  {
    org: 'Independent',
    title: 'Software Engineer & Consultant',
    from: '2016',
    to: '2020',
    location: 'Addis Ababa, Ethiopia',
    summary:
      'Contract web and mobile development across client stacks: Node and Python services, React front ends, iOS and Flutter applications, and Telegram bots.',
    highlights: [
      'Production web and mobile work in Java, PHP, Node, Python, Swift and Dart.',
      'Telegram bots, including one returning Ethiopian university entrance exam results by admission number.',
      'Scoping, estimating and operational support.',
    ],
    tags: ['Full-stack', 'Mobile', 'APIs', 'Automation'],
  },
  {
    org: 'Addis Ababa University',
    title: 'Undergraduate studies',
    from: '',
    to: '',
    location: 'Addis Ababa, Ethiopia',
    summary: '',
    highlights: [],
    tags: ['Education'],
  },
];

export type Metric = { value: string; label: string };

/** Counts taken from the public commit history (first public commit, 2016).
 *  The figure and its label only: the About and Stack pages carry the detail. */
export const metrics: Metric[] = [
  { value: '10 yrs', label: 'Writing software' },
  { value: '8', label: 'Languages in production' },
  { value: '30+', label: 'Public repositories' },
  { value: '3', label: 'Platforms shipped' },
];
