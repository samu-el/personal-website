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
    title: 'Day to day',
    index: '06',
    blurb:
      'Most of engineering at distance is a writing problem. These are the tools that make the writing stick.',
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

/** What people actually hire me for. */
export const services: Service[] = [
  {
    title: 'Product engineering, end to end',
    body: 'Take a problem to a shipped product: schema, API, front end, deploy pipeline, and the notes that let someone else operate it. I would rather own a thin slice all the way through than a thick slice of one layer.',
    icon: 'lucide:package-check',
  },
  {
    title: 'AI features that survive real users',
    body: 'Retrieval, evaluation sets, guardrails and cost control around an actual product surface. Usually the answer is a smaller model and better retrieval — most of the work is plumbing, not prompting.',
    icon: 'lucide:sparkles',
  },
  {
    title: 'Mobile, either way',
    body: 'Flutter when one team has to ship both platforms and the UI is yours to define; native when the product lives or dies on platform feel. I have shipped both within eighteen months of each other, so the recommendation comes from experience rather than a keynote.',
    icon: 'lucide:smartphone',
  },
  {
    title: 'Making a codebase safe to change again',
    body: 'Types, tests, CI, and the boring observability that turns an unreproducible incident into a failing test. The goal is not elegance — it is that the next change stops being frightening.',
    icon: 'lucide:wrench',
  },
];
