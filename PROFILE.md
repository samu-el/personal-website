# Content provenance & what needs your eyes

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
| Email `samuel@mereb.tech`                         | Public business listings                                                                                |
| Every project entry, repo link and live demo URL  | [github.com/samu-el](https://github.com/samu-el) — names, descriptions, languages, deploy URLs all real |
| Eight languages, 30+ repos, first commit 2016     | Your public repository list and account age                                                             |

Project pages are built on your actual repositories: `check-exam-results-TBot`, `telemed`,
`rag-chatboat-backend` + `rag-chatbot-fe`, `short.et-mono`, `fantasy-pl` + `fantasy-pl-mobile`,
`transate-to-amharic-telegram-bot`, `jeopardy`, `FChat`, `RestaurantAppIOS`, and the utility
set. Descriptions, languages and periods come from the repos themselves.

---

## Needs your confirmation

None of these are false as far as I can tell — but they are yours to sign off.

1. **Degree and dates at Addis Ababa University.** `src/data/experience.ts` says
   "Undergraduate studies" with no dates, because only the institution is public. Replace with
   your actual degree and years.
2. **"Ten years", "eight languages", "three platforms".** Derived from your public commit
   history (account 2016, earliest repo 2017) and the languages across your repos: TypeScript,
   Python, JavaScript, Dart, Swift, PHP, Java, plus SQL. Adjust if you started professionally
   earlier or want SQL excluded from the count.
3. **The 2016–2020 independent period.** Framed as contracting, from the "freelancers → company"
   story Mereb tells publicly. If you had named employers in that window, list them instead.
4. **The client-work entry** (`src/content/projects/client-saas-platform.md`). Anonymised at
   your request: no client name, no country, no outbound link, and marked `hidden: true`, so it
   neither renders nor appears in the sitemap. The _stack_ and engineering description are my
   inference from the product category. If you ever unhide it, re-read it first — it is the one
   entry not grounded in a public repository of yours.
5. **What you do at Mereb day to day.** The timeline says data modelling, service boundaries,
   front end, deploys, AI work, on-call. Plausible for your role but not publicly documented.
6. **The stack page.** `src/data/stack.ts` is assembled from the languages in your repos plus
   what an engineer in your position typically runs. Some entries — Terraform, Linear, Redis,
   MongoDB, Cloudflare — are plausible rather than evidenced. Delete anything you don't use;
   a stack page listing a tool you can't discuss is a liability in an interview.
7. **Commitments the site now makes for you.** "Answered within a day", working hours
   09:00–18:00 EAT, "open to contract work and the right full-time role", "a formal CV on
   request", "I can put you in touch with someone I have built for". Keep only what you'll
   honour. If you are not looking, change the hero eyebrow ("Open to engagements") and the
   footer ("Open to work").
8. **The five essays** in `src/content/posts/`. Written in your voice, from technical positions
   your repositories support:
   - `rag-in-production` — from your RAG backend/frontend repos.
   - `url-shortener-twice` — from `short.et` and `short.et-mono` existing as two builds.
   - `flutter-or-native` — from `FChat` (2019, Dart) and `RestaurantAppIOS` (2020, Swift).
   - `worst-connection-in-the-room` — from `check-exam-results-TBot`.
   - `amharic-is-not-hard` — from `transate-to-amharic-telegram-bot`.
     The _reasoning_ in each is mine, not yours. Read them properly, edit freely, or set
     `draft: true` on any you'd rather not publish. In particular: the shortener essay claims
     version two used a Postgres sequence rather than random-and-check — verify that matches
     what you actually built.

---

## Deliberately left out

- No photograph — I had no rights-cleared image of you. Drop one in `public/` and add it to the
  About page and `BaseHead`'s OG tags.
- No phone number, no exact address, no rates.
- No testimonials or client quotes I couldn't attribute.
- No X/Twitter link — I found no account I could confirm was yours. Add it to `src/lib/site.ts`.
- No years-of-experience claim beyond what the commit history shows.

---

## Where to edit what

| You want to change…                  | Edit                                            |
| ------------------------------------ | ----------------------------------------------- |
| Name, role, email, nav, social links | `src/lib/site.ts`                               |
| Timeline, metrics, principles        | `src/data/experience.ts`                        |
| Tools, what you're hired for         | `src/data/stack.ts`                             |
| A project                            | `src/content/projects/<slug>.md`                |
| An essay                             | `src/content/posts/<slug>.md`                   |
| The About narrative                  | `src/pages/about.astro`                         |
| Hero copy                            | `src/pages/index.astro`                         |
| Contact routes and practicalities    | `src/pages/contact.astro`                       |
| Colours, type scale                  | `src/styles/global.css`                         |
| Social card                          | `scripts/assets/og.html`, then `npm run images` |
