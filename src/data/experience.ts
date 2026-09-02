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
 * Career timeline. Anything not publicly verifiable is deliberately left
 * general rather than invented — see PROFILE.md for what to fill in.
 */
export const roles: Role[] = [
  {
    org: 'Mereb Technologies',
    title: 'Co-founder & Chief Technology Officer',
    from: '2020',
    to: 'Present',
    location: 'Addis Ababa · Warsaw · Sheridan, WY',
    url: 'https://www.mereb.tech',
    current: true,
    summary:
      'I run engineering at Mereb: the hiring bar, the delivery model, and the architecture decisions behind every team we place. We give SaaS companies in Europe and the US dedicated senior engineers under an EU contract — not a body shop, and never a junior on client work.',
    highlights: [
      'Grew the company from a handful of freelancers into an engineering organisation trusted by 50+ companies across Europe, the US and Ethiopia.',
      'Set the technical hiring bar: our engineers average six-plus years of production experience, and we staff no juniors on client work.',
      'Own the delivery model for long-running embedded teams — onboarding, code review culture, release discipline, and the handover contract with each client CTO.',
      'Lead architecture across the portfolio: multi-tenant SaaS platforms, procurement and telemedicine systems, mobile apps, and AI-assisted product features.',
      'Back the Mereb Podcast — our Amharic-language show putting Ethiopian engineers, founders and operators on record about how they actually build.',
    ],
    tags: ['Engineering leadership', 'Hiring', 'Architecture', 'Delivery', 'Team building'],
  },
  {
    org: 'Independent',
    title: 'Software Engineer & Consultant',
    from: '2016',
    to: '2020',
    location: 'Addis Ababa, Ethiopia',
    summary:
      'Years of contract and product work across the stack — Node and Python services, React front ends, iOS and Flutter apps, Telegram bots that solved distinctly Ethiopian problems. The client relationships from this period are what Mereb was built on.',
    highlights: [
      'Shipped production web and mobile software for clients on their own stacks, which is where the polyglot habit came from.',
      'Built and ran side tools with real users, including a Telegram bot that returned Ethiopian university entrance exam results by admission number.',
      'Learned the operational side of outsourcing the hard way — scoping, estimating, and being the person accountable when something breaks at 2am.',
    ],
    tags: ['Full-stack', 'Consulting', 'Mobile', 'APIs'],
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

/** Numbers I can stand behind, with the caveat stated where one is needed. */
export const metrics: Metric[] = [
  { value: '2020', label: 'Mereb founded', note: 'in Addis Ababa' },
  { value: '50+', label: 'Companies served', note: 'Europe, the US, Ethiopia' },
  { value: '6+ yrs', label: 'Average experience', note: 'of the engineers we staff' },
  { value: '3', label: 'Offices', note: 'Addis Ababa · Warsaw · Sheridan, WY' },
];

export type Principle = { title: string; body: string; icon: string };

export const principles: Principle[] = [
  {
    title: 'Seniority is not a title',
    body: 'It is the ability to be handed an ambiguous problem and return with a decision, the tradeoffs written down, and a way to reverse it. We hire for that and nothing else.',
    icon: 'lucide:compass',
  },
  {
    title: 'Distance is a design constraint',
    body: 'An embedded team six time zones from its client only works if the handover is explicit — written decisions, small reviewable changes, and no meeting that a document could replace.',
    icon: 'lucide:globe-2',
  },
  {
    title: 'Boring infrastructure, interesting product',
    body: 'Spend the novelty budget where the user can feel it. Everything underneath should be the version a new engineer can debug on their first week.',
    icon: 'lucide:layers',
  },
  {
    title: 'Talent is evenly distributed; opportunity is not',
    body: 'The whole thesis of Mereb. There is no shortage of engineers in Addis Ababa who can hold their own on any team in Berlin — only a shortage of companies who have looked.',
    icon: 'lucide:map-pin',
  },
];
