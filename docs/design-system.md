# Design System

Living reference for the rugby app's UI tokens. This document is the single source of truth: if a component uses a value that isn't listed here, either the component is wrong or this doc is out of date. Fix one, don't let them drift.

**Scope note.** Brand identity (name, logo, primary palette, custom typography) is still open per PRD register #23. Everything below is derived from mobile-UI best practice + Apple HIG + Material Design norms, not brand. When brand lands, hero-level tokens (accent colour, wordmark font) get added, but this scale — spacing, sizing, type ramp — should stay stable.

---

## 1. Principles

- **8pt rhythm.** Every token in this doc is a multiple of 4 or 8, matching Apple HIG and Material's base grid. Predictable arithmetic makes composition easier and prevents "off by 2pt" drift.
- **Non-linear scale.** Sizes progress geometrically (~1.4×–1.7× per step), not linearly. Two tokens that differ by 2pt (e.g. 22 vs 24) are indistinguishable to users but double the surface area of the system — pick one.
- **3–5 steps per token family.** Human hierarchy perception saturates around 5 levels. More than that and hierarchy blurs.
- **Typed enforcement over documentation.** Where possible, the type system rejects out-of-scale values at compile time. Docs are for humans; types are for CI.
- **Paired visual elements share a horizontal centreline.** Whenever a flag sits next to a score (or any two logically-paired visual objects), their vertical centres must align on the same horizontal axis. Never nest labels inside the same flex column as the flag — labels stretch the column vertically and drag the flag centre off the score's centre. Instead: put the paired objects (flag + score + flag, etc.) in one row where every item is the same declared height, then put the labels in a *second row* below, with an invisible spacer where the score sat. See `MatchupHeader` in `fixture/[id].tsx` for the reference implementation.
- **Group elements with gap ratios, not equal spacing.** When a row contains logically distinct groups (e.g. flag / score-cluster / flag), the gap between groups should be **significantly larger** than gaps inside each group — roughly 5–10× larger. Equal spacing collapses the visual hierarchy into a single flat run of five items; a big outer gap says "these three things are separate groups, not five equal items." Concrete reference: `fixture-carousel-card.tsx` uses `gap: 6` inside the score cluster (score / FT / score) and `gap: 60` between the outer flags and that cluster. The 60 is a per-context aesthetic decision, not a scale token — it's the value that felt right after side-by-side comparison, and the ratio (10×) is the reusable idea, not the exact pt value.

---

## 2. Flag / avatar sizes

Circle-clipped country flags rendered by `TeamFlagBall2D`. Four steps only, all multiples of 8. Constants live in `mobile/src/constants/theme.ts` as `FlagSize`; the component's `size` prop is typed to `FlagSizeValue`, so raw numbers won't compile.

| Token | Value | Role | Where it appears |
|---|---|---|---|
| `FlagSize.hero` | 96 pt | Hero avatar | Team detail page top block |
| `FlagSize.header` | 56 pt | Section / fixture header pair | Fixture detail header (home + away) |
| `FlagSize.medium` | 40 pt | Card-scale identifier | Home fixture carousel cards, Teams tab list rows, Fixture detail line-up |
| `FlagSize.row` | 24 pt | Table / list row badge | Standings, Fixtures list, Rankings tab, home mini-rankings, Team detail recent form |

**Ratios:** 24 → 40 (1.67×) → 56 (1.4×) → 96 (1.71×). Every step is visibly larger than the previous without needing side-by-side comparison.

**Anchor to industry:** matches Material Design's canonical avatar scale (24 / 40 / 56 / 96) exactly. This isn't a coincidence — Material derived it from the same reasoning (8pt grid + geometric progression + capped step count) and there's no reason to invent our own numbers.

**Adding a new size:** don't. If a call site "needs" 48pt, that means either (a) the design brief is wrong, or (b) the token family needs re-thinking as a whole. Adding an ad-hoc value reintroduces the drift we just removed.

---

## 3. Typography

Type ramp for every text style in the app. Constants live in `mobile/src/constants/theme.ts` as `TextSize`, `TextWeight`, `TextTracking`. Callers should pull `fontSize` / `fontWeight` / `letterSpacing` from these constants; raw numbers create drift.

