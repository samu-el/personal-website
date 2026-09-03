---
title: 'Jeopardy'
blurb: 'A real-time Jeopardy game for team nights — buzzers, scoring, and the state-machine problems that come free with anything multiplayer.'
period: '2026'
weight: 45
kind: 'Product'
role: 'Sole author'
status: 'Live'
stack: ['TypeScript', 'React', 'Real-time state', 'Vercel']
tags: ['Games', 'Real-time', 'Side project']
repo: 'https://github.com/samu-el/jeopardy'
demo: 'https://jeopardy-delta-fawn.vercel.app'
stats:
  - { label: 'Mode', value: 'Multiplayer' }
  - { label: 'Hard part', value: 'Who buzzed first' }
featured: false
hidden: true
---

Built for team nights, and it turns out a quiz game is a compact tour of every problem
real-time software has.

Who buzzed first, when "first" is decided across several clients with different latencies? What
happens to a locked question when the host’s tab closes? How does a player who reconnects
mid-round get a consistent board rather than a guess?

None of that is visible if it works. All of it is visible immediately if it doesn’t — which
makes it a better teacher than most tutorials. A room full of colleagues will find your race
conditions faster than any test suite.
