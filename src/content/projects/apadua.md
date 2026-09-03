---
title: 'Procurement Intelligence Platform'
blurb: 'Long-running engineering work on a German B2B SaaS product — the schema, services and front end behind procurement data that enterprise buyers make decisions from.'
period: 'Ongoing'
weight: 80
kind: 'Client work'
role: 'Software engineer — data model, services, front end'
status: 'Ongoing'
stack: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS']
tags: ['SaaS', 'B2B', 'Data modelling', 'Europe']
featured: true
stats:
  - { label: 'Domain', value: 'Procurement' }
  - { label: 'Market', value: 'Germany / EU' }
  - { label: 'Shape', value: 'Multi-tenant SaaS' }
---

Client work for [Apadua](https://www.apadua.com), a German procurement-intelligence platform.
Most of what I build now ships under someone else's name, so this entry is about the class of
engineering rather than a feature list.

## What this kind of product actually demands

Enterprise B2B SaaS looks unglamorous from outside and is the most unforgiving thing to model
well. Three things dominate:

**Multi-tenancy is a schema decision, not a middleware one.** Every table either belongs to a
tenant or explicitly does not, and getting that wrong is the one bug class you cannot ship. Row
scoping has to be structural — enforced by the data model and the query layer — because a
filter that a developer must remember to add is a filter that will eventually be forgotten.

**The data model outlives every opinion about the UI.** Procurement data has a real-world shape
that predates the software: suppliers, categories, contracts, evaluations, and the
relationships between them that clients will disagree about. Screens get redesigned yearly;
badly-named columns are still there in five years, with dashboards depending on them. So the
modelling work gets the argument, and the front end gets the iteration.

**Enterprise buyers care about audit, not features.** Who changed this, when, and what did it
say before. That is a design constraint from day one — append-only history where it matters,
and mutation paths narrow enough to be logged honestly — not something you retrofit when the
first customer asks for it.

## What I do on it

Data model and migrations, service boundaries and API contracts, the TypeScript/React front end
against those contracts, and the deploy path. The parts of the job that show up as tickets are
the smaller half; the useful half is being the person who has to explain, two years later, why
a boundary is where it is.

Working six time zones from the stakeholders also settles a stylistic question by force. Every
non-obvious decision goes in the pull request — what I chose, what I rejected, what would make
me revisit it — because a reasoning chain that exists only in my head is unavailable to
everyone who needs it while I am asleep.
