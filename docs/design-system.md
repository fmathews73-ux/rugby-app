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

Two families — neutral text tokens and semantic status tokens. Both are exported from `mobile/src/constants/theme.ts`. Callers must reference the token; raw hex text-colour values are drift.

### 5.1 Text tokens (neutral)

For anything neutral (titles, meta, body, badges), pick one of these:

| Token | Value (light) | Role |
|---|---|---|
| `Colors.light.text` | `#000000` | Primary — titles, scores, body |
| `Colors.light.textSecondary` | `#60646C` | Secondary — labels, meta lines, muted body, caption. Also the intentional "muted dark grey" used by the home carousel dots. |
| `Colors.light.textInverse` | `#FFFFFF` | Text on dark backgrounds — score-box winner numbers, form W/L/D badge glyphs, destructive-button labels |

Dark-mode counterparts live in `Colors.dark.*` — same semantic names, appropriate light values.

**Anchor:** two neutral text tiers matches Apple HIG (`label` / `secondaryLabel` / `tertiaryLabel`) — we compress to two because a data app rarely needs three levels of muted body text. Add `textTertiary` only when a real use-case appears; do not preemptively.

### 5.2 Status tokens (semantic)

For anything that carries meaning — live / destructive / warning / premium — pick one of these. Never a raw hex:

| Token | Value | Role |
|---|---|---|
| `StatusColor.live` | `#DC2626` | LIVE match indicator, destructive actions (Clear, Delete), movement-down glyph (`▼`) |
| `StatusColor.warning` | `#F59E0B` | HALF-TIME indicator, upcoming-warning states |
| `StatusColor.premium` | `#B45309` | Premium-tier badge, ErrorState heading. Same amber family as `warning`, one stop darker for higher weight |

Anything that doesn't fit these three isn't a status colour — it's a neutral or an ad-hoc override. The former uses the neutral tokens above; the latter is a code smell.

### 5.3 What NOT to add

- No `accent` or `brand` colour yet — brand identity is register #23 (open). When it lands, the accent becomes a first-class token and any legacy `#4F46E5` / `#007AFF` usage collapses to it.
- No `success` green until there's a real use — the movement-up `▲` in the rankings is currently `#059669` inline; not yet worth promoting to a token with only one usage.
- No hard-coded whites for backgrounds — those are structural (`#FFFFFF` card fills, `#F5F5F7` page bg) and not text colours. Keep them raw for now; consolidate when we tackle §4 Elevation / cards.

### 5.4 Comparative visualisations (home vs. away)

When a visualisation compares a home value to an away value — the stat bars on the fixture Stats pane are the reference implementation — the two sides use the two neutral text tokens:

- **Home segment** → `Colors.light.text` (black) — sits on the left of the centre spine, growing outward.
- **Away segment** → `Colors.light.textSecondary` (dark grey) — sits on the right, growing outward.

Distinction lives in position (left / right of centre) and tone (primary / secondary), not in accent colour. Do not introduce team-specific accent colours before register #23 (brand identity) resolves — anything else is a preview brand decision made outside the register-tag protocol.

### 5.5 Applied convention

```typescript
// Good — neutral text
sectionLabel: {
  color: Colors.light.textSecondary,
},
title: {
  color: Colors.light.text,
},
scoreWinnerText: {
  color: Colors.light.textInverse,
},

// Good — semantic status
liveIndicator: {
  color: StatusColor.live,
},

// Bad — raw hex
liveIndicator: {
  color: '#DC2626', // ← should be StatusColor.live
},
```

---

## 6. Score boxes

Small dark-and-light score tiles used to display paired scores and hero stats. Exported from `mobile/src/constants/theme.ts` as `ScoreBoxSize`. **Only two sizes.**

| Token | Dimensions | Radius | Role | Where it appears |
|---|---|---|---|---|
| `ScoreBoxSize.row` | 30 × 24 pt | 4 pt | List / table row cell | Fixtures list score cells, My Team Last Match scores, World Rugby Rankings points tile |
| `ScoreBoxSize.card` | 52 × 44 pt | 8 pt | Hero / card-scale | Home fixture carousel scores, Fixture detail header scores |

**Aspect ratios:** `row` is 1.25:1 (near-square), `card` is 1.18:1 (near-square). Both intentionally close-to-square so the "score tile" visual language is consistent — the difference is scale, not shape.

**Fill / text pairing:**
- Winner box: `Colors.light.text` fill (black) + `Colors.light.textInverse` (white) text.
- Loser / neutral box: `#F3F4F6` fill (light-grey) + `Colors.light.text` (black) text.
- Text weight: `TextWeight.bold`, `fontVariant: ['tabular-nums']` always.
- Text size: `TextSize.md` for `row`, `TextSize.xl` for `card`.

