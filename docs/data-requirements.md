# RUGBYMETRICS — Data Feed Requirements

**Purpose of this document.** RUGBYMETRICS is a consumer mobile app (iOS + Android) for international rugby union: fixtures, match analysis, team & player statistics, and match predictions. This document specifies the data points the product consumes, so a provider can confirm coverage, tier fit, and pricing for a licensed feed package. It is organised by entity, with each field group marked **REQUIRED** (the product renders it today), **OPTIONAL** (rendered if supplied; the UI section hides itself if absent), or **FUTURE** (roadmap — quote separately if available).

---

## 1. Scope of coverage

| Dimension | Requirement |
|---|---|
| Sport | Rugby union, 15-a-side, **men's internationals only** (no club, no league, no sevens) |
| Competitions (v1) | Six Nations · The Rugby Championship · July/Summer international windows · Autumn Nations Series · Rugby World Cup 2027 |
| Teams | All men's national teams appearing in those competitions (10 Tier-1 + Tier-2 qualifiers, ~28 teams) |
| Seasons | Current season ongoing; **plus historical depth in §6** |
| Rankings | World Rugby world rankings — **men's** published snapshots |

## 2. Consumption model

- The feed is consumed **server-side only** — our ingestion jobs pull into our own store; our mobile clients only ever call our own cached APIs. No feed key or provider endpoint is ever embedded in a client.
- Pull/REST + JSON preferred. Push/webhook acceptable. No streaming/websocket requirement in v1.
- Volumes are modest: ~180–220 fixtures per year across the five competitions.

## 3. Entities and required data points

### 3.1 Competitions, seasons & fixtures — REQUIRED
- Competition: name, format (round-robin / pool-and-knockout / test window), governing body
- Season: year label, start/end dates, status
- Fixture: competition, season, round label (or null for test windows), home/away teams, **kickoff time (UTC)**, venue name, status (scheduled / live / half-time / completed / postponed / cancelled)
- Knockout bracket structure for RWC (round names + fixture mapping)

### 3.2 Teams & people — REQUIRED (bio), OPTIONAL (staff)
- Team: name, World Rugby 3-letter code
- Player bio: full name, date of birth, height (cm), weight (kg), primary position (front row → fullback, 15-position granularity), **international cap count**
- Squad lists: per team **per season/tournament window** (squads differ between windows)
- Match-day officials per fixture (referee, AR1, AR2, TMO) — OPTIONAL
- Coaching staff per team (head coach + assistants with roles) — OPTIONAL

### 3.3 Match result & team match statistics
One record per completed fixture, both sides. Live partials for the in-play fields are welcome but not required beyond §3.6.

**Core — REQUIRED**
- Final score; half-time score
- Scoring breakdown: tries, conversions, penalty goals, drop goals (each side)
- Possession % · territory %
- Attack: metres carried, carries, line breaks, defenders beaten, passes, offloads
- Kicking: kicks in play, kicks to touch, kick metres
- Set piece: scrums won/lost, lineouts won/lost
- Breakdown: rucks won/lost, mauls won/lost
- Defence: tackles made, tackle success %, turnovers won, turnovers conceded
- Discipline: penalties conceded, handling errors, yellow cards, red cards
- Goal kicking: conversion attempts, penalty goal attempts (so success % derives)
- Red zone: 22-entries ("visits to the 22") and points scored from those entries
- Contestable kicks: put up, and own kicks regathered
- 50/22 kicks landed

**Advanced tier — REQUIRED for our premium surface (quote as a tier if separate)**
- Post-contact metres
- Gainline success % (share of carries crossing the gainline)
- Dominant tackles
- Ruck speed: share of attacking rucks recycled 0–3 s ("quick ball" %)
- Penalty-cause split: scrum / breakdown / offside penalties conceded
- *(Requested addition, FUTURE if unavailable):* lineout penalties conceded

### 3.4 Player per-match stat sheets — REQUIRED
One sheet per player in each matchday 23, per completed fixture:

