---
title: 'Fantasy PL'
blurb: 'Fantasy Premier League tooling — a TypeScript web app and a companion mobile client — because arguing about transfers is better with data.'
period: '2025 — 2026'
weight: 60
kind: 'Product'
role: 'Sole author'
status: 'Live'
stack: ['TypeScript', 'Next.js', 'React Native', 'Public API']
tags: ['Football', 'Data', 'Side project', 'Mobile']
repo: 'https://github.com/samu-el/fantasy-pl'
demo: 'https://fantasy-pl-pearl.vercel.app'
stats:
  - { label: 'Clients', value: 'Web + mobile' }
  - { label: 'Data', value: 'Live FPL API' }
---

The side project I keep coming back to, for the reason most side projects survive: I use it
every week.

Fantasy Premier League is a genuinely good engineering problem in miniature — a public API
that changes shape mid-season, a schedule of deadlines you cannot miss, derived statistics
that need to be recomputed cheaply, and a user (me) with strong opinions about latency.

Two clients share one data layer: a Next.js web app and a React Native companion. Building
both against the same contract is the fastest way to find out which of your "shared" logic was
quietly web-only.

It is also where I try things before they touch a client codebase. If a caching strategy or a
data-fetching pattern survives a Saturday when everyone opens the app at once, it is probably
ready for someone’s production.
