---
title: 'LyVid'
blurb: 'Turns a Spotify or YouTube link into a word-synced lyrics video: lyrics aligned to every word, a style you can edit, and an MP4 rendered on the server. Every step is also an MCP tool.'
period: '2026'
weight: 97
kind: 'Product'
role: 'Sole author'
status: 'Live'
stack: ['TypeScript', 'Next.js', 'React', 'MCP']
tags: ['Video', 'Music', 'AI']
repoPrivate: true
demo: 'https://lyvid.smr.et'
featured: true
stats:
  - { label: 'Sync', value: 'Word, line, character' }
  - { label: 'Formats', value: '16:9, 9:16, 1:1, 4:5' }
  - { label: 'Agents', value: 'MCP server' }
---

Lyric videos, karaoke videos, podcast clips and shorts from a Spotify or YouTube link or an
uploaded audio file.

## What it is

Lyrics come from LRCLIB when they exist there; otherwise they are pasted in, plain or as LRC. A
forced aligner matches each word to the vocal track and reports its confidence, and any word that
landed wrong can be dragged into place. Styles start from presets (Karaoke Classic, Kinetic Type,
Social Captions, Lyric Sheet, Typewriter, Cinematic Subtitles) and every font, colour, background
and animation is editable. The preview is the renderer itself, so what you see is what exports.

Karaoke videos use the artist's instrumental when one is uploaded, and split one out of the mix
when it is not. Exports are MP4 in 16:9, 9:16, 1:1 or 4:5, rendered on the server.

## For agents

Every step is also an MCP tool: create an API key, point Claude or any other MCP client at
`https://lyvid-api.smr.et/mcp`, and ask for a video. The showcase videos on the site were made that
way, by a script calling the tools once per song.

## Links

- Live: [lyvid.smr.et](https://lyvid.smr.et)
