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
 * Career timeline, engineering-first. Anything not publicly verifiable is
 * deliberately left general rather than invented — see PROFILE.md.
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
      'Building products for clients in Europe and the US — multi-tenant SaaS platforms, procurement and telemedicine systems, mobile apps, and AI-assisted features. Schema design, API contracts, front ends, deploys, and the on-call side of my own architecture.',
    highlights: [
      'Design data models and service boundaries for long-running products, then live with them — the fastest way to learn which abstractions were premature.',
      'Build across the stack: TypeScript and React on the front, Python and Node services behind, Postgres underneath, and Flutter or native when it goes mobile.',
      'Own the AI work: retrieval pipelines, evaluation sets, and a hard boundary between the model and anything that writes to a database.',
      'Put observability in before launch rather than after, because an incident you cannot reproduce is one you cannot close.',
      'Work across six time zones, which turns written decisions and small reviewable changes from good practice into the only practice that works.',
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
      'Contract and product work across the whole stack — Node and Python services, React front ends, iOS and Flutter apps, Telegram bots that solved distinctly Ethiopian problems. Working on other people’s stacks is where the polyglot habit came from, and where I learned that most projects fail on scoping rather than on code.',
    highlights: [
      'Shipped production web and mobile software for clients on whatever stack they were already committed to — Java, PHP, Node, Python, Swift, Dart.',
      'Built and ran side tools with real users, including a Telegram bot that returns Ethiopian university entrance exam results by admission number.',
      'Did my own scoping, estimating, and 2am debugging, which is a faster education in operational design than any amount of reading.',
    ],
    tags: ['Full-stack', 'Mobile', 'APIs', 'Automation'],
  },
  {
    org: 'Addis Ababa University',
    title: 'Undergraduate studies',
    from: '',
    to: '',
    location: 'Addis Ababa, Ethiopia',
    summary:
      'Where the fundamentals came from, and where I met most of the people I have built things with since.',
    highlights: [],
    tags: ['Education'],
  },
];

export type Metric = { value: string; label: string; note?: string };

/** Numbers straight off the public commit history. */
export const metrics: Metric[] = [
  { value: '10 yrs', label: 'Writing software', note: 'first public commit, 2016' },
  {
    value: '8',
    label: 'Languages in production',
    note: 'TS, Python, Swift, Dart, PHP, Java, JS, SQL',
  },
  { value: '30+', label: 'Public repositories', note: 'github.com/samu-el' },
  { value: '3', label: 'Platforms shipped', note: 'web, iOS, Android' },
];

export type Principle = { title: string; body: string; icon: string };

export const principles: Principle[] = [
  {
    title: 'Boring infrastructure, interesting product',
    body: 'Spend the novelty budget where a user can feel it. Everything underneath should be the version a new engineer can debug in their first week — Postgres until Postgres is genuinely the problem.',
    icon: 'lucide:layers',
  },
  {
    title: 'If you cannot reproduce it, you have not fixed it',
    body: 'A bug that went away is a bug that is still there. I would rather spend an hour building the reproduction than five minutes on a change that makes the symptom quieter.',
    icon: 'lucide:bug',
  },
  {
    title: 'Read more code than you write',
    body: 'Most of the job is arriving in a system someone else built and changing it without breaking anything. Reviewing a diff well is a harder skill than authoring one, and a rarer one.',
    icon: 'lucide:book-open',
  },
  {
    title: 'Small changes, written down',
    body: 'A forty-file pull request is not a review, it is a hostage negotiation. Ship the smallest change that stands on its own, and put the two rejected options in the description.',
    icon: 'lucide:git-pull-request',
  },
];
