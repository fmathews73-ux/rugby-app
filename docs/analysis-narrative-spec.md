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

| # | Section | Content |
|---|---|---|
| 0 | *(Summary)* | 1 sentence: scoreline + high-level shape. Unlabeled. |
| 2 | Commentary | 3-paragraph broadcast prose (shape / attack pattern / platform work) + a closing MATCH-FLOW paragraph from the scoring timeline: lead changes, when the (current) leader hit the front, and the largest unanswered run (named only at 10+ points). Flow paragraph is omitted when there are no scoring events. Paragraphs `\n\n` separated. |
| 3 | Variance | Names the 2–3 axes with biggest gaps as the deciding dimensions. |
| 4 | Attack | Axis narrative. |
| 5 | Defence | Axis narrative. |
| 6 | Set-piece | Axis narrative. |
| 7 | Discipline | Axis narrative. |
| 8 | Kicking | Axis narrative. |
| 9 | Territory | Axis narrative. |
| 10 | Possession | Axis narrative. |
| 11 | Turnovers | Axis narrative. |
| 12 | Verdict | Closing verdict — the match read back through the control-vs-conversion lens (who held ball + ground, who converted, which settled it). Seals the story; NEVER forward-looking (renamed from Outlook 2026-07-06 — its evidence chart is Control vs Conversion, a this-match verdict, so the prose matches). Team/player cards keep their forward-looking Outlook. |

"Coming in" was RETIRED from the match analysis (2026-07-06): the
kickoff backdrop belongs to the Pre-Match surface (§11 Shape now opens
with the per-game baselines), keeping the split clean — Pre-Match =
known at kickoff, match analysis = strictly the match itself.

Every section header renders the standard info icon (14pt,
`information-circle-outline`) after its label, opening that section's
explainer modal — copy lives in `mobile/src/lib/analysis-section-info.ts`
(axis explainers shared by the match + pre-match cards). Decorative
per-section glyphs were retired 2026-07-06. The LLM does not need to
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
- **Tense register per surface (canonical table — decided 2026-07-05):**

  | Surface | Register | Rationale |
  |---|---|---|
  | Pre-match (§11) | Present + forward-looking modality ("arrive having won", "will look to play this in the air"). NEVER regenerated or re-tensed after kickoff — the frozen pre-match voice IS the artefact. | It's a preview; pure grammatical future throughout reads robotic. |
  | Match analysis, live | Present / present-perfect ("lead at 42'", "has been the harder side to break"). | The story is unfolding. |
  | Match analysis, full-time | Past ("controlled", "outperformed"). | The story is closed. |
  | Team analysis (§10) | Present-perfect with present-state verdicts ("have won 7 of 10", "the set-piece is a platform"). NOT pure past. | The window is ongoing; past tense would close an era that isn't closed. |
  | Player analysis (§9) | Present-perfect with present-state verdicts ("sits in the 74th percentile", "minutes have climbed"). NOT pure past. | Past tense on an active player reads like a retirement notice. |
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

**Metric coverage.** The Result payload includes, beyond the classic
box-score set: breakdown counts (rucks won/lost, mauls won/lost, quick-
ball % recycled inside 3s), extended attack (defenders beaten, post-
contact metres, gainline success %), 50/22 kicks, dominant tackles, and
the penalty-cause split (scrum / breakdown / offside). These are
REPORTABLE dimensions, threshold-gated like everything else:

- Ruck retention: name it when either side dips under 88% or the gap
  is ≥ 4pp (platform paragraph).
- Quick ball: name a ≥ 10pp gap as the tempo story.
- Mauls: a weapon at 8+ won with a ≥ 3 gap; a liability at 2+ lost
  (woven into the Set-piece axis narrative — mauls are lineout-drive
  adjacent).
- Gainline: name a ≥ 8pp gap, qualified with post-contact metres
  (attack paragraph).
- 50/22: rare enough that ANY successful one gets named (kicking
  narrative).
- Penalty causes: name the dominant bucket only when it carries ≥ 50%
  of the offending side's count.

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

- **The summary** cold-opens the card (Coming in retired 2026-07-06 —
  the kickoff backdrop lives on the Pre-Match surface, §11 Shape).
- **Verdict** (match card) seals the story through the control-vs-
  conversion lens — even control → margins; control converted → the
  match went the way of the ball; control beaten → conversion won it.
  (Team/player Outlook sections remain forward-looking.) If the read is
  balanced, gracefully
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

