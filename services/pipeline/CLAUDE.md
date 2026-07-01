<!-- Destination: /services/pipeline/CLAUDE.md -->
<!-- Draft v0.2 — accompanies Rugby App PRD v0.2. Inherits root /CLAUDE.md. Content unchanged since v0.1. -->

# CLAUDE.md — Data pipeline (ingest · normalise · rankings)

**Scope:** Cloud Scheduler-triggered Cloud Run jobs. Inherits every rule in the root `/CLAUDE.md`; this file adds pipeline-specific guardrails.

This is the **highest-value part of the build** (PRD §6.1). The normalisation layer is the thing that prevents feed lock-in and turns the cheap→premium data upgrade into a config change rather than a rewrite. Treat its integrity as sacred.

---

## Principles (non-negotiable)

1. **Raw first, untransformed.** Persist each raw feed response exactly as received *before* any mapping. Never mutate raw. Raw is the audit trail and the replay source (PRD §6.1 step 1).
2. **One canonical model.** Map every vendor schema → a single internal model (teams, players, fixtures, events). Nothing downstream ever sees vendor-shaped data.
3. **Owner-defined stable IDs.** Canonical entities carry our own stable IDs, decoupled from any vendor ID. Maintain a vendor-ID ↔ canonical-ID crosswalk. This is the anti-lock-in mechanism — do not shortcut it by using vendor IDs as primary keys.
4. **Feed-agnostic everywhere.** No vendor name appears in the canonical model, table names, or API shapes. Vendor specifics live only inside an adapter/mapping module.
5. **Adapter per provider.** Adding or swapping a feed means writing a new adapter against a stable mapping interface — it must not touch the canonical model or the serving layer.
6. **No premium assumptions.** Build to the aggregator-tier fields that Phase 1 research *confirms* are available. Missing fields degrade gracefully; do not assume Opta / Sportradar depth exists.
7. **Ingest cadence.** Short interval during live matches, long interval off-match (PRD §6.1). The hot-serve path (Redis / WebSocket) is **deferred** — do not build it here yet.

---

## Power Rankings compute (BigQuery)

- The proprietary club/union algorithm is **owned IP and undefined until the Phase 2 spec lands** — inputs, weightings, normalisation method, recompute cadence, cold-start handling (PRD §7, register #13). **Do not implement ranking logic before that spec is confirmed.**
- International-team rankings come from **official public governing-body sources** `[RESEARCH #14]` — they are stored, not computed.

---

## Hard don'ts

- Do not call any feed before the licensing GATE clears (root §3).
- Do not use vendor IDs as canonical primary keys.
- Do not let vendor-shaped fields leak past the adapter boundary.
