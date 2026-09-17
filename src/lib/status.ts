/** How a project's status reads: live work in jade, the rest by weight. */
const STATUS_TONE: Record<string, string> = {
  Live: 'text-jade',
  Ongoing: 'text-jade',
  Shipped: 'text-muted',
  Experiment: 'text-accent',
  Archived: 'text-subtle',
};

export const tone = (status: string) => STATUS_TONE[status] ?? 'text-muted';
