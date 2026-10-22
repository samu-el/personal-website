# Design: samuelmussie

The locked system. Every Hallmark run reads this first and pages share it. Change it on purpose; the file is the rule.

## System

- Genre: editorial
- Shape of the first page: Index-first (the work as the page, the hire job: contact in the nav and at the close)
- Theme: brand (the project's own ink, paper and gold; Instrument Serif and Geist)
- Axes: light/high-contrast-serif/warm · posture: committed (an ink field opens every page; gold is the signal)

## Tokens

`src/styles/tokens.css` is the source of truth. Colours are RGB channels on `:root` and `.dark`, so a subtree
(`.field-ink`, `.field-gold`) recolours by redefining them. The Hallmark roles map onto the project's names:

```css
:root {
  --color-paper: rgb(var(--c-bg)); /* 247 245 241 light, 12 12 13 dark (bg-bg) */
  --color-paper-2: rgb(var(--c-bg-sunken)); /* bg-sunken */
  --color-paper-3: rgb(var(--c-surface-2)); /* bg-surface-2 */
  --color-ink: rgb(var(--c-fg)); /* text-fg */
  --color-ink-2: rgb(var(--c-fg-muted)); /* text-muted */
  --color-muted: rgb(var(--c-fg-muted)); /* text-subtle is the faintest text, 4.5:1 on every surface */
  --color-rule: rgb(var(--c-border) / var(--c-border-alpha)); /* border-line */
  --color-accent: rgb(var(--c-accent)); /* 161 92 0 light, 233 162 59 dark and on ink */
  --color-accent-ink: rgb(var(--c-accent-fg));
  --color-focus: rgb(var(--c-accent));
  --font-display: 'Instrument Serif', Georgia, serif;
  --font-body: 'Geist Variable', system-ui, sans-serif; /* labels and meta too */
  --font-mono: 'Geist Mono Variable', ui-monospace; /* code only */
  --radius-card: 0.75rem;
  --radius-pill: 999px;
  --rule-hair: 1px;
  --shadow-card: none;
}
```

Type roles are utilities: `text-display` (h1), `text-display-s`, `text-section` (h2), `text-title` (h3),
`text-lead`, `text-label` (meta). Space is `--space-3xs` to `--space-4xl`; rhythm is `.sec`, `.sec-m`, `.sec-l`
(`--section-gap-s|-|-l`, 120/144/176px at desktop); the container is `.wrap` (`--container` 1440px, `--gutter`).

## Controls

- Primary: `.btn-primary`, ink fill (paper text), gold on hover · pill · 44px. One a page.
- Secondary: `.btn-ghost`, outlined · same radius and height. Header actions are secondary.
- Labels: `.meta`, the body face a step smaller, sentence case, untracked. No eyebrows, no mono labels.
- Pictures: `.shot`, a capture with the card radius and an inset outline; never a drawn browser bar or bezel.

## Motion

- Character: calm. One entrance (the hero's name, word by word, under 0.7s), one reveal (`data-reveal`, gated on
  `.js`), the ticker with its pause control, the reading hairline. `transform` and `opacity` only; under reduced
  motion everything ends at once.

## Exports

`src/styles/tokens.css` in this project, already a Tailwind v4 `@theme`. DTCG or shadcn blocks on request.
