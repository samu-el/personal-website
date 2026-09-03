---
title: 'Procurement Intelligence Platform'
blurb: 'Long-running engineering work on a European B2B SaaS product — the schema, services and front end behind procurement data that enterprise buyers make decisions from.'
period: 'Ongoing'
weight: 50
kind: 'Client work'
role: 'Software engineer — data model, services, front end'
status: 'Ongoing'
stack: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS']
tags: ['SaaS', 'B2B', 'Data modelling']
featured: false
hidden: true
stats:
  - { label: 'Domain', value: 'Procurement' }
  - { label: 'Shape', value: 'Multi-tenant SaaS' }
---

Client work under NDA, so this describes the class of engineering rather than the product.

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
