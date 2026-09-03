---
title: 'Designing for the worst connection in the room'
description: 'A Telegram bot that returns exam results in a few kilobytes, built for the one week a year when an entire cohort refreshes the same page at once. The constraint made every design decision for me.'
pubDate: 2025-12-02
tags: ['Constraints', 'Performance', 'Ethiopia', 'APIs']
featured: true
---

Every year, Ethiopian students sitting the university entrance exam wait for one result. And
every year the official portal meets the entire cohort arriving in the same minute — on mobile
data, on connections that were never sized for it.

I wrote a Telegram bot for it. The whole product is one sentence: **send an admission number to
a chat, get your result back.**

It is the smallest thing I have built and the one I would point at to explain how I think about
engineering.

## The constraint chose the platform

Telegram was not a novelty pick. In Ethiopia it is where people already are, and it has two
properties a web portal does not.

**It is cheap on the wire.** A text exchange is a few kilobytes. A results page with its CSS, its
fonts, its analytics and its framework bundle is not — and every one of those bytes is a chance
for a congested mobile network to drop the request and start over.

**The client owns delivery.** This is the one people underrate. A student on a bus through a dead
zone gets the answer when signal comes back, and never learns that anything went wrong.
Telegram retries, queues, and reconciles on their behalf. To get that on the web I would have to
build a service worker, an outbox, and a retry policy — and then debug it on the devices least
able to run it.

Choosing a platform whose failure modes already match your users' network is not a shortcut. It
is the design.

## The interesting engineering was never the bot

The bot framework part is an afternoon. Everything hard came from a single fact: the upstream
source was never built to be queried like this.

**Rate limiting, pointed at myself.** A popular bot in front of a fragile portal is a load
generator. If my thing becomes the reason the portal falls over, I have made the problem worse
for the students not using my thing. So the bot throttles its own upstream calls and queues
behind that limit, which means accepting that a user sometimes waits — and telling them so.

**Caching, because the same key is asked twice.** An admission number's result does not change.
Every repeat lookup that reaches upstream is waste I am inflicting on shared infrastructure.
Cache-on-first-read turns a re-check from a request into a memory hit, and re-checking is
exactly what an anxious eighteen-year-old does.

**Error messages, treated as a correctness feature.** This is the part I would fight for. A
student who receives a stack trace, a timeout, or a bare "not found" concludes that they failed
the exam. The upstream being slow and the student having failed are completely different facts
and must never produce the same message. Distinguishing "we cannot reach the source right now,
try in a minute" from "no record matches that number" from "that number is not in a valid
format" is not polish. Getting it wrong tells someone something untrue about their life.

## Why I keep bringing it up

Because none of that came from a best-practices list. It came from taking one constraint —
*these users are on the worst connection in the room, at the worst possible minute* — seriously
enough to let it decide the platform, the payload, the caching, and the copy.

Most systems have a constraint like that. Most teams find it in the incident review.
