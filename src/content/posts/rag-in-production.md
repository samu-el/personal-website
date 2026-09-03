---
title: 'What actually breaks when you ship RAG'
description: "I built a retrieval-augmented chat system end to end before advising any client on one. Almost nothing I expected to be the hard part was the hard part."
pubDate: 2026-01-19
tags: ['AI', 'RAG', 'Architecture', 'Evals']
featured: true
---

Clients started asking about AI features roughly the moment everyone else’s clients did. I
refused to advise from blog posts, so I built the thing: a Python retrieval and generation
service, a TypeScript client, a deliberately narrow API between them.

Here is what the exercise settled, in the order the lessons cost me time.

## The model is the cheap part

Swapping models changes the prose. It rarely changes whether the answer is correct.

If the retrieval step hands the model three chunks and none of them contain the answer, a
better model produces a more fluent wrong answer. That is worse, not better, because fluency is
what users read as confidence.

Almost all the quality lives in ingestion:

- **Chunk boundaries that respect document structure.** Splitting on a fixed token count cuts
  tables in half and severs headings from the paragraph they govern. Split on the document’s
  own structure, then size within that.
- **Metadata that survives embedding.** Which document, which section, what date, what
  authority. Without it you cannot reason about a wrong answer at all.
- **A resolution rule for contradictions.** Two documents will disagree. Something has to
  decide which one wins — recency, source authority, explicit override. If you don’t decide,
  the vector index decides for you, arbitrarily.

## Citations are a correctness feature

I initially built source links because they look trustworthy. They turned out to be the single
most valuable debugging affordance in the system.

With a citation, every bug report partitions cleanly. Either the cited span does not contain
the answer — a retrieval failure — or it does and the model got it wrong — a generation
failure. Two completely different fixes.

Without citations, every bug report is "it said something wrong," and you are guessing.

## Evals before launch, or not at all

A fixed question set with expected source documents, run on every change. Thirty questions is
enough to start.

It takes an afternoon and it is the only reason you can ever say a change made the system
better rather than merely different. Teams that skip this do not find out they have no baseline
until three months in, when someone asks whether last week’s prompt change helped, and the
honest answer is that nobody knows.

Build it before you need it. After launch you will never get the afternoon.

## Keep the model away from the write path

The strongest architectural boundary in the system: **retrieval reads, code writes.**

Anything that mutates state — sending an email, updating a record, charging a card — goes
through ordinary code, with ordinary validation, ideally with a human who can reverse it. The
model can propose. It does not execute.

This is not model distrust in the abstract. It is that a non-deterministic component in a write
path makes incidents unreproducible, and an incident you cannot reproduce is one you cannot
close.

## Cost is a design parameter, not a line item

Retrieval quality and cost are the same conversation. Better retrieval means fewer chunks in
context means a smaller prompt means a cheaper call *and* a more accurate one. Teams that treat
cost as something to optimise after launch usually discover the optimisation was "fix
retrieval," which is a rewrite.

## The advice I give clients now

Most requests for "an AI feature" are better served by a smaller model and better retrieval
than by the largest model available. That is not a cost-saving position, though it is cheaper.
It is that the work which makes retrieval good — clean ingestion, honest metadata, real evals —
is the work that makes the feature trustworthy.

The model is a component. The system around it is the product. That is unglamorous, and it is
where the entire difference between a demo and a shipped feature sits.