- Participation: started (Y/N), **minutes played**
- Attacking: tries, try assists, points, carries, metres carried, clean breaks, defenders beaten, offloads, passes, handling errors
- Kicking: conversions, penalty goals, drop goals, kicks from hand, kick metres
- Defence: tackles made, missed tackles, turnovers won
- Breakdown/set piece: rucks hit (attended), lineout takes, lineout steals
- Discipline: penalties conceded, yellow cards, red cards

**Consistency expectation:** side-level sums of player sheets reconcile with the team totals in §3.3, and event-derived counts (§3.5) reconcile with both.

### 3.5 Match event timeline — REQUIRED
Chronological events per fixture with **match minute + stoppage minute**:

- Scoring events (try, conversion, penalty goal, drop goal) with team + player attribution and points value
- Cards (yellow/red) with team + player
- Substitutions (player off + player on)
- Milestones: kick-off, half-time, second-half start, full-time
- Team lineups per fixture: starting XV + bench with **shirt numbers and positions as selected for that match**, available pre-kickoff (T-48h → T-1h typical announcement window)
- *(FUTURE)*: per-event pitch coordinates (x/y) for carries/phases — powers a pitch heatmap; quote if available

### 3.6 Live data — REQUIRED (modest)
- Live score + match clock/status (poll-based; ≤ 60 s freshness is acceptable in v1)
- Live event ticker for §3.5 scoring/card/sub events
- No requirement for live team/player stat updates in v1 (nice-to-have)

### 3.7 Standings & rankings — REQUIRED
- League tables per round-robin competition and RWC pools: played, W/D/L, points for/against/difference, **try bonus points, losing bonus points**, table points, rank
- World Rugby rankings: **weekly snapshots** (or as published), men's — rank, points, previous rank/movement per team. Historical snapshots across the season for trajectory charts.

## 4. Derived metrics (no feed fields needed)

We compute internally: points-per-entry, kicking success %, ruck/maul success rates, per-80 and per-game player rates, positional percentiles, form windows, head-to-head aggregates, and model-based match predictions. Listed only so the package isn't over-scoped.

## 5. Latency & cadence expectations

| Data | Freshness |
|---|---|
| Fixtures/schedules | As published/amended |
| Lineups | On team announcement (pre-kickoff) |
| Live score + events | ≤ 60 s during matches |
| Full-time result + team stats | Within ~1 h of full-time |
| Player match sheets | Within ~3 h of full-time |
| Standings | With result confirmation |
| World rankings | On publication |

## 6. Historical depth

- **Minimum:** current season plus the previous **two completed seasons** of all §3 data for the covered competitions — required at launch to power form windows (last 5–10 matches), player per-game norms, positional percentile pools, and head-to-head (last 3 meetings, which can span seasons).
- **Preferred:** five seasons, for deeper head-to-head and model training.

## 7. Imagery (separate tier — please quote)

- Player headshots and coaching-staff photos, licensed for in-app display — OPTIONAL tier, not required for launch.
- We do **not** require team crests/union logos (deliberately not displayed; national flags are sourced independently).

## 8. Questions for the provider

1. Which of the §3.3 core and advanced team metrics are covered per competition (coverage can differ for Tier-2 fixtures — please flag gaps, e.g. RWC qualifiers)?
2. Which §3.4 player fields are covered, and for both matchday 23s or starters only?
3. Redistribution licence terms for a **consumer mobile app** (iOS/Android, global audience unless territory pricing applies) — display rights, attribution requirements, and any caching/retention constraints.
4. Pricing structure: per competition bundle vs. all-internationals package; core vs. advanced-stat tiers; historical back-fill.
5. Sandbox/trial access with schema documentation for integration mapping before contract.
6. Delivery: REST endpoints and/or push; rate limits; SLA during live matches.
7. Availability and pricing of the imagery tier (§7) and event coordinates (§3.5 FUTURE).

---

*Document version 1.0 — generated from the product's canonical data contract. All field groups above are live product surfaces on the current build (running on synthetic data pending licensing), so coverage confirmations map one-to-one onto shipped screens.*
