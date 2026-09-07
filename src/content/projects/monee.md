---
title: 'Monee'
blurb: 'Personal finance on the phone: turns the transaction alerts banks and mobile wallets already send into a ledger you confirm, with budgets and reports, and keeps everything on the device.'
period: '2026'
weight: 95
kind: 'Product'
role: 'Sole author'
status: 'Ongoing'
stack: ['TypeScript', 'React Native', 'Expo', 'SQLite', 'Drizzle', 'Kotlin', 'Swift']
tags: ['Finance', 'Mobile', 'Offline']
repoPrivate: true
demo: 'https://monee.smr.et'
featured: true
stats:
  - { label: 'Platforms', value: 'iOS + Android' }
  - { label: 'Data', value: 'On device, encrypted' }
  - { label: 'Alerts', value: 'CBE, telebirr, Dashen' }
---

Income, spending and budgets across bank accounts, mobile wallets and cash, built from the
transaction alerts those accounts already send.

## What it is

Bank and wallet alerts become draft entries in an inbox. Nothing is recorded until it is confirmed,
and once a payee has been seen its category is remembered. Transfers between your own accounts are
matched as transfers, fees are kept apart from the amount paid, and the balance each alert states is
checked against the app's own figure. Budgets run once or on a daily to yearly rhythm, with rollover
and alerts. Reports cover cash flow, categories, balances over time and month on month. Receipts are
photographed and read on the device. Every transaction keeps its original amount, its converted
amount and the rate it was valued at.

Nothing leaves the device: no account, no server, no analytics, and no network request unless
exchange-rate fetching is switched on. The database is SQLCipher-encrypted SQLite, and a passcode
with Face ID or a fingerprint locks the app.

The web build at [monee.smr.et](https://monee.smr.et) is a phone-shaped preview of the screens over
a browser store, not the encrypted on-device app.

## Stack

- **App** — React Native and Expo with Expo Router, in TypeScript. Zustand for state, Lingui for
  i18n, decimal.js for money.
- **Storage** — SQLite through op-sqlite with SQLCipher, and Drizzle ORM for schema and migrations.
- **Native modules** — alert capture (an SMS receiver and notification listener on Android;
  Shortcuts and the share sheet on iOS) and receipt OCR (ML Kit on Android, Vision on iOS), written
  as Expo modules in Kotlin and Swift.
- **Parsing** — rule packs for CBE, telebirr and Dashen, built from real alerts. Every message that
  ever needed a rule fixed stays in the test suite.

## Links

- Web preview: [monee.smr.et](https://monee.smr.et)
