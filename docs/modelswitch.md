# Model-Switch Session Handoff

**Purpose:** brief the next Claude model picking up this session. Written by Opus 4.7 immediately before a `/model` switch, so the incoming model has full context of what's been decided, what's built, and what's next — without re-inferring it from git history or memory alone.

Read the file **once** at session start alongside root `CLAUDE.md`, `mobile/CLAUDE.md`, and any relevant memory in `~/.claude/projects/-Users-frankmathews/memory/`. Then discard from active attention — the code + memory are the durable truth.

---

## 1. What this project is

**Rugby.IQ** — a rugby BI mobile app under Frank Mathews's personal identity (`fmathews73-ux` on GitHub, personal GCP `rugby-mobile-app`, personal Apple ID). Native iOS + Android only via Expo (SDK 57, TypeScript, TanStack Query). Web is permanently OUT.

Positioning: analytical / data-forward, not media. Reference apps are Grafana, Linear, Stripe dashboards — not ESPN.

**Non-negotiable separation** (root `CLAUDE.md` §1): zero employer footprint anywhere. Never commit under a work identity. Personal noreply pattern: `fmathews73-ux <271925726+fmathews73-ux@users.noreply.github.com>`.

---

## 2. Phase state

We're in **Phase 0–1** (foundation + basic scaffolding, iterating on IA and design system). All data is synthetic in `services/pipeline/data/*.json` — real feed (Opta assumed) lands at Phase 6 when the licensing GATE clears.

**Two big features are deliberately stubbed** in Phase 0 so the IA is stable but the real implementation is deferred:

- **Analysis narrative card** (fixture-drill Analysis sub-tab). Real LLM cutover deferred to Phase 6. Full spec: `docs/analysis-narrative-spec.md`.
- **Predictor tab** (footer, rightmost). Real ML cutover deferred to Phase 6. Full spec: `docs/predictor-phase-spec.md`.

Both follow the same rule: the client NEVER holds an inference key or model weights. Inference is server-side Cloud Run in the personal GCP project.

---

## 3. Established design grammar (do not deviate without explicit request)

### 3a. Team colours (across every match-scoped BI chart)

- **Home team**: `#3B82F6` stroke (line) + `#93C5FD` fill (light blue family)
- **Away team**: `#8B5CF6` stroke (line) + `#C4B5FD` fill (light purple family)

Applied consistently across: Momentum, Scoring Progression, Pitch Heatmap, Profile radar (compare polygon), Insights Canvas.

### 3b. Structural chart lines

- **Axis / baseline / mirror**: `#9CA3AF` at `strokeWidth={1}` (was `Colors.light.text` at 1.5, lightened + thinned for BI restraint)
- **Grid / reference lines**: `#F3F4F6` at `strokeWidth={1}`
- **All stroke widths uniformly `1`** across Profile / Momentum / Progression / Heatmap

### 3c. Legend chip style (all four Insights charts)

- Row layout with `gap: Spacing.three`
- Item internal gap 5pt
- Line-swatch: `width: 10, height: 3, borderRadius: 1`
- Text: `TextSize.xs`, `semibold`, `Colors.light.text`, tabular-nums
- **Swatch colour uses the LIGHT FILL token**, not the stroke — reads as the polygon body colour rather than the darker outline
- No team-flag balls in legend; swatch + team code only

### 3d. Momentum is zero-sum (critical mental model)

The in-match Momentum card plots a SINGLE signed net-curve (home minus away weighted attacking activity). Split-fill at the baseline via SVG clip paths — home fills blue above, away fills purple below, colours hand off at every zero-crossing. **Never two independent per-team curves.** Full context: `feedback_rugby_momentum_arc` memory.

### 3e. Analysis card structure (fixture-drill Analysis sub-tab)

Fixed 12-section prose stack:
- Summary (unlabeled)
- Coming in (icon: `time-outline`)
- Commentary (icon: `mic-outline`)
- Variance (icon: `analytics-outline`)
- 8 axis narratives (Attack `flash-outline`, Defence `shield-outline`, Set-piece `layers-outline`, Discipline `warning-outline`, Kicking `send-outline`, Territory `map-outline`, Possession `american-football-outline`, Turnovers `swap-horizontal-outline`)
- Going forward (icon: `compass-outline`)

Every section: centered mini-label + icon + prose body. No boxes, no tables, no team flags in sections. Metrics WOVEN into prose, never tabulated (Stats tab is where the numbers live). Full spec + rules: `docs/analysis-narrative-spec.md`.

### 3f. AI-tell scrub (also in analysis-narrative-spec.md §4)

- No em-dashes ` — ` in prose. Use parentheses `()`, commas + coordinators, sentence splits, or colons.
- Simple hyphen for scorelines (`RSA 28-22 IRE`).
- No emojis.
- Watch the avoid-list in the spec (§5.5): "delve into", "landscape", "in the world of", "at the end of the day", "a testament to", "moreover", "furthermore", etc.

---

## 4. IA (Information Architecture) as it stands

**Footer tabs** (left → right):
Home · Fixtures · Teams · Standings · Rankings · **Predictor** (new, Phase 6 stub)

