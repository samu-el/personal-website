---
title: 'FChat'
blurb: 'A Flutter chat application from 2019 — the project that decided how I think about cross-platform mobile.'
period: '2019'
weight: 35
kind: 'Product'
role: 'Sole author'
status: 'Archived'
stack: ['Dart', 'Flutter', 'Firebase']
tags: ['Mobile', 'Flutter', 'Open source']
repo: 'https://github.com/samu-el/FChat'
stats:
  - { label: 'Platforms', value: 'iOS + Android' }
  - { label: 'Year', value: '2019' }
---

Flutter in 2019 was still an argument. I built a chat app to settle it for myself, because
recommending a cross-platform framework to a client on the strength of a keynote is not advice.

Chat is the right test case: real-time updates, an inverted scrolling list that has to stay
smooth, keyboard behaviour that differs meaningfully between platforms, and state that must
survive backgrounding. It exercises exactly the places where a cross-platform abstraction
usually leaks.

The conclusion held up, and it is still the one I give clients: **Flutter is the right call
when one team has to ship both platforms and the UI is yours to define.** It is the wrong call
when the product lives or dies on platform-native feel, or depends on a capability that lands
in the native SDK a year before it lands in a plugin. Which is why, the following year, I built
the iOS app on this site in Swift instead.
