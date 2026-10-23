# Design: smr.et

What the site ships. `src/styles/tokens.css` is the source of truth for every value named here.

## Look

- Warm paper and ink, gold as the one accent, jade as a quiet second (live states only).
- An ink field opens every page: edge to edge, a faint twelve-column grid, the page's nav index as a gold
  watermark numeral on inner pages. The home hero sets the name large, the bio beside a ruled fact table.
- A gold ticker band of the stack under the home hero.
- Sections are numbered (`Section index`), each with a large ghost numeral on the right.
- Type: Instrument Serif for display (one italic gold word in most heads), Geist for body and UI, Geist Mono
  for small uppercase labels, dates, indices and hostnames (`.meta`).

## Components

- Buttons: `.btn-primary` (ink fill) and `.btn-ghost` (outlined), pills, arrows lead out of the button.
- Ledger rows (`.ledger-row`): index, title, description, icon; an accent hairline draws in on hover or press.
- Project frames (`PreviewFrame`): a drawn browser bar with the real hostname for a desktop capture, a phone
  body with a speaker slit for a phone capture. The capture matches the site's theme (`src/lib/previews.ts`).
  A warm glow follows the pointer and the frame tilts a few degrees under it.
- Footer: "Reach out." with the address and the contact page, the page index, the network links, the place
  and its clock.

## Copy rules

`AGENTS.md`: no taglines, helper text or secondary labels; no em dashes. Headings and content carry each
screen. `npm run lint:agent` and `npm run test:unit` enforce what can be checked.

## Motion

Gated three ways (reduced motion, fine pointer, `.js`): the hero words, the scroll reveal, the ticker with its
pause control, the frame tilt, the leaning buttons and the drifting watermarks. Every duration comes from the
`--t-1` to `--t-5` scale. Under reduced motion everything ends at once.
