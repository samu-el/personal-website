---
title: 'short.et'
blurb: 'A URL shortener, twice — once as a quick JavaScript build, then rewritten as a Python monolith to see what the second attempt taught me.'
period: '2023 — 2025'
weight: 70
kind: 'Tool'
role: 'Sole author'
status: 'Live'
stack: ['Python', 'JavaScript', 'PostgreSQL', 'Vercel']
tags: ['Open source', 'Infrastructure', 'Side project']
repo: 'https://github.com/samu-el/short.et-mono'
demo: 'https://url-shortner-pi-swart.vercel.app'
stats:
  - { label: 'Versions', value: 'Two' }
  - { label: 'Second pass', value: 'Python mono' }
---

A URL shortener is the "hello world" of systems design, which is exactly why it is worth
building twice.

The first pass was JavaScript and fast. The second — `short.et-mono` — was a deliberate
rewrite as a Python monolith, and the more interesting one, because by then I knew what the
first version had got away with:

- **Key generation.** Random-and-check is fine until it isn’t; the collision behaviour under
  load is the whole design.
- **The read path is the product.** Redirects are a cache problem. Everything else is an admin
  panel.
- **Analytics change the write pattern.** Counting a click on the hot path is a decision, not
  a detail.

Kept public because a small, complete, honest codebase is more useful to someone learning than
a large ambitious one that doesn’t run.
