---
title: 'Amharic Translation Bot'
blurb: 'A Telegram bot that translates text into Amharic — an early, honest look at what language tooling does and does not do for Ethiopian languages.'
period: '2020'
weight: 55
kind: 'Tool'
role: 'Sole author'
status: 'Archived'
stack: ['Python', 'Telegram Bot API']
tags: ['Amharic', 'NLP', 'Ethiopia', 'Open source']
repo: 'https://github.com/samu-el/transate-to-amharic-telegram-bot'
stats:
  - { label: 'Target', value: 'Amharic (አማርኛ)' }
  - { label: 'Verdict', value: 'Instructive failure' }
---

Built in 2020, and the repository description is deliberately modest — a bot that *tries* to
translate text into Amharic. That word is the finding.

Amharic has around 30 million native speakers and a writing system, Fidäl, with its own
script. It is also, by every practical measure, low-resource: the training data that makes
translation feel solved for European languages barely exists for it. So the output was
sometimes right, sometimes structurally wrong in ways a speaker spots instantly, and the gap
between those two cases was not something better prompting was going to close.

I keep it public because it dates a position I still hold: **the AI capability gap for African
languages is a data and incentive problem, not a model problem.** Five years and several model
generations later, Amharic is still meaningfully behind — not because it is harder, but because
far fewer people have been paid to work on it.

That is a fixable situation. It is largely fixable by people who speak the language, which is
a reasonable argument for where engineering capacity should sit.
