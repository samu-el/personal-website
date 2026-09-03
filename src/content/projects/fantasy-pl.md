---
title: 'fantasy.et'
blurb: 'Fantasy Premier League tooling built twice over — a Next.js web app and a React Native companion sharing one data layer, against a public API that changes shape mid-season.'
period: '2025 — 2026'
weight: 100
kind: 'Product'
role: 'Sole author — data layer, web client, mobile client'
status: 'Live'
stack: ['TypeScript', 'Next.js', 'React', 'React Native', 'Public API', 'Vercel']
tags: ['Football', 'Data', 'Mobile', 'Caching', 'Real-time']
repo: 'https://github.com/samu-el/fantasy-pl'
demo: 'https://fantasy-pl-pearl.vercel.app'
featured: true
stats:
  - { label: 'Clients', value: 'Web + mobile' }
  - { label: 'Shared', value: 'One data layer' }
  - { label: 'Data', value: 'Live FPL API' }
  - { label: 'Load shape', value: 'Weekly spike' }
---

The project I keep coming back to, for the reason most side projects survive: I use it every
week, and so do the people I argue with about transfers.

It is also the most honest piece of engineering on this site. Nobody specified it, nobody paid
for it, and every decision in it is one I made because I thought it was right — then had to
live with on a Saturday morning when it was wrong.

## Why fantasy football is a real engineering problem

Strip away the football and what is left is a genuinely awkward system:

**The upstream API is not yours and changes underneath you.** Fantasy Premier League exposes a
public endpoint that the game's own clients use. It is undocumented, unversioned, and its shape
shifts across a season — fields appear, enumerations gain values, a structure you treated as
stable turns out to have been stable only because nothing had happened yet. Anything you build
on it has to fail loudly at the boundary rather than quietly three layers in, which in practice
means parsing and validating at the edge and refusing to let raw upstream objects into the rest
of the app.

**There is a deadline you cannot miss.** Transfers lock at a fixed time before the first match.
That is not a soft product goal; the entire value of the tool is being correct in the hour
before it. A cache that is stale by ninety seconds is fine on a Tuesday and useless at 11:29 on
a Saturday, so freshness has to be a function of proximity to the deadline rather than a single
TTL picked once.

**The load is a spike, not a curve.** Nobody opens the app for four days, then everybody opens
it at once. Designing for average traffic gets you a system that is idle when it is cheap and
falling over when it matters.

**The interesting numbers are derived.** Raw player data is not what anyone wants — form over a
window, fixture difficulty ahead, value per million, expected returns. Those are computed, they
depend on each other, and recomputing all of them per request is the naive implementation that
teaches you why materialisation exists.

## Two clients, one contract

The web app is Next.js; the companion is React Native. They share a single data layer, and
building both against it is the fastest way I know to find out which of your "shared" logic was
quietly web-only.

It always is, at first. Date handling that relied on the browser's timezone. A caching
assumption that only holds where there is a persistent HTTP cache. State that survived a
refresh but not a cold app launch. None of that shows up while you have one client — it shows
up the moment a second one consumes the same functions and disagrees about the answers.

Forcing the data layer to be genuinely client-agnostic made it better than it would have been.
That is the argument for building the second client even when you do not need it.

## What it is really for

This is where patterns get tried before they touch anyone's production system. A caching
strategy, a data-fetching approach, a way of typing an untrusted API response — if it survives
a Saturday when everyone opens the app at once and the deadline is twenty minutes out, it is
probably ready to propose at work.

If it does not survive, I find out from friends complaining in a group chat rather than from a
client. That is a considerably better feedback loop, and it costs me nothing but weekends I was
going to spend on football anyway.
