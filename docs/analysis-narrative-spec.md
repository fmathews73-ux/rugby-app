# Match Analysis Narrative Specification

**Status:** Design + template stub complete. Real LLM plumbing DEFERRED to Phase 6 (see PRD §11). See §7 below for the cutover checklist.

---

## 0. Why this document exists

The Analysis sub-tab of the fixture-drill screen renders an AI-generated,
BI-style read of a match. During Phase 0–5 the copy is produced client-side
from a template inside `mobile/src/hooks/use-match-analysis.ts`. That
template captures — deliberately — the tone, structure, and rules the real
LLM must reproduce, so that switching from templated to LLM output does not
change the reader experience.

**This document is the LLM's prompt specification.** When the real inference
path is wired up, the system prompt hands the model this spec verbatim; the
user prompt hands the model the fixture context blob. The `MatchAnalysis`
data model in `use-match-analysis.ts` is the response contract — the model
returns a JSON object matching that interface.

Keep this doc in sync with the template. If you change the template's
tone / structure / rules, change this doc in the same commit.

---

## 1. Card structure (fixed, in order)

The Analysis card renders 12 labeled prose sections, in this order:

| # | Section | Icon | Content |
|---|---|---|---|
| 0 | *(Summary)* | — | 1 sentence: scoreline + high-level shape. Unlabeled. |
| 1 | Coming in | `time-outline` | Pre-match backdrop: form (last-5 W/L/D) + season averages (points scored, points conceded) for both sides + contrast sentence. |
| 2 | Commentary | `mic-outline` | 3-paragraph broadcast prose (shape / attack pattern / platform work). Paragraphs `\n\n` separated. |
| 3 | Variance | `analytics-outline` | Names the 2–3 axes with biggest gaps as the deciding dimensions. |
| 4 | Attack | `flash-outline` | Axis narrative. |
| 5 | Defence | `shield-outline` | Axis narrative. |
| 6 | Set-piece | `layers-outline` | Axis narrative. |
| 7 | Discipline | `warning-outline` | Axis narrative. |
| 8 | Kicking | `send-outline` | Axis narrative. |
| 9 | Territory | `map-outline` | Axis narrative. |
| 10 | Possession | `american-football-outline` | Axis narrative. |
| 11 | Turnovers | `swap-horizontal-outline` | Axis narrative. |
| 12 | Going forward | `compass-outline` | Closing outlook: what each side will want to sharpen. Mirrors Coming in as an opener/closer pair. |

Icons are chosen and rendered by the card; the LLM does not need to
know about them.

## 2. Visual grammar (client-side, non-negotiable)

- Every section is a small-caps mini-label centered above prose.
- No boxes, dividers, cards-within-cards, or tabular columns.
- No team flag icons inside the sections themselves (the fixture header
  above already shows both flags).

Do not violate this from either side. If the LLM produces tabular output,
the card will render it as garbled prose.

## 3. Tone rules

- **BI / broadcast analyst voice.** Data-driven, specific, confident. Not
  hype-driven and not academic. Think a Ben Ryan / Nick Mullins segment
  read, not a match-day tweet.
- **Present-tense for live matches, past-tense for completed.** The
  section text should flip cleanly on the `status` field.
- **Metrics are woven into prose. NEVER tabulated.** The numeric detail
  lives in the Stats and Insights tabs; this tab tells the story.
- **Journalistic sentence rhythm.** Aim for 1–3 sentences per axis
  paragraph. Vary length. Avoid the "single-cadence" AI monotone.
- **British English.** Metres, defence, favours, etc.

## 4. Style rules (the AI-tell purge)

Users flagged em-dash overuse as a clear AI-tell. The template was scrubbed
of them. Keep it that way.

