---
title: 'Amharic is not a hard language for AI. It is an unfunded one.'
description: "I built an Amharic translation bot in 2020 and it was mediocre. Several model generations later the gap has barely moved — and the reason is economic, not linguistic."
pubDate: 2025-10-08
tags: ['AI', 'Amharic', 'Ethiopia', 'Language']
---

In 2020 I built a Telegram bot that translated text into Amharic. The repository description
says it "tries to translate text into amharic," and I have never edited that sentence, because
it was accurate and it dates a position.

The output was sometimes right. It was also sometimes wrong in ways that any Amharic speaker
spots in under a second — morphology mangled, verb structure inverted, a word chosen that is
technically a synonym and pragmatically absurd. The failures were not subtle. They were the
failures of a system that had not seen enough of the language.

Several model generations have shipped since. The gap has narrowed less than you would expect
from the headlines.

## The convenient explanation, and why it is wrong

The story people reach for is that Amharic is unusually hard. It has its own script, Fidäl,
which is a syllabary rather than an alphabet. It is morphologically rich — Semitic
root-and-pattern verb structure, where a single root generates dozens of forms. Word boundaries
do not behave the way an English-trained tokeniser assumes.

All true. None of it is the reason.

Every one of those properties has a well-understood solution, and each has been solved for
other languages with the same features. Hebrew and Arabic are Semitic, morphologically rich,
and non-Latin script. Both are served substantially better. Nothing about Amharic’s structure
puts it beyond current methods.

## The actual explanation

Amharic has roughly 30 million native speakers and is a working language of a country of over
120 million people. And it is, by every practical measure, low-resource: the volume of clean,
aligned, permissively-licensed text that makes a language feel "solved" barely exists for it.

That is not a fact about the language. It is a fact about who has been paid to build datasets.

The pipeline that produced excellent French translation was decades of institutional
investment — parallel corpora from government translation offices, academic linguistics
programmes, commercial demand from companies who needed to sell in France. Amharic has had a
fraction of each. The models are not worse at Amharic because Amharic is harder. They are worse
because nobody funded the corpus.

This shows up in a way worth naming: capability tracks commercial market size, not speaker
count. There are languages with far fewer speakers and far better model support, because their
speakers were a market someone wanted.

## Why this is not a complaint

It is fixable, and it is fixable by a small number of people doing unglamorous work.

The bottleneck is data collection, annotation, and evaluation — building a benchmark that
actually measures Amharic competence rather than the model’s ability to produce plausible Fidäl
characters. That work needs people who speak the language natively enough to catch the second
kind of failure. It does not need a frontier lab’s compute budget.

Which means it is work that can and should happen where the speakers are. It is also,
inconveniently, work that no one outside those communities has a strong commercial reason to
do — so waiting for it to arrive from elsewhere is not a plan.

## The thing I keep coming back to

I keep the 2020 bot public and unfixed, mediocre output and misspelled repository name
included. It is a marker. When Amharic language tooling is genuinely good, I want to be able to
point at the year it was not, and at what changed in between.

My bet is that what changes is not a model release. It is a few hundred people deciding this is
a real problem and building the boring infrastructure of a well-resourced language: corpora,
benchmarks, tokenisers, evals.

There is no shortage of engineers in Addis Ababa who could do it. That is the same sentence I
find myself writing about most things, and it remains the point.
