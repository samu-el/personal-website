---
title: 'Flutter or native: I shipped both, eighteen months apart'
description: 'In 2019 I built a chat app in Flutter. In 2020 I built an iOS app in Swift. Same rough scope, deliberately, so that my answer on cross-platform tradeoffs comes from having done it.'
pubDate: 2026-03-05
tags: ['Mobile', 'Flutter', 'iOS', 'Architecture']
featured: true
---

Flutter in 2019 was still an argument, and I was about to have that argument with a client. So I
built a chat app in it, and the following year built an iOS app natively in Swift with a
comparable scope.

That is the only reason I trust my own answer. Recommending a mobile framework off the back of
a conference talk is not advice, it is repetition.

## Chat was the right test case

If you want to find where a cross-platform abstraction leaks, do not build a list of cards.
Build chat.

Chat forces you through every place the platforms genuinely differ:

- **An inverted, growing list that must stay smooth.** New messages arrive at the bottom,
  scroll position has to survive them, and jank here is instantly visible.
- **Keyboard behaviour.** Avoidance, safe areas, the animation curve as it opens. iOS and
  Android disagree, and users on each platform notice when you have picked the other one.
- **State surviving backgrounding.** The OS can suspend you mid-send. Whether that message is
  lost, duplicated, or delivered is decided by your architecture, not your UI.
- **Real-time updates against a list you are also scrolling.** Diffing and reconciliation, on a
  widget tree, under a finger.

Flutter handled all of it. Not "handled it with workarounds" — handled it. The
render-everything-ourselves approach means the framework is not fighting two native widget sets;
it draws its own, consistently, on both.

## What the native build showed that the Flutter one could not

Login, a list, a detail view. The smallest complete app that still makes you deal with the real
thing: navigation controllers, view lifecycle, the layout system, and the parts of the platform
that a plugin hides from you right up until the day it does not.

The difference was not difficulty. It was **latency to the platform.**

When Apple ships a capability, it is in the SDK on day one. It reaches a Flutter plugin when
somebody writes one, and reaches a *good* Flutter plugin some time after that. For most apps
that gap is irrelevant. For an app whose value depends on the new thing, it is the entire
schedule.

## The answer I give now

**Flutter** when one team has to ship both platforms, the UI is yours to define, and you would
rather spend your budget on features than on maintaining two codebases that drift. This is most
products, honestly. A consistent custom design system across both platforms is something Flutter
is unusually good at, because it is not translating your intent into two sets of native widgets.

**Native** when the product lives or dies on platform feel — the app should disappear into the
OS and feel like Apple wrote it — or when you depend on a capability that lands in the native
SDK a year before it lands in a plugin. Also when the team is already deep in one platform and
the second is genuinely optional.

**React Native** occupies a real middle ground I have shipped in since: worth it when you have
an existing React team and a shared TypeScript codebase with the web, which is a business
argument as much as a technical one.

## The part that actually matters

None of the above is why I keep both repositories public.

They are there because the two builds cost me a few weekends and bought me a decade of being
able to answer that question honestly. Cross-platform is not a matter of taste, and the people
with the strongest opinions about it are usually the ones who have only shipped one side.
