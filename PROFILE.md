# Content provenance & what needs your eyes

Everything on this site was written from **public sources plus reasonable inference**. This file
records where each claim came from and flags the ones only you can confirm. Read the flagged
list before you share the URL.

---

## Verified from public sources

| Fact                                                          | Source                                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Samuel Mussie, co-founder & CTO, Mereb Technologies           | [LinkedIn](https://www.linkedin.com/in/samu-el/), company listings                                      |
| Based in Addis Ababa, Ethiopia                                | LinkedIn                                                                                                |
| Attended Addis Ababa University                               | LinkedIn                                                                                                |
| Mereb founded 2020; freelance → company in 2021               | Mereb company listings, `merebtechnology.com/ourstories`                                                |
| Offices: Addis Ababa · Warsaw · Sheridan, WY                  | Mereb site and company listings                                                                         |
| Serves European/US SaaS companies under an EU contract        | mereb.tech positioning                                                                                  |
| "50+ companies", Apadua GmbH as a named client                | mereb.tech, `mereb.tech/case-studies/apadua-gmbh`                                                       |
| Engineers average 6+ years; no juniors staffed on client work | mereb.tech                                                                                              |
| Mereb Podcast — Amharic, Ethiopia's tech ecosystem            | Mereb Podcast YouTube channel and LinkedIn posts                                                        |
| Email `samuel@mereb.tech`                                     | Public business listings                                                                                |
| Every project entry, repo link and live demo URL              | [github.com/samu-el](https://github.com/samu-el) — names, descriptions, languages, deploy URLs all real |

Project pages are built on your actual repositories: `check-exam-results-TBot`, `telemed`,
`rag-chatboat-backend` + `rag-chatbot-fe`, `short.et-mono`, `fantasy-pl` + `fantasy-pl-mobile`,
`transate-to-amharic-telegram-bot`, `jeopardy`, `FChat`, `RestaurantAppIOS`, and the utility
set. Descriptions, languages and periods come from the repos themselves.

---

## Needs your confirmation

These are the places where I inferred, generalised, or wrote in your voice. None of them are
false as far as I can tell — but they are yours to sign off.

1. **Degree and dates at Addis Ababa University.** `src/data/experience.ts` says
   "Undergraduate studies" with no dates, because only the institution is public. Replace with
   your actual degree and years.
2. **The 2016–2020 independent period.** Framed from your public commit history (earliest repo
   2017, account 2016) and the "freelancers → company" story. If you had named employers in
   that window, they should be listed instead.
3. **"A decade of shipping code."** Derived from the 2016 GitHub account. Adjust if you started
   professionally earlier.
4. **Apadua engagement details** (`src/content/projects/apadua.md`). That Apadua is a client and
   has a case study is public; the _stack_ listed (TypeScript/React/Node/Postgres/AWS) and the
   embedded-team mechanics are my inference from how Mereb describes its model. Correct or
   generalise before a client reads it.
5. **The stack page.** `src/data/stack.ts` is assembled from the languages in your repos plus
   what a CTO in your position typically runs. Some entries — Terraform, Linear, Redis,
   MongoDB, Cloudflare — are plausible rather than evidenced. Delete anything you don't use.
6. **Claims in first person about policy.** "No juniors on client work", "6+ years, no
   exceptions", "references on request — I'll connect you with a client CTO", "answered within a
   day", working hours 09:00–18:00 EAT, invoicing in EUR/USD. The first two are from Mereb's own
   copy; the rest are commitments the site now makes on your behalf. Keep only what you'll honour.
7. **The five essays** in `src/content/posts/`. Written in your voice, from positions your
   public material supports. They are arguments you'd likely make — but they are not your words.
   Read them properly, edit freely, or set `draft: true` on any you'd rather not publish.
8. **"Open to engagements"** in the hero and "Open to work" in the footer. Change if you're not.

---

## Deliberately left out

- No photograph — I had no rights-cleared image of you. Drop one in `public/` and add it to the
  About page and `BaseHead`'s OG tags.
- No phone number, no exact street address.
- No testimonials or client quotes I couldn't attribute.
- No claim about team size. Public listings say 11–50; that range reads badly either way, so the
  metric row uses office count instead. Add a real number if you want one.
- No X/Twitter link — I found no account I could confirm was yours. Add it to
  `src/lib/site.ts` if you have one.

---

## Where to edit what

| You want to change…                  | Edit                                           |
| ------------------------------------ | ---------------------------------------------- |
| Name, role, email, nav, social links | `src/lib/site.ts`                              |
| Timeline, metrics, principles        | `src/data/experience.ts`                       |
| Tools, services                      | `src/data/stack.ts`                            |
| A project                            | `src/content/projects/<slug>.md`               |
| An essay                             | `src/content/posts/<slug>.md`                  |
| The About narrative                  | `src/pages/about.astro`                        |
| Hero copy                            | `src/pages/index.astro`                        |
| Colours, type scale                  | `src/styles/global.css`                        |
| Social card                          | `scripts/assets/og.svg`, then `npm run images` |