- **Avoid the ` — ` (em-dash-with-spaces) pattern in prose.** Also avoid
  ` – ` (en-dash-with-spaces). Use one of:
  - **Parentheses** for numeric asides: `"Ireland (58% possession)"`.
  - **Commas + coordinators** for expansions: `"has been the harder to
    break, and Ireland's line integrity is the story."`.
  - **Sentence splits** for standalone claims: `"the standout. Each
    turnover…"`.
  - **Colons** when introducing a definition or list: `"speaks to the
    pattern: high-tempo, hands-first attacking…"`.
- **Simple hyphen for scorelines**: `"RSA 28-22 IRE"`, not `"RSA 28 — 22
  IRE"`.
- **No emojis.**
- **No headings, bullets or Markdown** inside the narrative fields. The
  card renders plain text.
- **Do not name-drop** commentators, coaches, or players unless the
  fixture data explicitly names them. (v1 uses synthetic player names
  — see PRD §5.5 / root CLAUDE.md §9.)

## 5. Content rules

### 5.1 Grounding

**Never invent numbers.** Every stat in the prose must come from the
fixture context payload the model is handed. If a stat isn't in the
payload, don't mention it. If the payload has zero events yet (kick-off
just happened, sim mode not run), reflect that — don't fabricate a
turning point.

### 5.2 Baseline references

For each side's per-team baseline (season aggregate as of kickoff),
mention it in the narrative only when today's value is materially off
that baseline:

- **Numeric axes:** > ±15% off baseline.
- **Percentage axes:** > ±5 percentage points off baseline.

Below those thresholds, leave the baseline out — a "vs 22 avg" line in
every paragraph is noise. When triggered, weave the reference in prose
form (`"comfortably above their 22-per-game norm"`), not chip form.

### 5.3 Opener / closer symmetry

- **Coming in** sets the pre-match backdrop (form, coming-in season
  averages). It names each side once, then contrasts them.
- **Going forward** names one growth area for each side, based on the
  biggest weakness surfaced today, framed constructively (`"will want
  to sharpen X"`). If a side has no material weakness, gracefully
  fall back to `"a broadly balanced read, marginal gains only"`.

Weakness priority (highest first):
1. Cards taken
2. Defensive baseline breach (points conceded > season line by ≥15%)
3. Set-piece leak (own scrums lost ≥ 2 OR own lineouts lost ≥ 3)
4. Penalty count ≥ 3 above opposition
5. Attacking baseline breach (points scored < season line by ≥15%)

### 5.4 Live vs completed

- **Live:** always name the current match minute at least once
  (variance / summary / commentary). Use "so far", "at 42'", "opening
  up". Never write a definitive claim ("the difference-maker") — use
  "shaping up to be", "on track to be".
- **Completed:** past tense throughout. Full-time framing. The Going
  forward paragraph can be prescriptive without hedge.
- **Half-time:** treat as live but reference the H/T score and the
  coach's message beat.

### 5.5 Language avoid-list

Do not use these phrases (all AI-tells or over-used clichés):

- "delve into"
- "landscape"
- "in the world of"
- "when it comes to"
- "at the end of the day"
- "it's important to note that"
- "a testament to"
- "in essence"
- "moreover"
- "furthermore" (use "and" or a new sentence)
- Any use of the word "elevate" outside of restart / kick contexts.

### 5.6 Sentence-starter variation

Do not start every paragraph with the same construction. In particular,
do not repeat "TEAM ahead on…", "TEAM's attack has been…", or "TEAM
have monopolised…" as a rigid axis-by-axis opener. Vary between:

