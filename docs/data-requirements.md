# RUGBYMETRICS — Data Feed Requirements

**Purpose.** RUGBYMETRICS is a consumer mobile app for international rugby union: fixtures, match analysis, team & player statistics, and match predictions. This document itemises every data point the product consumes so a provider can confirm coverage and pricing line-by-line.

## 1. Scope of coverage

| Dimension | Requirement |
|---|---|
| Sport | Rugby union, 15-a-side, men's internationals only |
| Competitions | Six Nations · The Rugby Championship · July/Summer international windows · Autumn Nations Series · Rugby World Cup 2027 |
| Teams | All men's national teams appearing in those competitions |
| Rankings | World Rugby world rankings — men's published snapshots |
| Historical depth | Minimum current season + previous two completed seasons of all items below; five seasons preferred |

## 2. Consumption model

Server-side ingestion only — our jobs pull the feed into our own store; mobile clients call only our cached APIs and never hold a feed key. Pull/REST + JSON preferred; push/webhook welcome.

## 3. Itemised data points

| # | Data point | Context |
|---|---|---|
| 1 | Competition name, short name, format, governing body | Competition |
| 2 | Season year label, start date, end date, status | Season |
| 3 | Fixture: competition, season, round label, home team, away team | Fixture |
| 4 | Kickoff date/time UTC | Fixture |
| 5 | Venue | Fixture |
| 6 | Fixture status | Fixture |
| 7 | Knockout bracket structure | Competition |
| 8 | Team name + World Rugby 3-letter code | Team |
| 9 | Player full name | Player |
| 10 | Player date of birth | Player |
| 11 | Player height | Player |
| 12 | Player weight | Player |
| 13 | Player primary position | Player |
| 14 | Player international cap count | Player |
| 15 | Squad list per team per season/tournament window | Squad |
| 16 | Match officials per fixture | Fixture |
| 17 | Coaching staff per team | Team |
| 18 | Final score | Team match stats |
| 19 | Half-time score | Team match stats |
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
| 36 | Contestable kicks regathered | Team match stats |
| 37 | 50/22 kicks landed | Team match stats |
| 38 | Scrums won / lost | Team match stats |
| 39 | Lineouts won / lost | Team match stats |
| 40 | Rucks won / lost | Team match stats |
| 41 | Mauls won / lost | Team match stats |
| 42 | 22-entries | Team match stats |
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
| 60 | Started match | Player match stats |
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
| 80 | Rucks hit | Player match stats |
| 81 | Lineout takes | Player match stats |
| 82 | Lineout steals | Player match stats |
| 83 | Penalties conceded | Player match stats |
| 84 | Yellow cards | Player match stats |
| 85 | Red cards | Player match stats |
| 86 | Team lineups: starting XV + bench, shirt numbers, match positions | Lineups |
| 87 | Scoring events with minute + stoppage, team, player, points value | Match events |
| 88 | Card events with minute, team, player | Match events |
| 89 | Substitution events | Match events |
| 90 | Match milestones | Match events |
| 91 | Per-event pitch coordinates for phases/carries | Match events |
| 92 | Live score + match clock/status | Live |
| 93 | Live event ticker | Live |
| 94 | League table rows: played, W/D/L, points for/against/difference, try bonus points, losing bonus points, table points, rank | Standings |
| 95 | World Rugby ranking snapshots: rank, points, previous rank, movement, with history | Rankings |
| 96 | Player headshots | Imagery |
| 97 | Coaching-staff photos | Imagery |
| 98 | Match-official photos | Imagery |
| 99 | Team crests / union logos | Imagery |

## 4. Data freshness

Match-scoped data must be **real-time, or as close to real-time as the feed supports** — the product's match statistics surfaces update while play is in progress.

| Data | Freshness |
|---|---|
| Live score, clock, match events | Real-time / lowest available latency |
| In-play team and player statistics | Real-time / lowest available latency |
| Full-time result + final team stats | Immediately on full-time |
| Player match sheets | As soon as available after full-time |
| Lineups | On team announcement |
| Fixtures/schedules | As published/amended |
| Standings | With result confirmation |
| World rankings | On publication |
