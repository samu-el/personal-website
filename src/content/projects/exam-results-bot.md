---
title: 'Exam Results Bot'
blurb: 'A Telegram bot that returns Ethiopian university entrance exam results from an admission number — built for the one week a year when the whole country refreshes the same page at once.'
period: '2020 — 2025'
weight: 95
kind: 'Tool'
role: 'Sole author'
status: 'Live'
stack: ['Python', 'Telegram Bot API', 'HTTP scraping']
tags: ['Ethiopia', 'Telegram', 'Public interest', 'Open source']
repo: 'https://github.com/samu-el/check-exam-results-TBot'
featured: true
stats:
  - { label: 'Interface', value: 'Telegram' }
  - { label: 'Input', value: 'Admission number' }
  - { label: 'Payload', value: 'A few KB' }
---

Every year, Ethiopian students sitting the university entrance exam wait for one result. And
every year, the official portal meets the entire cohort arriving at the same minute — on
mobile data, on connections that were never sized for it.

This bot is the fix, and the whole design brief is in one sentence: **send an admission number
to a Telegram chat, get your result back.**

## Why Telegram

Telegram is not a novelty choice here — in Ethiopia it is where people already are, and it has
two properties the web portal does not:

- **It is cheap on the wire.** A text exchange is a few kilobytes. Loading a results page with
  its assets, on a congested mobile network, is not.
- **It retries for you.** The client owns delivery. A user on a train through a dead zone gets
  the answer when the signal comes back, without knowing anything went wrong.

## What it taught me

The interesting engineering was not the bot framework. It was everything around the fact that
the upstream source was never built to be queried this way: rate limiting so one popular bot
does not become the thing that takes the portal down, caching so the same admission number
does not cost two upstream requests, and clear failure messages, because a student who gets a
stack trace assumes they failed the exam.

It is a small program. It is also the one I would point at to explain what I think software is
for.