### Size scale — 5 steps, Tailwind-style numeric names

| Token | Value | Role |
|---|---|---|
| `TextSize.xs` | 10 pt | Uppercase micro labels (DEV banner, table headers, pill labels) |
| `TextSize.sm` | 12 pt | Caption, meta text, secondary info |
| `TextSize.md` | 14 pt | Body default, list rows, table cells |
| `TextSize.lg` | 16 pt | Subtitles, section headers, team-name row labels |
| `TextSize.xl` | 22 pt | Screen and card titles, hero display (scores, hero team names) |

**Ratios:** 10 → 12 (1.2×) → 14 (1.17×) → 16 (1.14×) → 22 (1.375×). The bottom of the ramp is dense on purpose — micro labels, meta, and body all live within 4pt of each other because at small sizes 1–2pt differences DO read (unlike at hero sizes). The jump from `lg` to `xl` (16 → 22) is deliberately larger to keep titles clearly bigger than section headers.

**Anchor to industry:** shorter than Tailwind's default ramp (which uses `2xl` / `3xl` / etc. up to 60+ pt) because a data app rarely needs display type above 22 pt. Scores and hero team names ride at `xl` with `tabular-nums` (see below) instead of a bigger dedicated display step.

### Weights — 3 tokens

| Token | Value | Purpose |
|---|---|---|
| `TextWeight.regular` | `'400'` | Body default |
| `TextWeight.semibold` | `'600'` | Subtitles, small emphasis, meta |
| `TextWeight.bold` | `'700'` | Titles, scores, headlines |

Weights `500` and `800` are deliberately excluded. `500` is indistinguishable from `400`/`600` at small sizes and `800` is a shout — reserve emphasis for `bold`.

### Letter spacing — 2 tokens

| Token | Value | Purpose |
|---|---|---|
| `TextTracking.normal` | `0` | Default everywhere |
| `TextTracking.wide` | `1.0` | Uppercase micro labels only (dev banner, table headers, pill labels) |

Any value between `0` and `1.0` is indistinguishable — collapse to the two above.

**Exception:** `letterSpacing: -1` is allowed on hero-size numbers (e.g. `fixture-carousel-card.tsx`'s `.score`) as intentional tight kerning for large display digits. It is *not* a scale token — it's a per-element override for one visual role.

### Font family

- **Default:** system UI (`Fonts.sans` → San Francisco on iOS, Roboto on Android). Set once at the root, not per-style.
- **Numbers (scores, points, table stats):** every text style that renders numeric data MUST include `fontVariant: ['tabular-nums']`. This keeps digits at monospaced widths inside a proportional font — "29 · 21" and "18 · 31" render at the same width, avoiding jitter on live updates and misaligned table columns. This is the FIFA / Sky Sports pattern.
- **Monospace (`Fonts.mono`):** currently unused in production screens. If needed, reserve for full-monospaced text (code blocks, terminal-style displays) — not for score digits, which use tabular-nums.

### Applied convention

Every StyleSheet in the app should look like:

```typescript
title: {
  fontSize: TextSize.xl,
  fontWeight: TextWeight.bold,
  color: Colors.light.text,
},
score: {
  fontSize: TextSize.xl,
  fontWeight: TextWeight.bold,
  fontVariant: ['tabular-nums'], // tabular MUST appear on any number display
},
tableHeader: {
  fontSize: TextSize.xs,
  fontWeight: TextWeight.semibold,
  letterSpacing: TextTracking.wide,
  textTransform: 'uppercase',
},
```

If a proposed style doesn't fit one of the 5 sizes × 3 weights combinations, the style is wrong — not the scale.

---

## 4. Spacing

*To be documented. `Spacing` constant already exists in `mobile/src/constants/theme.ts` (`half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64`). Needs a pass to confirm usage is consistent and named steps are still sensible.*

---

## 5. Colour

*To be documented. Neutral placeholder palette in `Colors` (`mobile/src/constants/theme.ts`) is fine for pre-brand development. Real palette lands with PRD register #23.*

---

## 6. Elevation / shadows

*To be documented. Currently ad-hoc `shadowOffset` / `shadowRadius` per card — should collapse to 2-3 named tiers (e.g. `hairline`, `card`, `modal`).*
