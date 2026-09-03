---
title: 'Telemed'
blurb: 'A telemedicine platform — scheduling, consultations, records — built for markets where the specialist and the patient are rarely in the same city.'
period: '2026'
weight: 90
kind: 'Platform'
role: 'Architecture & implementation'
status: 'Live'
stack: ['TypeScript', 'Next.js', 'React', 'PostgreSQL', 'Vercel']
tags: ['Health', 'Scheduling', 'Product']
repo: 'https://github.com/samu-el/telemed'
demo: 'https://telemed-mu.vercel.app'
featured: true
stats:
  - { label: 'Surface', value: 'Web app' }
  - { label: 'Core loop', value: 'Book → consult → record' }
---

Telemedicine in a country with a few thousand specialists and a hundred-plus million people is
not a convenience feature. It is the difference between a consultation and no consultation.

The platform covers the loop that matters: a patient finds an available clinician, books a
slot, holds the consultation, and both sides leave with a record of it.

## Design decisions worth stating

- **Scheduling is the hard part, not video.** Video is a commodity. Availability windows,
  timezone-correct slots, cancellations, no-shows, and the clinician’s real calendar are where
  the complexity and the bugs live, so that is where the model is strict.
- **The record outlives the session.** A consultation that leaves no durable artefact is a
  phone call. Notes, prescriptions and history are first-class rows, not chat scrollback.
- **Assume the worst connection in the room.** Every state transition survives a reload. A
  dropped call does not lose a booking.

Built with the stack I reach for by default when a product needs to exist quickly and still be
maintainable a year later: Next.js on the front, a strict Postgres schema underneath, and no
clever infrastructure anywhere.
