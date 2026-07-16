# RUGBYMETRICS — Data Feed Requirements

**Purpose.** RUGBYMETRICS is a consumer mobile app (iOS + Android) for international rugby union: fixtures, match analysis, team & player statistics, and match predictions. This document itemises every data point the product consumes so a provider can confirm coverage and pricing line-by-line.

## 1. Scope of coverage

| Dimension | Requirement |
|---|---|
| Sport | Rugby union, 15-a-side, **men's internationals only** (no club, no league, no sevens) |
| Competitions | Six Nations · The Rugby Championship · July/Summer international windows · Autumn Nations Series · Rugby World Cup 2027 |
| Teams | All men's national teams appearing in those competitions (~28 teams) |
| Rankings | World Rugby world rankings — men's published snapshots |
| Historical depth | Minimum current season + previous two completed seasons of all items below; five seasons preferred |

## 2. Consumption model

Server-side ingestion only — our jobs pull the feed into our own store; mobile clients call only our cached APIs and never hold a feed key. Pull/REST + JSON preferred; volumes modest (~180–220 fixtures/year).

## 3. Itemised data points

| # | Data point | Context |
|---|---|---|
| 1 | Competition name, short name, format, governing body | Competition |
| 2 | Season year label, start date, end date, status | Season |
| 3 | Fixture: competition, season, round label, home team, away team | Fixture |
| 4 | Kickoff date/time (UTC) | Fixture |
| 5 | Venue (stadium name) | Fixture |
| 6 | Fixture status (scheduled / live / half-time / completed / postponed / cancelled) | Fixture |
| 7 | Knockout bracket structure (round names + fixture mapping, RWC) | Competition |
| 8 | Team name + World Rugby 3-letter code | Team |
| 9 | Player full name | Player |
| 10 | Player date of birth | Player |
| 11 | Player height (cm) | Player |
| 12 | Player weight (kg) | Player |
| 13 | Player primary position (15-position granularity) | Player |
| 14 | Player international cap count | Player |
| 15 | Squad list per team per season/tournament window | Squad |
| 16 | Match officials per fixture (referee, AR1, AR2, TMO) | Fixture |
| 17 | Coaching staff per team (head coach + assistants, roles) | Team |
| 18 | Final score (both sides) | Team match stats |
| 19 | Half-time score (both sides) | Team match stats |
| 20 | Tries | Team match stats |
| 21 | Conversions + conversion attempts | Team match stats |
| 22 | Penalty goals + penalty goal attempts | Team match stats |
| 23 | Drop goals | Team match stats |
| 24 | Possession % | Team match stats |
| 25 | Territory % | Team match stats |
| 26 | Metres carried | Team match stats |
| 27 | Carries | Team match stats |
| 28 | Line breaks | Team match stats |
| 29 | Defenders beaten | Team match stats |
| 30 | Passes | Team match stats |
| 31 | Offloads | Team match stats |
| 32 | Kicks in play | Team match stats |
| 33 | Kicks to touch | Team match stats |
| 34 | Kick metres | Team match stats |
| 35 | Contestable kicks put up | Team match stats |
| 36 | Contestable kicks regathered (own) | Team match stats |
| 37 | 50/22 kicks landed | Team match stats |
| 38 | Scrums won / lost | Team match stats |
| 39 | Lineouts won / lost | Team match stats |
| 40 | Rucks won / lost | Team match stats |
| 41 | Mauls won / lost | Team match stats |
| 42 | 22-entries (visits to the opposition 22) | Team match stats |
| 43 | Points scored from 22-entries | Team match stats |
| 44 | Tackles made | Team match stats |
| 45 | Tackle success % | Team match stats |
| 46 | Turnovers won | Team match stats |
| 47 | Turnovers conceded | Team match stats |
| 48 | Penalties conceded | Team match stats |
| 49 | Handling errors | Team match stats |
| 50 | Yellow cards | Team match stats |
| 51 | Red cards | Team match stats |
| 52 | Post-contact metres | Team match stats |
| 53 | Gainline success % | Team match stats |
| 54 | Dominant tackles | Team match stats |
| 55 | Ruck speed — share of attacking rucks recycled 0–3 s | Team match stats |
| 56 | Scrum penalties conceded | Team match stats |
| 57 | Breakdown penalties conceded | Team match stats |
| 58 | Offside penalties conceded | Team match stats |
| 59 | Lineout penalties conceded | Team match stats |
| 60 | Started match (Y/N) | Player match stats |
| 61 | Minutes played | Player match stats |
| 62 | Tries | Player match stats |
| 63 | Try assists | Player match stats |
| 64 | Points | Player match stats |
| 65 | Carries | Player match stats |
| 66 | Metres carried | Player match stats |
| 67 | Clean breaks | Player match stats |
| 68 | Defenders beaten | Player match stats |
| 69 | Offloads | Player match stats |
| 70 | Passes | Player match stats |
| 71 | Handling errors | Player match stats |
| 72 | Conversions | Player match stats |
| 73 | Penalty goals | Player match stats |
| 74 | Drop goals | Player match stats |
| 75 | Kicks from hand | Player match stats |
| 76 | Kick metres | Player match stats |
| 77 | Tackles made | Player match stats |
| 78 | Missed tackles | Player match stats |
| 79 | Turnovers won | Player match stats |
| 80 | Rucks hit (attended) | Player match stats |
| 81 | Lineout takes | Player match stats |
| 82 | Lineout steals | Player match stats |
| 83 | Penalties conceded | Player match stats |
| 84 | Yellow cards | Player match stats |
| 85 | Red cards | Player match stats |
| 86 | Team lineups: starting XV + bench, shirt numbers, match positions (pre-kickoff) | Lineups |
| 87 | Scoring events with minute + stoppage, team, player, points value | Match events |
| 88 | Card events (yellow/red) with minute, team, player | Match events |
| 89 | Substitution events (player off + player on, minute) | Match events |
| 90 | Match milestones (kick-off, half-time, second-half start, full-time) | Match events |
| 91 | Per-event pitch coordinates (x/y) for phases/carries | Match events (future) |
| 92 | Live score + match clock/status (≤ 60 s freshness) | Live |
| 93 | Live event ticker (scoring / cards / subs) | Live |
| 94 | League table rows: played, W/D/L, points for/against/difference, try bonus points, losing bonus points, table points, rank | Standings |
| 95 | World Rugby ranking snapshots (men's): rank, points, previous rank, movement — weekly/as published, with history | Rankings |
| 96 | Player headshots + coaching-staff photos (licensed for in-app display) | Imagery (separate tier) |

*Consistency expectation: player sheets sum to team totals; event-derived counts reconcile with both.*

## 4. Latency & cadence

| Data | Freshness |
|---|---|
| Fixtures/schedules | As published/amended |
| Lineups | On team announcement (pre-kickoff) |
| Live score + events | ≤ 60 s during matches |
| Full-time result + team stats | Within ~1 h of full-time |
| Player match sheets | Within ~3 h of full-time |
| Standings | With result confirmation |
| World rankings | On publication |

## 5. Questions for the provider

1. Which items above are covered per competition (please flag Tier-2 gaps)?
2. Player stats coverage: both matchday 23s or starters only?
3. Redistribution licence terms for a consumer mobile app (iOS/Android) — display rights, attribution, caching/retention constraints.
4. Pricing structure: per competition bundle vs. all-internationals; any per-item tiering on your side; historical back-fill.
5. Sandbox/trial access with schema documentation before contract.
6. Delivery: REST endpoints and/or push; rate limits; SLA during live matches.

---

*Document version 2.0 — itemised single-table format. Generated from the product's canonical data contract; every item maps to a shipped screen (currently running on synthetic data pending licensing).*
