export type StackItem = { name: string; note?: string; icon?: string };
export type StackGroup = {
  title: string;
  index: string;
  blurb: string;
  items: StackItem[];
};

/**
 * Tools and languages, grouped. Notes are factual — what a thing is used for,
 * not an opinion about it. See PROFILE.md: some entries are inferred rather
 * than evidenced and should be deleted if unused.
 */
export const stack: StackGroup[] = [
  {
    title: 'Languages',
    index: '01',
    blurb: 'Languages used in production work.',
    items: [
      { name: 'TypeScript', note: 'primary', icon: 'simple-icons:typescript' },
      { name: 'Python', note: 'services, data, AI', icon: 'simple-icons:python' },
      { name: 'JavaScript', icon: 'simple-icons:javascript' },
      { name: 'Dart', note: 'Flutter', icon: 'simple-icons:dart' },
      { name: 'Swift', note: 'native iOS', icon: 'simple-icons:swift' },
      { name: 'PHP', icon: 'simple-icons:php' },
      { name: 'Java', icon: 'simple-icons:openjdk' },
      { name: 'SQL', icon: 'lucide:database' },
    ],
  },
  {
    title: 'Front end',
    index: '02',
    blurb: 'Web and mobile clients.',
    items: [
      { name: 'React', icon: 'simple-icons:react' },
      { name: 'Next.js', icon: 'simple-icons:nextdotjs' },
      { name: 'Astro', note: 'this site', icon: 'simple-icons:astro' },
      { name: 'Tailwind CSS', icon: 'simple-icons:tailwindcss' },
      { name: 'Flutter', note: 'iOS and Android', icon: 'simple-icons:flutter' },
      { name: 'React Native', icon: 'simple-icons:react' },
    ],
  },
  {
    title: 'Back end & data',
    index: '03',
    blurb: 'Services, storage and packaging.',
    items: [
      { name: 'FastAPI', note: 'Python services', icon: 'simple-icons:fastapi' },
      { name: 'Node.js', icon: 'simple-icons:nodedotjs' },
      { name: 'PostgreSQL', icon: 'simple-icons:postgresql' },
      { name: 'Redis', note: 'caching, queues', icon: 'simple-icons:redis' },
      { name: 'MongoDB', icon: 'simple-icons:mongodb' },
      { name: 'Docker', icon: 'simple-icons:docker' },
    ],
  },
  {
    title: 'AI',
    index: '04',
    blurb: 'Retrieval-augmented features in production.',
    items: [
      { name: 'RAG pipelines', note: 'chunking, retrieval, citations', icon: 'lucide:search-code' },
      { name: 'Vector search', note: 'pgvector', icon: 'lucide:git-compare' },
      { name: 'Evaluation sets', icon: 'lucide:flask-conical' },
      { name: 'LLM APIs', icon: 'lucide:bot' },
    ],
  },
  {
    title: 'Infrastructure',
    index: '05',
    blurb: 'Hosting, CI and operations.',
    items: [
      { name: 'AWS', icon: 'simple-icons:amazonwebservices' },
      { name: 'GitHub Actions', note: 'CI/CD', icon: 'simple-icons:githubactions' },
      { name: 'Vercel', icon: 'simple-icons:vercel' },
      { name: 'Cloudflare', icon: 'simple-icons:cloudflare' },
      { name: 'Linux', icon: 'simple-icons:linux' },
      { name: 'Terraform', icon: 'simple-icons:terraform' },
    ],
  },
  {
    title: 'Tooling',
    index: '06',
    blurb: 'Day-to-day.',
    items: [
      { name: 'Git', icon: 'simple-icons:git' },
      { name: 'Linear', icon: 'simple-icons:linear' },
      { name: 'Notion', icon: 'simple-icons:notion' },
      { name: 'Figma', icon: 'simple-icons:figma' },
      { name: 'Slack', icon: 'simple-icons:slack' },
    ],
  },
];

export type Service = { title: string; body: string; icon: string };

/** Types of work, described rather than pitched. */
export const services: Service[] = [
  {
    title: 'Full-stack product development',
    body: 'Schema and migrations, API contracts, front end, deployment pipeline.',
    icon: 'lucide:package-check',
  },
  {
    title: 'AI features',
    body: 'Retrieval pipelines, vector search, evaluation sets, cost and safety boundaries.',
    icon: 'lucide:sparkles',
  },
  {
    title: 'Mobile applications',
    body: 'Flutter and React Native for both platforms; native Swift for iOS.',
    icon: 'lucide:smartphone',
  },
  {
    title: 'Codebase maintenance',
    body: 'Typing, test coverage, CI, observability and performance work on existing systems.',
    icon: 'lucide:wrench',
  },
];
