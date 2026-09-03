---
title: 'I built the same URL shortener twice'
description: 'A shortener is the hello-world of systems design, which is exactly why it is worth building again once you know what the first version got away with.'
pubDate: 2026-06-18
tags: ['Systems design', 'Databases', 'Performance']
featured: true
---

The first version took an evening in JavaScript and worked fine. Two years later I rewrote it
as a Python monolith, on purpose, because by then I could see everything the first attempt had
quietly avoided.

Recommending a rewrite to a client is usually the wrong call. Doing one on your own toy project
is the cheapest education available.

## Key generation is the whole design

Version one generated a random six-character key, checked the database for a collision, and
retried on conflict. This is the standard answer and it is fine — until you ask what it does
under load.

At low occupancy, collisions are rare and the retry loop is invisible. As the keyspace fills,
the expected number of round trips per insert climbs, and every one of them is a read against
the table you are about to write to. The failure mode is not an error; it is insert latency
quietly becoming a function of how successful you have been.

The three honest options:

- **Random-and-check**, accepting that you must monitor occupancy and widen the key before it
  bites. Cheap, and correct if you actually watch it.
- **A counter, base62-encoded.** No collision check at all, because collisions are impossible.
  You have traded a probabilistic problem for a coordination one — the counter is now the thing
  that must not be a bottleneck or a single point of failure.
- **Pre-generate keys into a table** and hand them out. Insert becomes a claim on an existing
  row. Predictable latency, at the cost of a background job and a queue depth to watch.

Version two used the counter, with the sequence in Postgres. Not because it is the best answer
in general, but because "collisions cannot happen" removes an entire class of monitoring I did
not want to own.

## The read path is the product

Everything interesting about a shortener happens on redirect. Creating links is an admin
feature; following them is the service.

Which means the design question is not "what database" but "what is between the user and the
answer." The row is tiny, immutable once written, and read far more than it is written — the
textbook case for caching, and one of the few times a cache is not a premature optimisation.

Version two returns a `301` from cache and falls through to Postgres on a miss. The subtle part
is the negative case: an unknown key is also cacheable, and if you do not cache misses, anyone
scanning random keys is a free way to hammer your database.

## Analytics change the write pattern, so decide early

The moment you want click counts, the read path stops being read-only.

Incrementing a counter inside the redirect is the obvious implementation and the wrong one — you
have put a write, a lock, and a transaction on the hot path so that a dashboard can be accurate
to the second. Nobody needs that.

Version two pushes an event onto a queue and aggregates out of band. The dashboard is a few
seconds stale, the redirect stays a cache hit, and the two concerns can now fail
independently — which is the actual benefit, not the latency.

## What the second build was really for

Not the shortener. The habit.

Rewriting something you already understand strips out the part where you are learning the
domain, and leaves only the engineering. You see the decisions you made by default the first
time, and you find out which of them you would defend.

Both versions are public. The first one is shorter and I still like it.
