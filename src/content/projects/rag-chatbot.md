---
title: 'RAG Chatbot'
blurb: 'A retrieval-augmented chat system — Python service, TypeScript client — built to find out where retrieval actually breaks in production rather than in a demo.'
period: '2025'
weight: 85
kind: 'Product'
role: 'Sole author'
status: 'Shipped'
stack: ['Python', 'FastAPI', 'TypeScript', 'React', 'Vector search', 'LLM APIs']
tags: ['AI', 'RAG', 'Retrieval', 'Evals']
repo: 'https://github.com/samu-el/rag-chatboat-backend'
featured: false
hidden: true
stats:
  - { label: 'Backend', value: 'Python / FastAPI' }
  - { label: 'Client', value: 'React / TypeScript' }
  - { label: 'Split', value: 'Two repos, one contract' }
---

Two repositories, one system: a Python retrieval and generation service, and a TypeScript
client that talks to it over a deliberately narrow API. I built it because I was about to
advise clients on AI features and refused to do that from blog posts.

## What the exercise settled

**The model is the cheap part.** Ingestion is where quality is won or lost — chunk boundaries
that respect document structure, metadata that survives the embedding step, and knowing which
documents are authoritative when two of them disagree. Swapping the model changes the prose.
Fixing retrieval changes the answers.

**Citations are a correctness feature, not a UI flourish.** The moment a response links to the
span it came from, you can tell a retrieval failure from a generation failure. Without that,
every bug report is "it said something wrong" and you are debugging blind.

**Evals before launch or not at all.** A fixed question set with expected sources, run on every
change. It is unglamorous, takes an afternoon, and is the only reason you can later say a
change made things better rather than different.

**Keep the model away from the write path.** Retrieval reads. Anything that mutates state goes
through code you can audit and a human who can reverse it.

Splitting the client from the service was the other point. It forces the API to be a real
contract instead of a leaky pipe — which is what makes any of it replaceable later.
