export type StackItem = { name: string; note?: string; icon?: string };
export type StackGroup = {
  title: string;
  index: string;
  blurb: string;
  items: StackItem[];
};

/**
 * What I actually reach for. Ordered by how often, not by how impressive.
 * Icon slugs come from the bundled `simple-icons` / `lucide` sets.
 */
export const stack: StackGroup[] = [
  {
    title: 'Languages',
    index: '01',
    blurb:
      'Python and TypeScript are home. The rest are there because a client was already on them, which is the only honest reason to know a language.',
    items: [
      {
        name: 'TypeScript',
        note: 'default for anything with a UI',
        icon: 'simple-icons:typescript',
      },
      { name: 'Python', note: 'services, data, anything AI-adjacent', icon: 'simple-icons:python' },
      { name: 'JavaScript', note: 'the years before types', icon: 'simple-icons:javascript' },
      { name: 'Dart', note: 'Flutter apps', icon: 'simple-icons:dart' },
      { name: 'Swift', note: 'native iOS when it earns it', icon: 'simple-icons:swift' },
      {
        name: 'PHP',
        note: 'more of the world runs on it than admits it',
        icon: 'simple-icons:php',
      },
      { name: 'Java', note: 'where I started', icon: 'simple-icons:openjdk' },
      { name: 'SQL', note: 'non-negotiable', icon: 'lucide:database' },
    ],
  },
  {
    title: 'Product & front end',
    index: '02',
    blurb:
      'Render on the server, hydrate only what needs it, and keep the dependency list short enough that an upgrade is a Tuesday, not a quarter.',
    items: [
      { name: 'React', icon: 'simple-icons:react' },
      { name: 'Next.js', note: 'the default client stack', icon: 'simple-icons:nextdotjs' },
      {
        name: 'Astro',
        note: 'content-shaped sites — including this one',
        icon: 'simple-icons:astro',
      },
      { name: 'Tailwind CSS', icon: 'simple-icons:tailwindcss' },
      { name: 'Flutter', note: 'one team, two platforms', icon: 'simple-icons:flutter' },
      { name: 'React Native', icon: 'simple-icons:react' },
    ],
  },
  {
    title: 'Back end & data',
    index: '03',
    blurb: 'Boring, observable, and recoverable. Postgres until Postgres is genuinely the problem.',
    items: [
      { name: 'FastAPI', note: 'Python services', icon: 'simple-icons:fastapi' },
      { name: 'Node.js', icon: 'simple-icons:nodedotjs' },
      { name: 'PostgreSQL', icon: 'simple-icons:postgresql' },
      { name: 'Redis', note: 'queues, caches, locks', icon: 'simple-icons:redis' },
      { name: 'MongoDB', icon: 'simple-icons:mongodb' },
      { name: 'Docker', icon: 'simple-icons:docker' },
    ],
  },
  {
    title: 'AI in production',
    index: '04',
    blurb:
      'Retrieval, evals, and a hard boundary between the model and anything that writes to a database. Most of the work is the plumbing, not the prompt.',
    items: [
      { name: 'RAG pipelines', note: 'chunking, retrieval, citations', icon: 'lucide:search-code' },
      { name: 'Vector search', note: 'pgvector by preference', icon: 'lucide:git-compare' },
      { name: 'Evals', note: 'before shipping, not after', icon: 'lucide:flask-conical' },
      { name: 'Agentic tooling', note: 'narrow scope, audited writes', icon: 'lucide:bot' },
    ],
  },
  {
    title: 'Infrastructure',
    index: '05',
    blurb: 'Enough of it to make deploys unremarkable, and no more.',
    items: [
      { name: 'AWS', icon: 'simple-icons:amazonwebservices' },
      { name: 'GitHub Actions', note: 'CI for everything', icon: 'simple-icons:githubactions' },
      { name: 'Vercel', note: 'front ends and prototypes', icon: 'simple-icons:vercel' },
      { name: 'Cloudflare', icon: 'simple-icons:cloudflare' },
      { name: 'Linux', icon: 'simple-icons:linux' },
      { name: 'Terraform', icon: 'simple-icons:terraform' },
    ],
  },
  {
    title: 'How the work runs',
    index: '06',
    blurb:
      'Running a distributed engineering org is mostly a writing problem. These are the tools that make the writing stick.',
    items: [
      { name: 'Git', note: 'small commits, honest messages', icon: 'simple-icons:git' },
      { name: 'Linear', note: 'one queue, ruthlessly groomed', icon: 'simple-icons:linear' },
      { name: 'Notion', note: 'decisions, not status', icon: 'simple-icons:notion' },
      { name: 'Figma', icon: 'simple-icons:figma' },
      { name: 'Slack', icon: 'simple-icons:slack' },
      { name: 'Claude Code', note: 'the reviewer who never gets tired', icon: 'lucide:terminal' },
    ],
  },
];

export type Service = { title: string; body: string; icon: string };

/** What people actually come to me for. */
export const services: Service[] = [
  {
    title: 'Embedded engineering teams',
    body: 'A senior team that works inside your process on your board and your codebase, under an EU contract, from Addis Ababa. Scoped in weeks, not quarters.',
    icon: 'lucide:users-round',
  },
  {
    title: 'Fractional CTO & architecture review',
    body: 'For founders who need the call made on a stack, a migration, or a hiring plan — and want it written down with the tradeoffs, not delivered as an opinion.',
    icon: 'lucide:drafting-compass',
  },
  {
    title: 'AI features that survive contact with users',
    body: 'Retrieval, evals, guardrails and cost controls around a real product surface. Usually the answer is a smaller model and better retrieval.',
    icon: 'lucide:sparkles',
  },
  {
    title: 'Delivery rescue',
    body: 'A late project, an unhappy client, a team that has stopped shipping. I have been on both sides of that call and can tell you which of the three it actually is.',
    icon: 'lucide:life-buoy',
  },
];