- Naming the leader up front.
- Naming the axis / dimension up front ("Territory has swung heavily
  the home side's way…").
- Leading with the finding ("Line integrity is the story of the last
  20 minutes…").

## 6. Refresh cadence (server-side, when LLM is wired up)

- **Live matches:** event-driven regeneration, debounced 60 seconds.
  Trigger events: `try`, `conversion`, `penalty-goal`, `drop-goal`,
  `yellow-card`, `red-card`, `half-time`, `full-time`. Rapid clusters
  (try + immediate conversion) collapse into a single call.
- **Completed matches:** one-shot at fulltime, cached indefinitely
  keyed on fixture ID.
- **Scheduled / postponed / cancelled:** never called. The card shows
  the empty-state message client-side.
- **Practical target:** ≤ 15 LLM calls per 80-minute match.

## 7. Cutover checklist — Phase 6 (or when authorised)

When the app is production-ready and the licensing GATE (register #5)
clears for real data, this stub is replaced. Do NOT ship a production
build without the following:

1. **Server-side inference path**
   - Cloud Run route `POST /fixtures/:id/analysis` in the personal GCP
     project `rugby-mobile-app`.
   - LLM provider key in Secret Manager. The mobile client NEVER holds
     an inference key (mirror of the same rule that keeps the data-feed
     key off the client — see root `CLAUDE.md` §8).
   - Cache the response in the same store as `/fixtures/:id/result`
     (Cloud SQL or the API's local cache tier). Keyed on
     `(fixture_id, generated_at_minute, model_version)` so cache-bust
     is clean when this spec changes.

2. **Prompt assembly**
   - System prompt = this document (copy verbatim from the checked-in
     markdown file, do not re-transcribe).
   - User prompt = fixture context blob: `Fixture`, `Result`, team
     names and short codes, both teams' season aggregates as of
     kickoff, both teams' last-5 form. Same fields the current
     template reads.
   - Response format: JSON matching the `MatchAnalysis` interface
     exported from `mobile/src/hooks/use-match-analysis.ts`.

3. **Hook rewire**
   - Replace the client-side `buildAnalysis()` call with a
     TanStack Query `useQuery` against the Cloud Run endpoint.
   - Keep the empty-state gate for `scheduled` / `postponed` /
     `cancelled` — don't call the endpoint for those.
   - Delete the client-side template helpers (`buildSummary`,
     `buildContext`, `buildCommentary`, `build*Narrative`,
     `buildOutlook`, and the shape/attack/platform paragraph
     helpers). They are template-only and disappear at cutover.
   - Live-refresh: hook's `refetchInterval` off — server pushes
     regenerations via the same fixture-result invalidation
     mechanism (see server-side ingestion for pattern).

4. **Model choice** (confirm before wiring)
   - Provider: **[INPUT NEEDED — Phase 6]** (Anthropic vs OpenAI vs
     Gemini).
   - Model tier: **[INPUT NEEDED — Phase 6]**. Recommend the top-tier
     reasoning model for the completed-match one-shot; a faster
     mid-tier for live regenerations to keep per-match cost bounded.
   - Approximate budget target: <$0.05 per completed-match report,
     <$0.30 total per live match across the ~15 regenerations.

5. **Data-source guardrail** (register #27 in PRD)
   - **Never ship the synthetic dev dataset to a production build.**
     The current template's numbers come from synthetic data; the
     production LLM must be reading real Opta (or chosen provider)
     data. Verify the fixture context blob is sourced from the real
     provider before enabling this endpoint in production.

6. **Delete the template**
   - Remove the client-side template functions. They are the
     specification of the model's job, and once the model is wired up
     they become dead weight. Retain this markdown file as the model
     brief.

## 8. Non-goals

- **No player-level commentary in v1.** The synthetic dataset ships
  fake player names (root `CLAUDE.md` §9). Even with real data at
  Phase 6, name-level analysis needs licensing sign-off. This spec
  keeps the analysis team-level.
- **No historical head-to-head references.** The Team tab (or a
  future Fixtures head-to-head surface) is where H2H narrative lives.
  Don't cross-contaminate.
- **No betting / odds / prediction language.** Explicitly out of scope
  in v1 (root `CLAUDE.md` §9). Do not write "expected to win", "value
  bet", "trading at", etc.

---

## Change log

- **v1** — Initial spec extracted from the client-side template built
  in Phase 0. Captures tone, style, structure, refresh cadence,
  cutover checklist, and language avoid-list. The templated
  `use-match-analysis.ts` implements this spec directly and is the
  reference implementation.
