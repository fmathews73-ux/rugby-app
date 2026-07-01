# Product Requirements Document — Rugby Mobile Application

**Version:** 0.5 (Draft)
**Date:** 1 July 2026
**Status:** Working draft — contains open items requiring resolution
**Intended reader:** Claude Code (build agent) + project owner

**Version history**
- **v0.5** — Team scope broadened. v1 now covers **all Men's international teams (Tier 1 + Tier 2)** — previously Tier 1 only. Same 5 competitions; the change unlocks a fully-modelled Rugby World Cup 2027 (24 teams, 6 pools of 4 → knockouts) and expands the Power Rankings surface to every Men's international side. Six Nations (6 Tier-1 teams) and Rugby Championship (4 Tier-1 teams) rosters unchanged — Tier-2 teams enter via World Cup, Rankings, and (as future scope, not now) potential Tier-1-vs-Tier-2 fixtures in the Autumn / Summer test windows. Register #2 updated. No new Tier-2-only competitions (Pacific Nations Cup, Rugby Europe Championship, etc.) — those remain future scope.
- **v0.4** — Scope crystallised. Resolved register #1 (Rugby Union only, permanent — League is a permanent product exclusion), #2 (v1 = **Men's Tier 1 Internationals**: Six Nations, Rugby Championship, Tier-1 test matches, Rugby World Cup), #3 (Men's), #4 (current season only). Soft-deferred #5 (licensing gate) — dev builds run against a synthetic dataset per new **§5.5**; gate stays live before any real feed data enters the pipeline. Deferred #13 (proprietary rankings algorithm) — Internationals use World Rugby's stored public rankings; algorithm reactivates only when scope expands to club competitions. Added §5.5 (synthetic development data rules) and register #27 (synthetic dataset design + persistent dev-mode indicator).
- **v0.3** — Added register #26 (publisher entity & neutral domain) as Phase 6 open item — real-name exposure via App Store developer name, bundle-ID reverse-DNS, and domain WHOIS is the primary public anonymity chokepoint once the app publishes. Filename retained as `Rugby-App-PRD-v0.2.md` to avoid cascading reference updates in every `CLAUDE.md`; rename on next material scope change.
- **v0.2** — Mobile framework locked to **React Native via Expo (managed workflow) + Expo Router** (§6). **Web companion resolved OUT for v1** (register #18). Fixed a cross-reference (§0 now correctly points to the §13 register).
- **v0.1** — Initial working draft.

---

## 0. How to use this document (read first)

This PRD is the source of truth for designing and building the app. It is deliberately incomplete in places: where a detail has not yet been decided, it is flagged, not assumed. **You must not invent values, scope, or behaviour to fill a gap.**

### Tagging legend

| Tag | Meaning | Action |
|---|---|---|
| `[INPUT NEEDED]` | A product/business decision only the owner can make (e.g. name, scope, price). | Pause and ask the owner. Do not proceed on a guess. |
| `[RESEARCH REQUIRED]` | An external fact must be verified before building (e.g. does a feed carry this field?). | Research/verify, present findings, confirm before building. |
| `[GATE]` | A hard blocker. Downstream work must not start until resolved. | Stop. Escalate to owner. |
| `[DEFERRED]` | Intentionally out of scope for the current phase. | Do not build now. Wireframe only if stated. |

### Gap-resolution protocol

Gaps are resolved sequentially, just-in-time at the phase where they bite — not all up front. Each flagged item is tagged with the phase in which it must be closed (see §13 register). When you reach a phase, resolve its open items first, confirm with the owner, then build. Never carry an unresolved `[GATE]` into a dependent phase.

**Golden rule: when uncertain, ask. No silent assumptions.**

---

## 1. Project overview

A cross-platform mobile application delivering rugby fixtures, results, standings, team and player information, statistics, and proprietary power rankings. Modelled structurally on major tournament apps (the FIFA+ app is the reference pattern) — but built as a **data app, not a media app**. No live video, no AR.

### 1.1 Vision

Give rugby fans a fast, reliable, stats-rich companion covering the competitions they care about, with a differentiated power-rankings feature that is owned IP rather than a licensed feed.

### 1.2 Project constraints (mandatory)

- **Standalone/private project.** All infrastructure, repositories, cloud projects, developer accounts, and file storage sit under the owner's personal identity only. No organisational accounts, no shared/third-party infrastructure, no references to any employer, group, or company anywhere in code, config, metadata, commit history, or store listings.
- **Cloud provider:** Google Cloud Platform (personal project) + Firebase.
- **Version control:** personal GitHub account.

---

## 2. Target user & market

- `[INPUT NEEDED — Phase 2]` Target user persona(s) not yet defined. Casual fan vs. stats power-user vs. fantasy player materially changes screen priority and the free/premium line. Define primary + secondary persona before wireframing.
- `[INPUT NEEDED — Phase 0]` Target geography/market not defined. Do not assume any single country or region. Global by default unless the owner scopes otherwise. This affects store pricing tiers, localisation, and licensing territory.
- `[RESEARCH REQUIRED — Phase 2]` Competitor scan: identify existing rugby apps (official union apps, third-party stats apps) to establish differentiation and table-stakes features. Not yet done.

---

## 3. Scope

### 3.1 In scope (v1)

Fixtures, results, standings/brackets, team pages, player profiles, team & player stats, power rankings, news surfacing, user profile, freemium subscription.

### 3.2 Out of scope (explicit)

- Live video streaming (WebRTC/HLS, broadcast rights, CDN video egress) — excluded entirely.
- AR features (pitch overlays, wayfinding) — excluded.
- Betting/odds — `[INPUT NEEDED]` excluded by default; if ever included it introduces regulatory/licensing obligations and must be treated as a separate workstream.
- **Web companion — OUT for v1** (resolved v0.2, register #18). Native iOS + Android only.
- **Rugby League — permanent product exclusion** (resolved v0.4). This is a Union app; no League fixtures, teams, stats, or rankings appear anywhere in the product.
- **Rugby Sevens — OUT for v1** (resolved v0.4). May be revisited as a scope expansion later; do not build for it now.

### 3.3 Deferred

- Fantasy — `[DEFERRED to Phase 2+]`. Larger build than it appears and typically a separate data-licensing use-case. Wireframe the header entry point only; do not build.

### 3.4 Code & competition scope — **RESOLVED (v0.4 base, broadened v0.5)**

- **Code:** Rugby **Union only.** League is a permanent product exclusion (§3.2). Sevens is deferred (§3.2).
- **v1 competitions — 5 competitions (unchanged from v0.4):**
  - **Six Nations** — 6 Tier-1 teams (England, France, Ireland, Italy, Scotland, Wales). Round-robin.
  - **Rugby Championship** — 4 Tier-1 teams (Argentina, Australia, New Zealand, South Africa). Double round-robin.
  - **Summer Test Series** — Tier-1 test window (June-July). Tier-1 vs. Tier-1 in v1; Tier-1 vs. Tier-2 tests are future scope.
  - **Autumn Nations Series** — Tier-1 test window (November). Same future-scope note.
  - **Rugby World Cup** — 24 teams (pool + knockout). Now fully modelled after the v0.5 team-scope broadening.
- **Teams — v0.5 broadened:** all Men's international Rugby Union teams — **Tier 1 + Tier 2**.
  - **Tier 1 (10):** England, France, Ireland, Italy, Scotland, Wales, Argentina, Australia, New Zealand, South Africa.
  - **Tier 2 (18):** Fiji, Georgia, Japan, Samoa, Tonga, USA, Uruguay, Chile, Namibia, Portugal, Romania, Spain, Zimbabwe, Hong Kong China, Canada, Brazil, Netherlands, Kenya. 14 of these qualify for RWC 2027; all 18 appear in the Power Rankings surface.
- **Gender:** Men's only.
- **Historical depth:** Current season only. Prior-season data is not surfaced anywhere in v1.
- **Explicit non-scope in v1** (post-v1 candidates): Tier-2-only competitions (Pacific Nations Cup, Rugby Europe Championship, etc.), Women's Internationals, club/union competitions.

All Phase 3+ pipeline, canonical-model, ingestion cadence, and UI decisions now scope to this bounded set.

---

## 4. Information architecture

Derived from the owner's architecture sketch. This is the confirmed navigation skeleton.

### 4.1 Header (persistent)

- **Profile** — `[INPUT NEEDED — Phase 4]` contents undefined (favourites/followed teams, notification settings, subscription status, account management?).
- **Fantasy** — entry point only. `[DEFERRED]`.
- **Logo/brand** — `[INPUT NEEDED — Phase 0]` no name, logo, or brand identity yet.

### 4.2 Footer navigation (primary tabs)

Home · Fixtures · Standings · Teams · Stats · Power Rankings

### 4.3 Screen definitions

- **Home** — General description/landing for the app. `[INPUT NEEDED — Phase 5]` exact content blocks undefined (featured match? followed-team feed? news digest?).
- **Fixtures** — Match cards with drill-down to: Overview, Line-Up, Stats, Power Rankings, News. `[RESEARCH REQUIRED — Phase 1]` Confirm the chosen feed supplies line-ups, per-match player stats, and match-level news for the in-scope competitions.
- **Standings** — Various tournaments and their associated brackets, with a bracket sub-menu and live updates. `[RESEARCH REQUIRED — Phase 1]` Confirm feed provides both league tables and knockout bracket structures for in-scope competitions.
- **Teams** — Squad, Player Profiles, Coaching-team profiles, Team Stats, Fixtures. `[RESEARCH REQUIRED — Phase 1]` Coaching-staff data is often NOT carried by aggregator feeds. Verify availability; if absent, flag as manual-entry or cut.
- **Stats** — Team Stats + Player Stats with various metrics and KPIs. `[INPUT NEEDED — Phase 2]` The specific metric/KPI list is undefined. "Various metrics and KPIs" is not buildable. Produce and confirm an explicit field list (e.g. carries, metres, tackles, turnovers, lineout success, etc.), and map each to feed availability. This screen is the premium-gated surface (see §8).
- **Power Rankings** — Based on team & player stats.
  - International teams → official governing-body rankings.
  - Club/union teams & players → proprietary algorithm on licensed feed data (owned IP). See §7.

---

## 5. Data architecture & sourcing

### 5.1 Strategy (decided)

**Sequence: synthetic → aggregator → premium** (v0.4).
Build against a **synthetic development dataset** (see §5.5) first — validates the pipeline shape, canonical model, API surface, and every screen without any paid feed commitment or licensing exposure. Swap to aggregator-tier data before public launch (cost reason). Retain premium (Opta/Stats Perform-grade) as a documented future upgrade, not a launch dependency. The normalisation layer (§6) exists specifically to make each transition a config change, not a rewrite.

### 5.2 Provider shortlist

- Aggregator tier (candidates): Highlightly, Goalserve, SportDevs.
- Premium tier (future): Sportradar, Opta/Stats Perform.

`[RESEARCH REQUIRED — Phase 1]` No provider selected yet. Pull free trials, validate against real JSON for the in-scope competitions (§3.4), and confirm coverage, depth, update frequency, and format.

### 5.3 Licensing — `[GATE — Phase 1]`

Commercial redistribution rights must be confirmed **in writing** before any paid commitment or build against a feed. The app surfaces third-party data to end users in a commercial (subscription) product; not all provider licences permit this. This gate blocks Phases 3+.

### 5.4 News source — `[INPUT NEEDED / RESEARCH REQUIRED — Phase 2]`

"News" appears in Fixtures and Teams but its source is undefined (feed-provided? RSS aggregation? editorial? licensed wire?). Each has different cost, legal, and build implications.

### 5.5 Synthetic development data — RESOLVED v0.4 (dev only)

Until real feed data enters the pipeline, all pipeline / API / client work runs against a synthetic dataset shaped for the §3.4 scope (Men's Tier 1 Internationals, current season). Non-negotiable rules:

- **Shape identical to canonical model.** Synthetic records go through the same adapter interface a real feed will later use — the client and API cannot tell them apart. Swapping to a licensed feed is an adapter change only.
- **National team names are real** (public identifiers, not licensable content). Team crests / logos are trademarked and must NOT be included — neutral placeholder marks only, per §10.
- **Player names are plausibly fake.** Never real players tied to fabricated stats — even privately, that carries defamation risk. Real player data enters only via a licensed feed post-launch.
- **Fixtures may mirror the real published international calendar** (public record). Results, live scores, per-match stats, and rankings are fully synthetic and must be **visibly labelled** in the UI (persistent dev-mode indicator on every screen that renders any synthetic field).
- **Never ship synthetic data to a production build.** Gate synthetic data to `__DEV__` / dev-client / EAS internal preview only; store builds must fail hard if a synthetic adapter is present. Any code path that could leak synthetic data into a public build is a release blocker.
- **Licensing gate (register #5) remains live** for the moment real feed data enters the pipeline — before beta / soft-launch, not before dev. See §5.3.

---

## 6. Technical architecture

Reference pattern (real-time sports data app) mapped onto the owner's GCP stack.

| Layer | Technology |
|---|---|
| Mobile client | **React Native via Expo (managed workflow) + Expo Router** — native iOS + Android only. **Web companion: OUT for v1** (register #18 resolved v0.2). |
| Backend / API | Cloud Run (Node) behind API Gateway |
| Relational store | Cloud SQL (PostgreSQL) |
| Cache + pub/sub | Memorystore (Redis) — deferred until real-time tier needed |
| Ingestion | Cloud Scheduler → Cloud Run jobs |
| Analytics / rankings compute | BigQuery |
| Secrets | Secret Manager (feed API keys) |
| Auth | Firebase Auth — `[INPUT NEEDED — Phase 4]` methods (email/social/anonymous?), mandatory vs optional account |
| Push notifications | Firebase Cloud Messaging |
| CDN | Cloud CDN (fronting cacheable read APIs) |

### 6.1 Data pipeline (core engineering effort)

1. **Ingest** — Cloud Scheduler triggers a Cloud Run job on an interval (short during live matches, long off-match). Store raw feed responses untransformed.
2. **Normalise** — map vendor schema → canonical internal model (teams, players, fixtures, events) with owner-defined stable IDs. This is the highest-value decision in the build: it prevents feed lock-in and enables the cheap→premium upgrade.
3. **Serve hot** — live match state to Redis; clients subscribe via WebSocket. `[DEFERRED — add only when live users require sub-minute updates]`
4. **Serve cold** — fixtures, standings, profiles, historical stats from Postgres via cached read APIs behind Cloud CDN.
5. **Compute Power Rankings** — scheduled BigQuery job runs the proprietary algorithm over accumulated stats; writes results to Postgres.

### 6.2 Real-time requirement — `[INPUT NEEDED — Phase 4]`

Acceptable live-score latency is undefined (sub-minute? a few minutes?). Poll-refresh is acceptable for MVP; this decision gates whether/when the Redis+WebSocket tier is built.

---

## 7. Power Rankings (owned IP)

- **International teams (v1):** use **World Rugby's official public men's rankings**. `[RESEARCH REQUIRED — Phase 2]` Confirm update cadence and terms of reuse. Rankings are **stored, not computed** — no proprietary algorithm is needed for v1. Synthetic dev builds show synthetic ranking snapshots per §5.5.
- **Club/union teams & players — DEFERRED (post-v1 only, v0.4).** The proprietary algorithm — the app's key differentiator and defensible IP — only becomes relevant when scope expands to club competitions. Spec (input metrics, weightings, normalisation, recompute cadence, cold-start handling) remains undefined until that expansion is agreed. Do not build any club-rankings compute path in v1.

---

## 8. Monetisation & pricing

### 8.1 Model (decided)

Freemium with a premium subscription.

- **Free tier:** scores, fixtures, standings/brackets, power rankings, basic team info.
- **Premium tier:** deep player Stats & KPIs (the Stats screen), and any advanced analytics.

### 8.2 Pricing — `[INPUT NEEDED — Phase 6, confirm]`

Working assumption from modelling (to be confirmed, not treated as final):

- Premium ≈ $9.99/month (chosen over $4.99 to halve the subscriber count needed at breakeven).
- Annual price, free-trial length, and regional pricing tiers not yet set.

### 8.3 Economics reference (planning basis)

- App-store cut assumed 15% (small-business/subscription rate).
- Freemium→paid conversion assumed ~3% of active users.
- Aggregator-data scenario breakeven ≈ a few hundred subs / ~1,000+ active users at $9.99. Premium-data scenario needs ~8,500–17,000 actives — hence the launch-cheap sequencing.
- `[RESEARCH REQUIRED — Phase 6]` Verify current Apple/Google fee structures and small-business-program eligibility at build time.

### 8.4 Billing implementation — `[Phase 6]`

StoreKit (iOS) / Play Billing (Android). Server-side receipt validation. `[INPUT NEEDED]` confirm no alternative monetisation (ads/one-off) in v1.

---

## 9. Non-functional requirements

`[INPUT NEEDED / RESEARCH REQUIRED — Phase 2]` The following are undefined and must be set before build hardening:

- Performance targets (cold start, API p95 latency, live-score freshness).
- Availability target and match-day traffic-spike handling.
- Offline behaviour / caching expectations.
- Accessibility standard.
- Privacy & compliance: privacy policy, data-handling, GDPR/CCPA applicability (depends on §2 geography), age rating.
- Analytics/instrumentation SDK choice.
- Localisation/languages.

---

## 10. Design & brand — `[INPUT NEEDED — Phase 0/2]`

No visual identity yet: name, logo, colour palette, typography, design system all undefined. Wireframe with neutral placeholders; do not invent a brand. A design-system decision precedes UI build.

---

## 11. Build roadmap

- **Phase 0 — Foundation & separation:** personal GCP project + GitHub; app name, domain, store dev accounts (personal identity); confirm v1 scope bounds.
- **Phase 1 — De-risk data `[GATES here]`:** trial feeds, validate coverage, confirm commercial licensing in writing, lock v1 feed.
- **Phase 2 — Spec & data model:** personas, competitor scan, wireframes, canonical data model, explicit stats/KPI list, power-rankings algorithm spec, news-source decision.
- **Phase 3 — Core pipeline:** ingestion (raw) → normalisation layer → Cloud SQL; BigQuery for history/rankings.
- **Phase 4 — Backend & APIs:** Cloud Run read APIs, Cloud CDN, Firebase Auth; defer real-time tier.
- **Phase 5 — Mobile MVP:** React Native (Expo) Tier-1 screens (Home, Fixtures, Standings, Teams, basic Stats) + Power Rankings; FCM push.
- **Phase 6 — Monetisation:** free/premium split, store subscriptions, receipt validation.
- **Phase 7 — Launch & measure:** soft-launch, instrument actives/conversion/retention vs breakeven; only then revisit premium-feed upgrade and real-time tier.

---

## 12. Sequencing principle

Prove licensing → build the pipeline → ship the cheap-data MVP behind a paywall → let subscriber numbers, not enthusiasm, unlock each next cost tier (premium feed, real-time WebSockets, Fantasy).

---

## 13. Open-items register (consolidated)

| # | Item | Tag | Phase | Blocks |
|---|---|---|---|---|
| 1 | Code(s): Union/League/Sevens | **RESOLVED v0.4 — Union only** (League permanent exclusion, Sevens deferred) | 1 | — |
| 2 | v1 competitions + team scope | **RESOLVED (v0.4 base, broadened v0.5)** — 5 competitions: Six Nations (6 T1), Rugby Championship (4 T1), Summer/Autumn Tests (T1 tests), RWC 2027 (24 teams / T1 + T2 pool + knockout). Teams: **all Men's international sides — 10 Tier-1 + 18 Tier-2.** | 1 | — |
| 3 | Men's/Women's/both | **RESOLVED v0.4 — Men's only** | 1 | — |
| 4 | Historical depth | **RESOLVED v0.4 — Current season only** | 1 | — |
| 5 | Commercial redistribution licence | **SOFT-DEFERRED v0.4** — dev runs on synthetic data (§5.5); GATE reactivates before real feed data enters the pipeline (pre-beta / pre-launch) | 1 / 6 | Real-data cutover, launch |
| 6 | Provider selection | RESEARCH | 6 (pre-launch cutover) | Real-data pipeline swap |
| 7 | Line-up / per-match stats / bracket / coaching-staff availability | RESEARCH | 6 (pre-launch cutover) | Fixtures, Teams, Standings — deferred with provider selection |
| 8 | News source | INPUT/RESEARCH | 2 | News surfaces |
| 9 | Target persona(s) | INPUT | 2 | Screen priority, paywall line |
| 10 | Target geography | **RESOLVED v0.3 — Global by default** | 0 | — |
| 11 | Competitor scan | RESEARCH | 2 | Differentiation |
| 12 | Explicit stats/KPI field list | INPUT | 2 | Stats screen |
| 13 | Power-rankings algorithm spec | **DEFERRED v0.4** — post-v1 (activates only with club-competitions scope expansion) | 2+ | Club rankings, IP |
| 14 | Official intl-ranking source & terms | RESEARCH | 2 — narrowed to **World Rugby men's rankings** (per §3.4 scope) | Rankings |
| 15 | Profile screen contents | INPUT | 4 | Profile |
| 16 | Auth methods / mandatory account | INPUT | 4 | Auth |
| 17 | Real-time latency target | INPUT | 4 | Redis/WebSocket tier |
| 18 | Web companion in/out | **RESOLVED v0.2 — OUT (native only)** | 5 | — |
| 19 | Home screen content blocks | INPUT | 5 | Home |
| 20 | Final pricing (annual, trial, regional) | INPUT | 6 | Billing |
| 21 | Store fee structure at build time | RESEARCH | 6 | Economics |
| 22 | Alternative monetisation (ads/one-off) | INPUT | 6 | Billing |
| 23 | Brand identity (name/logo/palette/type) | **RESOLVED v0.3 — Neutral placeholders, do not invent** | 0/2 | UI (locked to placeholders) |
| 24 | NFRs (perf/availability/compliance/etc.) | INPUT/RESEARCH | 2 | Hardening |
| 25 | Fantasy scope | DEFERRED | 2+ | — |
| 26 | Publisher entity (LLC / sole-prop / other) + neutral domain — governs App Store & Play Store developer name (public), bundle/package reverse-DNS, and WHOIS on the app's domain. Repo stays private throughout dev; this bites at store submission. | INPUT | 6 | Store submission, brand, bundle IDs |
| 27 | Synthetic dataset design + persistent dev-mode indicator — canonical entities, generator strategy, indicator UI treatment. Must respect §5.5 rules (fake player names, real team names, no crests, no leak to prod). | INPUT | 3 | Phase 3 pipeline |

---

*End of PRD v0.5. This is a living document; close open items in phase order and version up as decisions land.*
