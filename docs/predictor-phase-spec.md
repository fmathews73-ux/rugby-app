# Predictor — Phase 6 Specification

**Status:** Tab entry point wired in Phase 0. Model, feature pipeline,
inference route, and calibration all **DEFERRED to Phase 6**. See §7
below for the phase-work checklist.

Parallel structure to `docs/analysis-narrative-spec.md`: the tab exists
now so the IA is stable for downstream design work, but the real
implementation lands with the rest of the ML / server-side inference
tier when the data-licence GATE clears.

---

## 0. What this document exists for

The Predictor tab surfaces ML-driven predictions for individual matches
and full-tournament winners. During Phase 0–5 the screen is a placeholder
that names the feature and its phase context. This document is the
specification of what has to be built when Phase 6 opens.

Keep this file in sync with the tab-screen implementation. If the
prediction UI, feature set, or model contract changes, edit this doc in
the same commit as the code.

---

## 1. Product scope (v1)

Two prediction surfaces at Phase 6 launch:

1. **Match predictor** — for any fixture (past, live, or upcoming) show:
   - Point-estimate win probability per team + a draw probability.
   - A confidence band (± percentage points at 90% CI).
   - Predicted winning margin distribution (median + IQR).
   - The 3-5 highest-weight features driving the prediction ("Ireland
     ranked 6 higher, +14pp; France home advantage, +8pp; Ireland on a
     4-win streak, +6pp").

2. **Tournament predictor** — for each in-flight competition (Six
   Nations, Rugby Championship, RWC 2027) show:
   - Win-tournament probability per team (Monte Carlo over remaining
     fixtures using the match predictor).
   - Expected finish position per team.
   - Bracket-style predictions for knockout stages (RWC pool → QF → SF
     → F).

**Explicitly out of v1** (defer to a later phase):
- Player-level predictions (top try-scorer, MVP, etc.) — requires
  player-level licensed data.
- Betting-odds integration or presentation — banned by root CLAUDE.md
  §9 for the app's entire life.
- Fantasy-adjacent value predictions — Fantasy is a header entry only.

## 2. Model choice — options and tradeoffs

Three viable model families; pick one at Phase 6 kickoff:

### 2a. Rugby-specific ELO variant

- ELO with home-advantage bump, margin-of-victory scaling, and a
  competition-context weight (test matches vs Six Nations vs RWC each
  weighted differently).
- **Pros**: interpretable, fast to train, well-understood in the rugby
  analytics community (used by 538, World Rugby's own ranking system).
- **Cons**: linear in the underlying features, misses complex
  interactions (e.g. how squad rotation impacts a specific match-up).

### 2b. Gradient-boosted trees

- Features: ELO ratings, ranking, recent form, home/away, competition
  context, days rest, injury signals (later).
- **Pros**: handles feature interactions, calibrates well with isotonic
  regression, tabular data is its sweet spot.
- **Cons**: less interpretable, needs a training pipeline, benefits
  from more data than we have on Tier-2 teams.

### 2c. Small neural net (MLP with embedding layers)

- Learned team embeddings + engineered features.
- **Pros**: can capture non-linear rating dynamics, embeddings can be
  reused for other features (opposition-specific form).
- **Cons**: overkill for our data volume, hardest to explain in the
  "highest-weight features" UI (§1.1 above), most infrastructure to
  serve.

**Recommendation:** start with **2a (ELO variant)** for the launch
model. It gives us interpretable predictions immediately, low
infrastructure cost, and a strong baseline the tree-based model has to
beat. Ship 2b as a v2 upgrade once we have a training pipeline and 6+
months of real predictions to backtest against.

### 2d. Platform decision — BigQuery ML (owner decision 2026-07-13)

**BigQuery ML is the working-assumption training and batch-scoring
platform** for whichever model family wins. Rationale and consequences:

- **Already in the stack** (PRD §6: analytics/rankings live in
  BigQuery), so canonical results land there anyway; the §3 feature
  pipeline becomes SQL views over those tables — no separate feature
  store or Python training service.
- **Covers the §2 menu**: `LOGISTIC_REG` (the disciplined baseline and
  the ELO-adjacent linear model), `BOOSTED_TREE_CLASSIFIER` (2b), DNNs
  if ever justified (2c). `ML.EVALUATE` emits the §5 log-loss/Brier
  metrics natively; `ML.EXPLAIN_PREDICT` feeds the `top_features`
  contract in §4 with real attributions.
- **Batch-precompute architecture supersedes live inference in §4**:
  match probabilities only change when inputs change, so a scheduled
  job runs `ML.PREDICT` after each ingest, writes rows to Cloud SQL,
  and the Cloud Run routes serve *precomputed* predictions. The §4
  guardrails hold by construction (no weights or keys near the
  client); the live-match 15-min rescore becomes a re-run of the batch
  job on the live ingest cadence.
- **Tournament simulation stays app code**: the Monte Carlo loop is a
  Cloud Run job consuming the match-model probabilities; BQML supplies
  the per-match numbers only.
- **Bake-off requirement unchanged**: any BQML model must beat the
  naive ranking-implied baseline (§5) on held-out matches before it
  ships. ~130 internationals/year is small data — expect the logistic
  baseline to be hard to beat.

## 3. Feature pipeline

Features live in a Cloud Run job that runs after every completed
international match, materialising a per-team feature snapshot into
Cloud SQL:

| Feature | Source | Cadence |
|---|---|---|
| ELO rating | Internal ELO update job | Per completed match |
| World Rugby ranking + trajectory | `useLatestRanking` snapshot | Weekly |
| Recent form (last-5 W/L/D) | `useTeamRecentForm` | Per completed match |
| Attacking / defensive per-game rates | `useTeamAggregate` | Per completed match |
| Home / away context | `Fixture.venue` + team country | Per fixture |
| Days rest | Kickoff delta from last completed | Per fixture |
| Competition context | `Fixture.competition_id` | Per fixture |
| Head-to-head record | Historical fixture query | Per fixture |
| Injury / squad rotation signal | **[DEFERRED — needs squad-list feed]** | — |

All features are match-scoped for prediction time — never use "future"
data (points scored in this match, etc.). The training pipeline uses
kickoff timestamp as the "as of" cutoff for every feature computation
so the model never learns from leakage.

## 4. Server-side inference

Same guardrails as `docs/analysis-narrative-spec.md`:

- Model weights + inference key **NEVER** in the mobile bundle. Client
  fetches predictions via a Cloud Run route.
- Cloud Run route: `POST /predictor/match/:fixtureId` and
  `POST /predictor/tournament/:seasonId`.
- Cache per-fixture predictions with 15-minute TTL for live matches
  (model rescores as events land) and indefinite for completed
  fixtures.
- Cache tournament predictions with 1-hour TTL — Monte Carlo is
  expensive, results only meaningfully change after another fixture
  completes.

Response contract:

```ts
interface MatchPrediction {
  fixture_id: string;
  generated_at: IsoDateTime;
  model_version: string;
  home_win_prob: number;      // 0..1
  away_win_prob: number;      // 0..1
  draw_prob: number;          // 0..1 (sum with above = 1)
  confidence_band_pp: number; // ± percentage points at 90% CI
  predicted_margin: {
    median: number;           // signed; positive = home ahead
    iqr_lower: number;
    iqr_upper: number;
  };
  top_features: {
    label: string;            // "Home advantage"
    impact_pp: number;        // signed % contribution
  }[];
}

interface TournamentPrediction {
  season_id: string;
  generated_at: IsoDateTime;
  model_version: string;
  simulations: number;        // e.g. 10_000
  win_probs: { team_id: string; prob: number }[];
  expected_position: { team_id: string; median: number; iqr: [number, number] }[];
  bracket?: {                 // only for knockout stages (RWC)
    stage: 'QF' | 'SF' | 'F';
    advance_probs: { team_id: string; prob: number }[];
  }[];
}
```

## 5. Calibration and evaluation

Calibration matters more than raw accuracy for prediction UI. Users
who see "78% win probability" should observe roughly 78% of such
predictions come true over time. Otherwise the number is decoration.

- **Metrics**: log-loss (primary) and Brier score on a rolling
  held-out set of the most recent 20% of completed matches.
- **Calibration**: isotonic regression on validation set, applied to
  raw probabilities before serving.
- **Backtest**: at Phase 6 launch, backtest against 2 seasons of Six
  Nations + Rugby Championship + summer tests. Publish log-loss vs a
  naive "always higher-ranked side wins" baseline in the info modal so
  users can see the model's actual signal-vs-noise.

## 6. UI presentation

Two screens under the Predictor tab:

- **/predictor** (index) — list of upcoming + live fixtures, each with
  the point-estimate probability chip. Tap → match detail.
- **/predictor/match/:fixtureId** — full match prediction card: bar
  splitting home / draw / away probabilities, margin distribution
  chart, top-features list, model-version + generated-at footer.
- **/predictor/tournament/:seasonId** — tournament dashboard: win
  probability per team, expected finish, bracket viz for RWC.

Reuse the same visual grammar established on the Insights tab: labeled
sections, light swatch legend chips, `#9CA3AF` baselines, home-blue /
away-purple team colours where two teams appear (match predictor).

Every prediction card includes an info modal explaining:
- Metric definition ("78% means the model expects home to win 78 out
  of 100 replays of this match").
- Model version + last training date.
- Calibration status ("Log-loss 0.62 vs naive baseline 0.73 on last
  season's Six Nations").

## 7. Phase 6 work checklist

Do NOT ship any of this before Phase 6. The tab-entry stub in Phase 0
is deliberate — it locks the IA. Everything below is deferred:

- [ ] **Model design decision** (§2) — pick ELO variant vs GBT vs
      neural net. Default recommendation: ELO variant.
- [ ] **Feature pipeline** (§3) — Cloud Run scheduled job materialising
      feature snapshots into Cloud SQL after every completed match.
      Backfill against 2 seasons of historical fixtures.
- [ ] **Training pipeline** — offline training on the historical
      feature set, versioned model artifacts in GCS.
- [ ] **Inference route** (§4) — Cloud Run route serving predictions
      via cached JSON responses. Model weights in GCS, loaded on cold
      start. No inference key in the client.
- [ ] **Calibration + backtest** (§5) — isotonic regression on
      validation set, log-loss + Brier + baseline comparison surfaced
      in the info modal.
- [ ] **Match predictor UI** (§6) — probability bar + margin
      distribution + top features. Reuse Insights visual grammar.
- [ ] **Tournament predictor UI** (§6) — Monte Carlo dashboard + RWC
      bracket viz.
- [ ] **Guardrails check** — same as analysis path: NEVER ship model
      weights or an inference key in the client; NEVER predict against
      real player names until image / name licensing clears (root
      CLAUDE.md §9).
- [ ] **Delete the Phase 6 placeholder screen** — the current
      `mobile/src/app/(tabs)/predictor.tsx` gets replaced by the real
      index screen at cutover.

## 8. Non-goals

- **No betting integration.** Explicitly out of scope in root
  CLAUDE.md §9. Do not surface odds, "value picks", "expected returns",
  or any language that reads as a wagering aid.
- **No player-level predictions in v1.** Player-name licensing is a
  Phase 6 dependency; even after it clears, top-try-scorer /
  MVP-style predictions are a v2 concern.
- **No live in-play "next scoring event" style predictions.** Real-time
  probabilistic score-line updates on live matches is a v2+ scope
  (needs live-event streaming infrastructure we don't have yet).

---

## Change log

- **v1** — Phase entry stub landed with tab wiring. Full model + feature
  + inference spec pinned for Phase 6 cutover. Parallel to the
  analysis-narrative spec: build the entry point + the brief now, land
  the real implementation when the ML tier is authorised.
- **v1.1 (2026-07-13)** — Platform decision recorded (§2d): BigQuery ML
  trains and batch-scores the model; predictions PRECOMPUTED to Cloud
  SQL and served as rows (supersedes §4's live-inference framing).
  Predictor UI to be built ahead of Phase 6 against a synthetic
  predictions endpoint matching the §4 contract, dev-gated like all
  synthetic data.
- **v1.2 (2026-07-13)** — **Tournament/champion predictions DESCOPED**
  (owner decision): they are derivatives of match predictions and the
  table works itself out as rounds complete. Product scope is
  **next-match-per-team ONLY** — one live prediction per team, the
  match re-pricing as results land; no probabilities are shown for
  fixtures beyond a team's next game (they depend on unplayed
  results). `TournamentPrediction`, its route and the §6 tournament
  dashboard are removed from scope; ignore tournament references in
  §1/§4/§6 above.
