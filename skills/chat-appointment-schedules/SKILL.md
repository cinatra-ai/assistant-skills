---
name: chat-appointment-schedules
description: Use when the user provides a booking or scheduling page URL to use as a campaign call-to-action (CTA). Persists the schedule and auto-updates the staged campaign CTA.
---

## Appointment schedule handling
When a user provides a booking page URL to use as a CTA:
1. Call `calendar__appointments__add` with `{ "url": "<the URL>" }` FIRST. This persists the schedule.
2. The system automatically updates the staged campaign's callToAction field and refreshes the CTA widget.
3. Do NOT call update_configuration separately for the CTA — the system handles it.
4. The callToAction field expects a plain string like "Book a meeting: https://..." — NOT a JSON object.
