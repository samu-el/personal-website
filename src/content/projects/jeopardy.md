---
title: 'Jeopardy'
blurb: 'A rebuild of howardchung/jeopardy on Bun, Next.js and TypeScript: the board, the buzzer, shared rooms and AI opponents, playing archived episodes or custom boards.'
period: '2026'
weight: 90
kind: 'Open source'
role: 'Sole author'
status: 'Live'
stack: ['TypeScript', 'Next.js', 'React', 'Bun', 'Socket.IO', 'Vercel']
tags: ['Game', 'Realtime', 'AI']
repo: 'https://github.com/samu-el/jeopardy'
demo: 'https://jeopardy.smr.et'
featured: true
stats:
  - { label: 'Mode', value: 'Solo vs AI' }
  - { label: 'Data', value: 'J! Archive' }
  - { label: 'Hosting', value: 'Vercel' }
---

A rebuild of [howardchung/jeopardy](https://github.com/howardchung/jeopardy) on Bun, Next.js and
TypeScript.

## What it is

The full game: archived and custom boards, every round, Daily Doubles, Final Jeopardy wagers, buzz
windows with the early-buzz lockout, judging by a host or a fuzzy judge, chat, replays and stats.
Clues come from the J! Archive dataset published by
[j-archive-parser](https://github.com/howardchung/j-archive-parser). AI opponents in four
difficulty tiers pick clues, ring in, answer and wager on their own. The clue is read aloud by a
system voice, and the buzzer opens when the readout ends.

The hosted build at [jeopardy.smr.et](https://jeopardy.smr.et) runs solo play against those
opponents.

## Stack

- **App** — Next.js and React, in TypeScript, with MUI components and Zustand for client state.
- **Runtime** — Bun, with a custom server that also hosts the Socket.IO bridge for shared rooms.
- **Rooms** — server-authoritative: the server owns the board, the buzzer and the clock, and
  clients send intent only. Redis, when configured, keeps rooms across restarts. Shared rooms need
  the custom server, so they are not part of the Vercel deployment.
- **Sound** — a synthesized cue set. The show's own recordings are copyrighted and are not shipped.

## Links

- Live: [jeopardy.smr.et](https://jeopardy.smr.et)
- Source: [github.com/samu-el/jeopardy](https://github.com/samu-el/jeopardy)
