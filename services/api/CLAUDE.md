<!-- Destination: /services/api/CLAUDE.md -->
<!-- Draft v0.2 — accompanies Rugby App PRD v0.2. Inherits root /CLAUDE.md. Content unchanged since v0.1. -->

# CLAUDE.md — Read APIs (Cloud Run + Cloud CDN)

**Scope:** Cloud Run read APIs behind API Gateway, fronted by Cloud CDN. Inherits every rule in the root `/CLAUDE.md`.

Serves **cold data** — fixtures, standings, profiles, historical stats — from Cloud SQL (Postgres) via cacheable read APIs (PRD §6.1 step 4).

---

## Conventions

- **Read-optimised and cache-friendly.** Stable URLs, correct `Cache-Control`, ETags; Cloud CDN fronts everything cacheable. Match-day traffic is spike-prone — caching is the first line of defence.
- **Canonical shapes only.** APIs return the canonical internal model. Never emit vendor-shaped payloads.
- **This tier reads our own store only.** No feed API keys here; no direct feed calls. Ingestion is the pipeline's job, not the API's.
- **Auth** via Firebase (methods TBD, register #16).
- **Real-time is deferred.** Poll-refresh is acceptable for MVP (register #17). Do not build WebSocket serving until the latency decision and user demand justify it.

---

## Premium gating (server-side is the source of truth)

- The **Stats screen surface** — deep player stats & KPIs and advanced analytics — is **premium-only** (PRD §8).
- Free tier gets: scores, fixtures, standings/brackets, power rankings, basic team info.
- **Enforce entitlement server-side.** Never rely on the client to hide premium fields — do not send premium payloads to a free-tier caller.
- Subscription **receipt / entitlement validation is server-side** (Phase 6, StoreKit / Play Billing).

The explicit stats/KPI field list is undefined (`[INPUT NEEDED #12]`) — do not implement Stats endpoints until it is confirmed and mapped to feed availability.