**Fixture drill sub-tabs** (left → right, temporal-flow + synthesis-at-end):
Preview · Line-Up · Timeline · Stats · Insights · Analysis

**Insights pane card order** (top → bottom):
Profile → Momentum → Scoring Progression → Pitch Heatmap

**Fixtures index landmark rule**: on tab press + on back-from-drill-in + on initial mount, the list snaps to the day-card **closest to today's date** (was "most recent completed"). Implemented via `useFocusEffect` in `mobile/src/app/(tabs)/fixtures/index.tsx`.

**Fixtures nested Stack** has `unstable_settings.initialRouteName = 'index'` in `mobile/src/app/(tabs)/fixtures/_layout.tsx` so drill-in pushes always sit on top of the list, and back / tab-press pops naturally.

---

## 5. Recent session's completed arcs

Working backwards through this session:

1. **Predictor tab stub landed.** `mobile/src/app/(tabs)/predictor.tsx` — placeholder with Phase 6 pill + sparkles-outline icon. Spec at `docs/predictor-phase-spec.md`. Same guardrails as Analysis (no weights on client).
2. **Teams footer moved to position 3**, sitting after Fixtures. `_layout.tsx` reorder.
3. **Fixtures landmark rule rewritten**: closest-to-today (not most-recent-completed). Applies on tab press + initial mount + `useFocusEffect` on drill-back.
4. **Fixtures drill-back / deep-link fix**: `unstable_settings.initialRouteName = 'index'` so `router.push('/fixtures/[id]')` from Home cards keeps `index` underneath.
5. **Copy tweak**: `Form (last 10)` → `Form (prev. 10)` and `Profile (last 10)` → `Profile (prev. 10)`. Applies to `ExtendedMomentum` + `MyTeamProfileCard`.
6. **Fixture sub-tab order stabilised** at Preview → Line-Up → Timeline → Stats → Insights → Analysis (temporal + synthesis-at-end after iteration).
7. **Pitch Heatmap rebuild**: dropped team toggle, both teams overlay (light blue + light purple), canvas from broadcast-green to `#FAFAFA`, pitch markings aligned to `#9CA3AF/1px`.
8. **Profile radar toggle dropped**: both team polygons overlay simultaneously (home blue, away purple, fills at 0.35 opacity). 50%-reference hexagon dropped in two-team mode. Home page single-team mode unchanged.
9. **Scoring Progression team colours aligned** to home-blue / away-purple convention. HT vertical + x-tick labels lightened.
10. **Momentum reconceived as zero-sum** (see 3d) — single signed net-curve, split-fill via clip paths. Massive conceptual jump from the earlier two-independent-curves approach.
11. **New hook** `mobile/src/hooks/use-match-momentum-timeline.ts` — signed per-minute samples with weighted event scoring (try 10, penalty/drop 6, try-assist / line-break 5, turnover-won 4, conversion 3, carry 1; tackles excluded as defensive).
12. **Insights pane reorder**: Profile → Momentum → Scoring Progression → Pitch Heatmap (Progression paired with Momentum on the temporal axis; Heatmap closes as spatial).
13. **All strokes normalised to 1px** across Profile / Momentum / Progression / Heatmap.
14. **Legend grammar unified** across all Insights charts (line-swatch style, light fill tokens).
15. **Cross-card consistency pass** — one visual grammar across the entire Insights tab.

Every arc committed and pushed. Latest commit: `db886c4` on `main`. Repo state clean before the current uncommitted batch (see §6).

---

## 6. Uncommitted state at handoff time

Modified files (not yet staged):
- `mobile/CLAUDE.md` — added Predictor Phase-6-stub bullet
- `mobile/src/app/(tabs)/_layout.tsx` — added Predictor tab, moved Teams after Fixtures
- `mobile/src/app/(tabs)/fixtures/_layout.tsx` — `unstable_settings.initialRouteName = 'index'`
- `mobile/src/app/(tabs)/fixtures/index.tsx` — closest-to-today landmark rule + `useFocusEffect`
- `mobile/src/components/insights/extended-momentum.tsx` — `Form (prev. 10)` copy
- `mobile/src/components/my-team-profile-card.tsx` — `Profile (prev. 10)` copy

New files (untracked):
- `docs/predictor-phase-spec.md`
- `mobile/src/app/(tabs)/predictor.tsx`

**All of this needs to be committed** before or after the model switch. Suggested commit message: `feat: Predictor tab stub + Fixtures landmark rewrite + IA polish`. Frank hasn't asked to commit yet — he was mid-flow when the model-switch idea came up.

---

## 7. What Frank was about to do next

He mentioned the **Teams tab** is next. The intent is the same treatment we just did for Insights charts:
- Match the established visual grammar (colours, legends, structural lines, section labels)
- Drop any toggles that overlaid two teams should replace
- Match the app-wide BI-restrained aesthetic

Look at `mobile/src/app/(tabs)/teams.tsx` for the current implementation. It renders 28 international teams grouped by Tier 1 / Tier 2, sorted alphabetically, each row tapping through to a team-detail route.

