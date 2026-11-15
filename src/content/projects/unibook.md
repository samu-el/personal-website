---
title: 'Unibook'
blurb: 'Every bookmark in one library: posts, videos, listings, messages and articles from X, TikTok, YouTube, Telegram, Jiji or any website, kept as a copy so a deleted post or expired listing is still there.'
period: '2026'
weight: 95
kind: 'Product'
role: 'Sole author'
status: 'Live'
stack: ['TypeScript', 'Next.js', 'React', 'Python', 'FastAPI', 'PostgreSQL', 'Redis', 'Vercel']
tags: ['Bookmarks', 'Archiving', 'PWA']
repoPrivate: true
demo: 'https://unibook.smr.et'
featured: true
stats:
  - { label: 'Sources', value: 'X, TikTok, YouTube, Telegram, any site' }
  - { label: 'Capture', value: 'Text + images archived' }
  - { label: 'Ingress', value: 'Paste, Android share' }
---

A bookmark manager that keeps what you saved, not just the link.

## What it is

Paste a link, or share it from any Android app once the PWA is installed. Links are canonicalised
(tracking parameters stripped, shortlinks resolved) and deduplicated. A worker captures the page
through an SSRF-guarded fetcher: oEmbed for X, TikTok and YouTube, OpenGraph and JSON-LD for
everything else, including price, currency and condition for marketplace listings. Images are
archived to S3 and deduplicated by hash, and the raw response is kept for re-parsing.

Each content type gets its own card: posts with an image grid, vertical and horizontal video,
galleries, listings with a price badge, Telegram message bubbles, articles. The library is grouped by
date, filtered by source, type and capture status, and searchable.

## Stack

- **Web**: Next.js and React, in TypeScript, on Vercel.
- **Backend**: FastAPI with an arq worker on Redis, PostgreSQL, S3-compatible storage.

## Links

- Live: [unibook.smr.et](https://unibook.smr.et)
