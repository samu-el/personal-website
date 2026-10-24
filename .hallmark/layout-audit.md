# Layout audit

`npm run audit:layout` against `astro preview`: 15 routes and states (home, /about, /work, the four detail
pages, /stack, /now with a track and without, /contact, /writing, 404, command palette, mobile menu) at
1440x900, 1280x800, 1024x768, 768x1024, 390x844 and 360x740, light and dark. 172 page loads.

## Counts

| Route                  | Before | After |
| ---------------------- | -----: | ----: |
| home                   |     80 |     0 |
| about                  |     36 |     0 |
| work                   |     56 |     0 |
| work-fantasy-pl        |     40 |     0 |
| work-jeopardy          |     40 |     0 |
| work-lyvid             |     40 |     0 |
| work-monee             |     42 |     0 |
| stack                  |     36 |     0 |
| now / now-quiet        |  40/40 |   0/0 |
| contact                |      0 |     0 |
| writing                |     36 |     0 |
| not-found              |     36 |     0 |
| palette                |     20 |     0 |
| menu                   |      4 |     0 |
| Total (first run, 184) |    582 |     0 |

The first run also loaded the hidden client project's URL (a 404, 36 findings); the audit now lists only
projects that have a detail page.

## Findings and fixes

| Route                                           | Viewport    | Problem                                                                                                                      | Fix                                                                                                                                                                                                    |
| ----------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| palette                                         | 390, 360    | The command palette ran 16px past the right edge: `w-full` plus `inset-inline: 1rem` made it a viewport wide, shifted right. | `w-auto`: the insets size it, `max-w-[34rem]` and auto margins centre it on larger screens.                                                                                                            |
| /about, /work, /stack, /now, /contact, /writing | all         | Ink page header took 44 to 51% of a 900px screen (`lg:py-32`, 7rem headline, 16rem gold numeral).                            | `PageHeader`: `py-12 lg:py-20` (compact `py-10 lg:py-14`), headline `clamp(2.75rem, 7vw, 5.5rem)`, still above the footer's 5rem. Gold watermark capped at 10rem.                                      |
| home, /about                                    | 1024 and up | Section heads sat in 112px of padding and 80px above their content.                                                          | `Section`: `lg:py-24`, `lg:mt-16`.                                                                                                                                                                     |
| home, Selected work                             | 1024 and up | The 16:10 lead capture sat in the middle of a half column beside a phone twice its height; the two captions were 80px apart. | Twelve columns: the lead capture spans 8, the phone 4 at 15rem, aligned to the bottom, so both frames stand about as tall and captions share a line.                                                   |
| home, /work, monee                              | 390, 360    | The phone frame filled the column (19rem on a 360 screen), reading as a slab more than a handset.                            | `PreviewFrame` phone is 16rem below 640px, 19rem above; `previews.ts` sizes match.                                                                                                                     |
| every page                                      | 390, 360    | Flagged: footer, nav and meta links "spill 6px sideways".                                                                    | Not a layout bug: `.hit::after` grows the touch target with negative insets. The detector now measures the text runs themselves.                                                                       |
| home                                            | 360 to 1024 | Flagged: every block starts 20 to 32px right of the page edge.                                                               | Not a layout bug: the edge was the ticker's text, scrolled under the band's clip. The ticker carries `data-audit-clip-ok`, and a clip-ok container's content no longer counts as the page's left edge. |
| work-monee                                      | 360         | Flagged: the centred phone starts 8px in.                                                                                    | Resolved by the narrower phone frame (it is now clearly centred).                                                                                                                                      |
| palette, menu                                   | 390, 360    | Audit errors: the search button is inside the mobile menu on phones.                                                         | The audit opens the menu first.                                                                                                                                                                        |

## Looked at, left as is

- Home hero, ticker, stat strip and the detail-page banners: the design restored in #87, and they fit at every width.
- LYVID and Jeopardy show their dark capture in light mode: those products have one look, so one capture.
- /writing shows its empty state: there are no posts, and the page is out of the nav and the sitemap.
