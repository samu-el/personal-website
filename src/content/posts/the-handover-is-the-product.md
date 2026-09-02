---
title: 'The handover is the product'
description: "Six time zones between a team and its stakeholders is not a communication problem to be solved with more meetings. It is a design constraint, and the teams that treat it that way outperform the ones sitting in the same room."
pubDate: 2026-04-22
tags: ['Distributed teams', 'Engineering leadership', 'Process']
featured: true
---

Every objection to a remote engineering team is really the same objection: *you won’t know what
they’re doing.*

It is a fair worry, and the standard fix makes it worse. The standard fix is meetings — a daily
sync, then an overlap window, then a second sync for the people who missed the first. What you
have built at that point is a team that spends its overlap hours performing progress and its
remaining hours recovering from having done so.

We run embedded teams out of Addis Ababa for clients in Germany, elsewhere in Europe, and the
US. The thing that actually works is not more contact. It is treating the handover as an
artefact you design.

## Distance makes undocumented decisions disappear

In one room, a decision can live in the air. Two people talk at a whiteboard, agree, and the
reasoning survives in their heads — good enough, because they are both there next week when it
comes up.

At distance, that decision does not exist. Not "is harder to find" — does not exist. The person
who needs it is asleep, was not in the conversation, and has no way to know a conversation
happened.

So the rule is blunt: **if a decision isn’t written down, it wasn’t made.** Not a document with
a template and an owner and a review cycle. Three sentences in the pull request: what we chose,
what we rejected, what would make us revisit it.

The overhead is minutes. What it buys is that a stakeholder can reconstruct six weeks of
engineering judgement without interrupting anyone.

## Small changes are a communication strategy

A 40-file pull request across a time-zone gap is not a review, it is a hostage negotiation.
The reviewer cannot ask a clarifying question and get an answer for fourteen hours, so they
either rubber-stamp it or block it for a day. Both outcomes are bad and both are the author’s
fault.

Small, independently-shippable changes fix this without anyone changing their behaviour. They
also happen to be good engineering practice, which is why this is the easiest habit to
introduce: you are not asking people to communicate more, you are asking them to commit less at
a time.

## No meeting that a document could replace

We hold this one strictly, and it is the least popular rule until people have lived under it
for a month.

A meeting is the right tool when the outcome is genuinely unknown at the start — a design
argument, a hard prioritisation call, anything where you need to watch someone’s face. It is
the wrong tool for status, for anything one-directional, and for decisions already made
elsewhere.

Status becomes a written update the client reads at their own start of day. Decisions become
the three sentences above. What is left is a small number of meetings that are actually worth
being awake for.

The second-order effect matters more than the calendar space: when status has to be written,
vagueness stops working. "Making progress on the migration" survives a standup. It does not
survive a paragraph.

## Continuity is a technical concern

The industry’s default failure mode is rotation. An engineer leaves an engagement, a
replacement arrives, and everyone treats it as a staffing event.

It is not. After six months inside a client’s system, an engineer knows which service has the
undocumented retry, why that table has a nullable column that should never be null, and which
deploy sequence broke things last March. None of that is in the repository. Rotating them out
deletes it.

So retention on long-running engagements is something I manage as an architecture problem,
because that is what it functionally is. Overlap on handovers is measured in weeks. And the
cheapest thing we do — a running decision log per engagement — exists specifically so that the
knowledge which does survive is the knowledge that mattered.

## The uncomfortable part

Teams that run this way are better documented, more auditable, and easier to hand over than
most co-located teams I have seen. Not because remote engineers are better. Because
co-location lets you skip all of this and still function, so most teams do.

Distance removes that option. Which is why the constraint, taken seriously, is an advantage.