Frank hasn't specified what he wants changed on Teams yet. Approach: open the tab visually first via the sim, ask what he'd like to focus on, then iterate.

---

## 8. Files, hooks, and components map (fast reference)

**Insights charts:**
- `mobile/src/components/insights/insights-canvas.tsx` — Profile radar wrapper + legend chips
- `mobile/src/components/insights/radar-chart.tsx` — polygon SVG + colour tokens
- `mobile/src/components/insights/combined-points-pattern.tsx` — Momentum card (mirror area, clip-path split)
- `mobile/src/components/insights/scoring-progression.tsx` — dual step-worm
- `mobile/src/components/insights/pitch-heatmap.tsx` — dual density overlay
- `mobile/src/components/insights/extended-momentum.tsx` — season Form sparkline
- `mobile/src/components/insights/ranking-trajectory.tsx` — season ranking sparkline
- `mobile/src/components/insights/efficiency-kpis.tsx` — KPI bar strip

**Match analysis:**
- `mobile/src/components/match-analysis-card.tsx` — labeled prose sections
- `mobile/src/hooks/use-match-analysis.ts` — TEMPLATE for narrative gen (Phase 6 replaces with LLM)
- `mobile/src/hooks/use-match-momentum-timeline.ts` — signed net-momentum samples

**Home page stack:**
- `mobile/src/components/team-selector-card.tsx`
- `mobile/src/components/my-team-matches-card.tsx`
- `mobile/src/components/my-team-preview-cards.tsx`
- `mobile/src/components/my-team-profile-card.tsx`
- `mobile/src/components/form-circles.tsx`
- `mobile/src/hooks/use-my-team-id.ts` — singleton store pattern (each-hook-had-own-state bug fixed)

**Fixture drill:**
- `mobile/src/app/(tabs)/fixtures/[id].tsx` — one file, all panes inline (Preview, Line-Up, Overview/Timeline, Stats, Insights, Analysis)
- `mobile/src/app/(tabs)/fixtures/index.tsx` — day-grouped fixtures list
- `mobile/src/app/(tabs)/fixtures/_layout.tsx` — nested Stack with `initialRouteName = 'index'`

**Dev tools:**
- `mobile/src/dev/sim-live.tsx` — synthetic-live smoke test (rewinds completed matches, plays at 8× speed)
- `mobile/src/dev/sim-live-toggle.tsx` — dev-only toggle UI

**Theme + shared:**
- `mobile/src/constants/theme.ts` — Colors, Spacing (one=4, two=8, three=16, four=24), FlagSize, ScoreBoxSize, TextSize, TextWeight, TextTracking, StatusColor

---

## 9. Memory to load

Persistent memory files (`~/.claude/projects/-Users-frankmathews/memory/`):

- `user_git_account.md` — personal-identity separation rules
- `user_role.md` — Frank's role/context
- `project_rugby_app.md` — project location, repo, Expo native, sim install working
- `project_rugby_data_provider.md` — Opta assumed as Phase 6 feed
- `feedback_rugby_explainer_modals.md` — every BI metric gets an info-icon → modal
- `feedback_rugby_utility_icons.md` — utility icons bare, no chrome
- `feedback_rugby_momentum_arc.md` — **CRITICAL**: momentum is zero-sum, single signed net-curve
- `project_rugby_analysis_spec.md` — Analysis narrative Phase-6 deferred, `docs/analysis-narrative-spec.md` is the LLM's future prompt
- `project_rugby_predictor_spec.md` — Predictor Phase-6 deferred, `docs/predictor-phase-spec.md` is the ML brief

`MEMORY.md` index at the memory root indexes all of the above.

---

## 10. How Frank likes to work

- **Terse and direct.** Doesn't want long explanations, wants the decision + the implementation.
- **Show honest opinions.** When asked "what would you do?" he wants a real recommendation with tradeoffs, not a hedged menu.
- **BI-restrained aesthetic.** Flat off-white, hairlines, no gradients, minimal chrome. When in doubt, less colour rather than more.
- **Iterates in tight loops.** He'll ask for something, see it in the sim, tell you what he doesn't like. Don't over-engineer the first pass.
- **Doesn't want backwards-compatibility hacks.** If you rename a variable, rename it everywhere. If you delete a code path, actually delete it. No `_unused` markers.
- **No comments explaining WHAT.** Comments only for WHY when non-obvious. Named identifiers do the WHAT.
- **Commits use HEREDOC.** Personal identity only. No `Co-Authored-By` trailer.

Reference the "How to save memories" pattern from the auto-memory system in root `CLAUDE.md` for how to grow the memory index.

---

## 11. If in doubt

- **On style / grammar / colours** — check §3 of this doc + `feedback_rugby_momentum_arc` memory + look at existing Insights charts.
- **On architecture** — check `docs/analysis-narrative-spec.md` and `docs/predictor-phase-spec.md` for the server-side + no-key-on-client patterns.
- **On what's next** — §7 above + ask Frank if the priority isn't obvious.
- **On identity / commits** — root `CLAUDE.md` §1 is the source of truth. Never commit under a work identity.

Good luck.