7. **Bundle the composition guide into the system prompt**
   - The system prompt is TWO documents: this spec (what to write —
     structure, thresholds, rules) + `analysis-composition-guide.md`
     (how it must read — voice, cadence, insight patterns, forbidden
     moves). Neither ships alone. PRECONDITION (register #29): the
     client templates must have passed a full composition pass against
     the guide BEFORE cutover, because the template outputs double as
     few-shot reference material for prompt evaluation.

## 8. Non-goals

- **No player-level commentary inside the MATCH analysis.** The match
  card stays team-level. Player-scoped narrative lives on the player
  card's own Analysis tab and is governed by §9 below — do not weave
  named-player reads into the match sections. (With real data at
  Phase 6, name-level analysis additionally needs licensing sign-off.)
- **No historical head-to-head references.** The Team tab (or a
  future Fixtures head-to-head surface) is where H2H narrative lives.
  Don't cross-contaminate.
- **No betting / odds / prediction language.** Explicitly out of scope
  in v1 (root `CLAUDE.md` §9). Do not write "expected to win", "value
  bet", "trading at", etc.

---

## 9. Player analysis narrative (player card · Analysis tab)

The player card (Teams → team hub → player) carries the same
Preview / Stats / Insights / Analysis sub-tab anatomy as the fixture
drill. Its Analysis tab renders a PLAYER-scoped narrative. During
Phase 0–5 the copy is produced client-side by
`mobile/src/hooks/use-player-analysis.ts`; at Phase 6 the same cutover
model applies (server-side inference, this section as the system
prompt, the `PlayerAnalysis` interface as the response contract).

All tone rules (§3), style rules (§4), the language avoid-list (§5.5),
and sentence-starter variation (§5.6) apply unchanged. Grounding (§5.1)
applies with the player's data instead of the fixture's: every claim
must trace to the player's match sheets, the positional percentile
read-model, or the season aggregate. Never invent a number.

### 9.1 Card structure (fixed, in order)

| # | Section | Content |
|---|---|---|
| 0 | *(Summary)* | 1–2 sentences: name, position, caps, appearance/start/minute record, points contribution if any. Unlabeled cold open. |
| 1 | Scouting | Percentile profile vs positional peers (per-80 rates, prev.-10 window). Names strengths and the soft spot. |
| 2 | Form | Recent-half vs earlier-half comparison across the appearance window: role key metric + minutes trend. |
| 3 | Outlook | Closing outlook built from the profile: what to lift, what to hold. Mirrors the summary as an opener/closer pair. |

### 9.2 Thresholds (must match the template / future prompt)

- **Strength:** presentation percentile ≥ 70 vs positional peers
  (inverted metrics — penalties conceded, handling errors — are
  flipped before the test, so higher is always better). Name at most
  the top two.
- **Soft spot:** presentation percentile ≤ 30. Name only the weakest.
  If nothing qualifies either way, say the profile is balanced — do
  not manufacture a verdict.
- **Form move:** recent half of the appearance window vs the earlier
  half; a change of ±15% or more is a rise/dip, anything inside that
  band is reported as steady.
- **Minimum sample:** fewer than 6 appearances → no halves comparison;
  say the trend read is thin and point at the profile instead.
- **Trend coverage:** the form read covers ALL THREE of the role's
  Preview trend metrics (forwards: tackles / carries / metres; backs:
  metres / defenders beaten / points), each labelled rising / dipping /
  holding steady, plus the minutes trend. Never narrate only one.
- **Discipline:** any red card in the window is always named ("needs
  attention"); yellows are named when present. Zero cards → silence,
  never "clean record" padding.

### 9.3 Content rules specific to players

- **Refer to the player by surname** after the summary's full-name
  introduction. No nicknames, no pronoun guessing.
- **The scouting read and the Insights tab must agree.** Both are
  built from the same curated role dimension sets
  (`mobile/src/lib/player-roles.ts`) and the same percentile
  read-model. If the sets change, both surfaces change together.
- **No selection speculation beyond the data.** Minutes trends may be
  framed as "a read on selection trust"; do not predict future squad
  naming, and never use prediction/betting language (§8).
- **Synthetic-name rule carries over:** v1 players are fake names on
  real national teams (root `CLAUDE.md` §9); with real data at
  Phase 6, player-level narrative requires the licensing sign-off
  flagged in §8 before cutover.

---

## 10. Team analysis narrative (team overview · Analysis tab)

The team overview page (Teams → team hub) carries the drill sub-tab
anatomy (Preview / Squad / Insights / Analysis). Its Analysis tab
renders a TEAM-scoped narrative. During Phase 0–5 the copy is produced
client-side by `mobile/src/hooks/use-team-analysis.ts`; at Phase 6 the
same cutover model applies (server-side inference, this section as the
system prompt, the `TeamAnalysis` interface as the response contract).

All tone rules (§3), style rules (§4), the language avoid-list (§5.5),
and sentence-starter variation (§5.6) apply unchanged. Grounding (§5.1)
applies with the team's data: every claim must trace to the team's
completed-fixture results window, the World Rugby ranking snapshots, or
the per-game season aggregate. Never invent a number. Unlike the match
card, this narrative may NOT reference individual players — player
narrative lives in §9.

### 10.1 Card structure (fixed, in order)

| # | Section | Content |
|---|---|---|
| 0 | *(Summary)* | 1 sentence: name, current world rank, W-L(-D) record over the window, points for/against per game. Unlabeled cold open. |
| 1 | Form | Current streak (if it qualifies) + average margin framing. |
| 2 | Ranking | Trajectory across the monthly ranking snapshots: climbed / slipped / held, with start and end positions. |
| 3 | Season | Per-game profile: attack (tries, carry metres, possession), defence (tries conceded, tackle %), then threshold-gated set-piece and discipline sentences. |
| 4 | Outlook | Names the single most pressing repair job, in priority order: discipline → weaker set piece → defensive leakage → consolidation. Mirrors the summary as an opener/closer pair. |

### 10.2 Thresholds (must match the template / future prompt)

- **Window:** last 10 completed fixtures for record, margin, and season
  profile.
- **Streak:** named only at 3+ consecutive wins or losses (draws never
  form a streak).
- **Dominance / struggle:** average margin of ±7 points per game;
  inside that band, margins are framed as tight.
- **Set piece:** ≥ 90% on BOTH scrum and lineout reads as a platform;
  either below 85% is flagged, naming the weaker of the two.
- **Discipline:** ≥ 12 penalties conceded per game is a problem;
  ≤ 9 is praised; between, discipline goes unmentioned.
- **Ranking move:** ± 2 or more places across the snapshot span is a
  climb/slide; less holds steady. Fewer than 2 snapshots → say the
  history is insufficient, do not extrapolate.
- **Window vs season baseline (Form):** points scored / conceded
  per game in the window compared against the FULL-SEASON per-game
  baseline (the Stats pane's second column). Reported only when the
  divergence is ± 15% or more AND the season sample is larger than the
  window itself.
- **Scoring timing (Season read):** the quarter split (Q1–Q4 share of
  points scored and conceded), averaged across the LAST-10 window —
  the same prev-10 window as every other analytical read. A quarter is
  named only when it carries ≥ 35% of the relevant points — one
  sentence for the scoring skew, one for the soft period
  conceding-wise. Below the threshold, timing goes unmentioned.

---

## 11. Pre-match analysis (fixture drill · Pre-Match tab)

A card below the Pre-Match chart carousel: the broadcast-style read of
what the match will most likely be about, setting a realistic
expectation before kickoff. The preview is a FROZEN PRE-KICKOFF
DOCUMENT — it renders for scheduled, live, and completed fixtures and
persists unchanged after full-time, so readers can set it against the
Analysis tab's post-match story ("did it play out the way the numbers
said it would?"). Live / completed fixtures carry an "AS OF KICKOFF"
chip; only postponed / cancelled fixtures get no preview. Template
implementation: `mobile/src/hooks/use-match-preview.ts`; at Phase 6
the same cutover model applies (this section as the system prompt,
the `MatchPreview` interface as the response contract), with the
completed-fixture render served from the cached pre-kickoff
generation — never regenerated post-match.

All tone rules (§3), style rules (§4), the avoid-list (§5.5),
sentence-starter variation (§5.6), and grounding (§5.1) apply
unchanged. Grounding is strictly AS OF KICKOFF on every input — both
sides' prev-10 profiles, last-5 form, world rankings, and
quarter-timing patterns all exclude the fixture itself and anything
after it. The card keeps its pre-match voice (present/forward tense)
even when read after full-time; that frozen voice is the point.

**HARD RULE — no predictions.** The card must never name a likely
winner, use probability language, or imply a result ("expected to
win", "should be too strong", "favourites"). Root `CLAUDE.md` §9 bans
betting/odds language app-wide; this card lives closest to that line
and must stay on the right side of it. Conditions, not outcomes.

### 11.1 Card structure (fixed, in order)

| # | Section | Content |
|---|---|---|
| 0 | *(Summary)* | The billing: ranking framing (mismatch ≥8 places / edge ≥3 / meeting of equals) + both sides' last-5 win counts. |
| 1 | Shape | OPENS with the coming-in backdrop (both sides' prev-10 points for/against per game — moved here from the match analysis 2026-07-06), then the 2–3 axes where the prev-10 profiles genuinely diverge, named as the likely battlegrounds. Balanced profiles are called balanced ("decided by execution"), never forced. |
| 2–9 | Attack / Defence / Set-piece / Discipline / Kicking / Territory / Possession / Turnovers | same glyphs as §1's axes | Per-axis coming-in comparison — the SAME eight axes, order, and icons as the match analysis so the pre- and post-match reads line up section for section. Each axis compares one headline metric on fixed thresholds into three tiers: clear edge / shades it / even (see 11.2), with secondary metrics woven in for texture. "Edge" is a data statement about the coming-in numbers, never a result call. |
| 10 | Danger periods | Quarter-timing collisions: one side's scoring skew landing in the other's leakiest quarter. Lone skews named if no collision; SECTION OMITTED when neither side skews. |
| 11 | Keys | One condition per side, ALWAYS derived from the signed axis gaps — the side ahead on the fixture's biggest gap gets the EXPLOIT framing (how to press it), the side behind gets the NEUTRALISE framing (the survival job), each with the numbers woven in. When the second-ranked gap is ≥70% of the top gap and favours the other side, that side keys off its own weapon instead — two battlegrounds beat two views of one. Dead-heat profiles (top gap < half threshold) still key off the largest gap, framed as the fine margin. NO generic filler, ever — if a key could be written without this fixture's data, it is wrong. |

### 11.2 Thresholds (must match the template / future prompt)

Per-axis headline metrics and CLEAR-edge thresholds (the "shades it"
tier fires at half the threshold; inside that, the axis reads even):

| Axis | Headline metric | Clear edge |
|---|---|---|
| Attack | points scored /game (tries as texture) | ± 6 |
| Defence | points conceded /game (tackle % as texture) | ± 6 |
| Set-piece | combined scrum+lineout success | ± 4pp |
| Discipline | penalties conceded /game | ± 2.5 |
| Kicking | kick metres /game (kicks-in-play as texture) | ± 15% relative |
| Territory | average territory share | ± 6pp |
| Possession | average possession share | ± 6pp |
| Turnovers | net turnovers (won − conceded) /game | ± 2 |

- **Shape** ranks the qualifying gaps by normalised size and
  names at most three.
- **Timing skew:** a quarter carrying ≥ 35% of the relevant points
  across the prev-10 window (same threshold and window as §10.2).
- **Sample:** either side with zero completed matches → no preview
  (empty state), never a padded one.

---

## Change log

- **v1** — Initial spec extracted from the client-side template built
  in Phase 0. Captures tone, style, structure, refresh cadence,
  cutover checklist, and language avoid-list. The templated
  `use-match-analysis.ts` implements this spec directly and is the
  reference implementation.
- **v2** — Added §9 player analysis narrative (player card Analysis
  tab): structure, thresholds, player-specific content rules.
  Re-scoped the §8 player-commentary non-goal to the match card only.
  Template implementation: `use-player-analysis.ts`.
- **v3** — Added §10 team analysis narrative (team overview Analysis
  tab): structure, thresholds, no-player-references rule. Template
  implementation: `use-team-analysis.ts`.
- **v5** — Added §11 pre-match analysis (fixture Preview tab):
  billing / shape / danger periods / keys structure, axis-gap and
  timing thresholds, hard no-prediction rule. The preview persists
  after full-time as a frozen pre-kickoff document (compare-read
  against the match analysis); all inputs as-of-kickoff. Template
  implementation: `use-match-preview.ts`. (§ numbering note: §11
  slots between the team analysis §10 and this changelog.)
- **v4** — Pane-coverage pass: every narrative now accounts for its
  drill's Preview / Stats / Insights data. Match: ranking framing in
  Coming in + match-flow paragraph closing Commentary (lead changes,
  decisive run). Team: window-vs-season baseline deltas in the Form
  read + Q1–Q4 scoring-timing sentences in the Season read. Player:
  form read covers all three role trend metrics + discipline (cards)
  in the scouting read. Pitch-heatmap spatial data deliberately
  excluded from narratives (density does not convert to grounded
  prose).
