# Content provenance & what needs your eyes

The site is live at **https://smr.et**.

Everything on this site was written from **public sources plus reasonable inference**. This file
records where each claim came from and flags the ones only you can confirm. Read the flagged
list before you share the URL.

The site is positioned as **a software engineer selling engineering skills**. Your formal title
at Mereb (CTO, co-founder) appears nowhere — that was deliberate, per your instruction. Mereb
appears only as your current employer in the timeline. If you ever want the title back, it goes
in `src/lib/site.ts` (`role`) and `src/data/experience.ts` (the first entry's `title`).

---

## Verified from public sources

| Fact                                              | Source                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Samuel Mussie, at Mereb Technologies since ~2020  | [LinkedIn](https://www.linkedin.com/in/samu-el/), company listings                                      |
| Based in Addis Ababa, Ethiopia                    | LinkedIn                                                                                                |
| Attended Addis Ababa University                   | LinkedIn                                                                                                |
| Mereb serves European/US clients from Addis Ababa | mereb.tech                                                                                              |
| Email `samuel@smr.et`                             | Your own domain, via Cloudflare Email Routing                                                           |
| Every project entry, repo link and live demo URL  | [github.com/samu-el](https://github.com/samu-el) — names, descriptions, languages, deploy URLs all real |
| Eight languages, 30+ repos, first commit 2016     | Your public repository list and account age                                                             |

Project pages are built on your actual repositories: `check-exam-results-TBot`, `telemed`,
`rag-chatboat-backend` + `rag-chatbot-fe`, `short.et-mono`, `fantasy-pl` + `fantasy-pl-mobile`,
`transate-to-amharic-telegram-bot`, `jeopardy`, `FChat`, `RestaurantAppIOS`, and the utility
set. Descriptions, languages and periods come from the repos themselves.

---

## Needs your confirmation

The site has been stripped to verifiable facts — role, stack, timeline, links — with the voice
removed so you can write your own. What remains that still needs checking:

1. **Degree and dates at Addis Ababa University.** Listed as "Undergraduate studies" with no
   dates, because only the institution is public. Add the real degree and years.
2. **"Ten years", "eight languages", "three platforms", "30+ repositories".** Derived from your
   public commit history (account 2016, earliest repo 2017) and the languages across your repos:
   TypeScript, Python, JavaScript, Dart, Swift, PHP, Java, SQL. Adjust if you started
   professionally earlier or want SQL excluded from the count.
3. **The 2016–2020 independent period.** Framed as contract work, from the freelance-to-company
   story Mereb tells publicly. If you had named employers then, list them instead.
4. **What you do at Mereb.** The timeline lists data modelling, service boundaries, front ends,
   mobile, retrieval pipelines, deploys and on-call. Plausible for your role but not publicly
   documented — confirm or trim.
5. **The stack page.** Some entries are inferred rather than evidenced: Terraform, Linear,
   Redis, MongoDB, Cloudflare, FastAPI, pgvector. Delete anything you do not actually use — a
   stack page listing a tool you cannot discuss is a liability in an interview.
6. **The client-work entry** (`src/content/projects/client-saas-platform.md`). Anonymised and
   `hidden: true`, so it does not render or appear in the sitemap. The stack is inferred from the
   product category. Re-read it before ever unhiding it.
7. **Commitments the site makes.** Now just two: "Available to collaborate" (hero panel and
   footer) and "Open to new roles and collaborations" (contact page). The earlier working hours,
   contract/full-time wording and "CV and references on request" were removed at your request.
   If you are not looking, change the hero eyebrow ("Available for work") and the footer.
8. **The About bio is a placeholder.** Three short factual paragraphs plus Languages, Education
   and Code headings. It is accurate but deliberately flat — no opinions, no anecdotes, no claims
   about how you think. **This is the piece to rewrite in your own voice**, in
   `src/pages/about.astro`.

## Deliberately left out

- **All voice.** The opinionated copy is gone: the four "positions I will defend", the essays,
  the services pitch, the invented anecdotes, and the case-study reasoning in the fantasy.et
  write-up (which also removes the two technical claims about it I could not verify). What is
  left states facts and stops.
- **A higher-resolution photograph.** The one you sent is 72×72, which is enough for the 32px
  header avatar and the 62px mark on the social card — both now use it (`src/assets/avatar.jpg`).
  It is _not_ enough for an About-page portrait or the app icons, which need 512px. Send a larger
  file and replace that one asset; the header and card pick it up automatically.
- **The favicon and app icons are still the "SM" monogram** (`public/favicon.svg`,
  `scripts/assets/icon.html`). Deliberate: a face is not legible at 16px. With a larger source I
  can switch the 180/192/512px app icons to the photo and leave the favicon as the monogram.
- **No phone number, address or rates.**
- **No testimonials or client names.**
- **No X/Twitter link** — no account I could confirm was yours. Add it to `src/lib/site.ts`.
- **Nine project files deleted.** They rendered nowhere once the enumerated list came off
  `/work`, and their bodies were invented prose in a public repo. Git history has them if you
  want any back.

## Where to edit what

| You want to change…                  | Edit                                            |
| ------------------------------------ | ----------------------------------------------- |
| Name, role, email, nav, social links | `src/lib/site.ts`                               |
| Timeline, metrics                    | `src/data/experience.ts`                        |
| Tools, types of work                 | `src/data/stack.ts`                             |
| A project                            | `src/content/projects/<slug>.md`                |
| An essay                             | `src/content/posts/<slug>.md`                   |
| The About bio (the placeholder)      | `src/pages/about.astro`                         |
| Hero copy                            | `src/pages/index.astro`                         |
| Contact routes and practicalities    | `src/pages/contact.astro`                       |
| Colours, type scale                  | `src/styles/global.css`                         |
| Social card                          | `scripts/assets/og.html`, then `npm run images` |