**Usage — spread the token so all three dimensions stay locked:**

```typescript
// Good — spread the token, so width / height / radius change together
// if the token ever gets tuned. Nothing else in the style can drift.
scoreBoxSmall: {
  ...ScoreBoxSize.row,
  backgroundColor: '#F3F4F6',
  alignItems: 'center',
  justifyContent: 'center',
},

// Bad — hand-coded dimensions that will drift away from the scale
scoreBoxSmall: {
  width: 30, height: 24, borderRadius: 4, // ← should be ScoreBoxSize.row
  ...
},
```

**Do not add a third size.** If a call site "needs" 40×24 for a row (or 60×56 for a hero), the design brief is wrong, not the scale. Grow the text or space, not the tile.

### Match-state annotations (FT / KO / LIVE / HT)

The little label between the two score boxes ("FT" for completed, "LIVE" or a minute-count for live, "HT" for half-time, kickoff time for scheduled) has two canonical treatments, mirroring the score-box scale:

| Context | FT-annotation spec |
|---|---|
| Row (with `ScoreBoxSize.row`) | `TextSize.xs` (10pt), `TextWeight.bold`, `TextTracking.wide`, `Colors.light.textSecondary` |
| Card (with `ScoreBoxSize.card`) | `TextSize.sm` (12pt), `TextWeight.bold`, `TextTracking.wide`, `Colors.light.textSecondary` |

Both intentionally muted and small — the annotation is *informational*, not decorative. It should never compete visually with the scores it sits between.

**Live / HT variants** carry the same size/weight but swap the colour token: `StatusColor.live` for a red live indicator, `StatusColor.warning` for HT amber. **KO / kickoff-time variants** use the same font size but `Colors.light.text` (primary) + `fontVariant: ['tabular-nums']` — treated as data, not annotation.

---

## 7. Utility icons

Small tap-target icons that annotate or reset a section — the info-icon that opens an explainer modal, the reset icon that clears a filter state, and any peer affordance that fits the same role. Every icon in this class is an **Ionicons outline** glyph rendered at a single canonical size and colour so multiple utility icons on one screen read as siblings, not as a stack of different weights.

**Canonical spec — do not deviate:**

| Attribute | Value |
|---|---|
| Icon family | `@expo/vector-icons` → `Ionicons` |
| Variant | `-outline` (never solid — utility icons stay quiet) |
| Size | `14` pt |
| Colour | `Colors.light.textSecondary` |
| Tap target | `Pressable` with `hitSlop={10}` |
| Chrome | None (no background, border, or shadow) |
| Placement | Inline next to the label they annotate, OR absolute-positioned inside the top-right corner of the component (~6pt inset) |

**Canonical roster (extend by adding to this table, not by inventing sizes):**

| Icon | Role |
|---|---|
| `information-circle-outline` | Open explainer modal for the surface the icon sits next to |
| `refresh-circle-outline` | Reset the surface to its default state (clear a compare team, undo a filter). **Use the `-circle-outline` sibling, not `refresh-outline`**, so the glyph's intrinsic circle matches the info icon's visual weight when the two sit on the same surface |
| `close` | Dismiss a modal — used only inside modal headers, still 14pt / textSecondary |
| `chevron-down` | Dropdown affordance next to a tappable value (e.g. team selector chip) |

**Glyph-shape consistency:** when two utility icons appear on the same surface, prefer the `-circle-outline` sibling on both sides so their intrinsic circles match. Mixing a circled glyph (`information-circle-outline`) with an uncircled sibling (`refresh-outline`) makes the uncircled one look noticeably lighter — visual weight goes with the glyph, not the CSS, so match at the glyph level.

**Usage:**

```tsx
// Good — canonical utility icon.
<Pressable
  onPress={() => setInfoOpen(true)}
  hitSlop={10}
  accessibilityRole="button"
  accessibilityLabel="Explain form metrics">
  <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
</Pressable>

// Bad — off-token size or a solid variant.
<Ionicons name="information-circle" size={16} color="#666" /> // ← wrong variant, size, colour
```

**Do not add a second size.** If a call site "needs" 12pt or 18pt, the layout is wrong, not the token. Icons at 14pt already read as small; anything smaller crosses into "invisible affordance" territory.

**Do not add a background, border, or fill** to make the icon "pop". Utility icons are quiet by design — this holds even for corner-mounted variants (a lone reset icon in the top-right of a card is still just the icon, not a bordered chip). If a call site needs an emphasised action affordance, that's a *button*, not a utility icon, and should use the primary button pattern instead.
