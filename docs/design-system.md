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

## 2. Flag shield sizes

Nation flags render as **shields** via `TeamFlagShield` — the exact silhouette extracted from the owner-licensed reference vector (see PRD register #32), flag imagery clipped to the inner boundary. The `width` prop scales the whole artwork. Constants live in `mobile/src/constants/theme.ts` as `FlagSize`.

**Two working sizes (owner decision 2026-07-07):**

| Token | Value | Role | Where it appears |
|---|---|---|---|
| `FlagSize.medium` | 40 pt | **Identity** — "this is the subject" | Drill heroes (team hub, fixture matchup header), hero rows (Home My Team, Teams directory, picker), Home fixture carousel cards |
| `FlagSize.row` | 24 pt | **Annotation** — identifies a row or corner | Standings, Fixtures list rows, Rankings tables, mini-carousels, Next/Last Match lines |

`FlagSize.xs` (16 pt, insight chart-card corner flags) still exists in code but is scheduled for consolidation into `row` — at 16pt the shield silhouette doesn't read. Do not add new `xs` call sites.

**Adding a new size:** don't. If a call site "needs" 48pt, that means either (a) the design brief is wrong, or (b) the token family needs re-thinking as a whole. Two roles — identity vs. annotation — is the entire system.

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
- **Sport-display face:** `BarlowCondensed_700Bold_Italic` (`@expo-google-fonts/barlow-condensed`, SIL OFL — app-embedding safe; loaded at runtime in `src/app/_layout.tsx`, splash-gated so no fallback flash). This is the "broadcast bug" voice: nation codes, match scores, kickoff times, FT/HT annotations, **and all card/section titles** (see §8). The file carries the weight — **never add `fontWeight` beside it** (RN would fake-bold the face).
- **Supporting family: Work Sans** (owner call 2026-07-13 — replaced Barlow app-wide; rounder and wider, giving the condensed display face air instead of echoing its compression). `WorkSans_500Medium` is the meta/label voice — meta lines, pill labels, chart annotations, unit suffixes (`CM` / `KG` / `W` / `L` / `%`); `WorkSans_600SemiBold` is reserved for **action pills/buttons only**; `WorkSans_400Regular` for long-form prose (legal pages). Colour separates registers, not weight: the same condensed face is identity in black and titles/values in grey (§8).
- **Numbers in the system font (points, table stats):** every *system-font* style that renders numeric data MUST include `fontVariant: ['tabular-nums']` — "29 · 21" and "18 · 31" render at the same width. Barlow Condensed styles drop `tabular-nums` (not guaranteed by the font); they only ever render centred single values inside fixed tiles, where digit alignment is moot.
- **Monospace (`Fonts.mono`):** currently unused in production screens. If needed, reserve for full-monospaced text (code blocks, terminal-style displays) — not for score digits.

### The matchup strip (broadcast-bug grammar)

Every surface that renders `shield · CODE · score/time · CODE · shield` follows one typographic system, tiered by shield size:

| Element | With `FlagSize.medium` (40pt) | With `FlagSize.row` (24pt) | Colour |
|---|---|---|---|
| Nation code | Barlow `TextSize.xl` (22) | Barlow `TextSize.lg` (16) | `Colors.light.text` (black — identity) |
| Kickoff time | Barlow `TextSize.xl` | Barlow `TextSize.lg` | `Colors.light.textSecondary` |
| Score digits | Barlow `TextSize.xl` | Barlow `TextSize.lg` | winner `textInverse`, loser `textSecondary` |
| FT annotation | Barlow `TextSize.md` (14) | Barlow `TextSize.sm` (12) | `Colors.light.textSecondary` |

The rule in one line: **code = same size, black; time/score = same size, grey register; FT = two steps down, grey.** Colour alone separates identity from data — the whole strip shares the face.

Nation codes only: surfaces that render *full team names* next to a shield (Rankings, home rankings mini-carousel) stay in the system font — the display face is for codes and numerals, not sentences.

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

### 5.1a The three registers (owner decision 2026-07-07)

Every interactive/identity element sits in exactly one of three registers:

| Register | Colour | What lives here |
|---|---|---|
| **Identity** | `Colors.light.text` (black) | Nation codes, winning-score treatment, titles, the *active* footer tab |
| **Functional** | `Colors.light.textSecondary` | Header back glyph, meta text, kickoff times, losing scores, FT labels, *selected* pill fills (white label on top) |
| **Chrome** | `#C7CBD1` | Pure pressability affordances: `chevron-forward` disclosure cues (16pt), Team-Selector list icon, **inactive footer tabs and the header avatar** (moved from functional grey 2026-07-13 — quiet-but-tappable chrome unifies on one shade; the wordmark owns the header) |

The disclosure chevron spec: `Ionicons chevron-forward, size 16, #C7CBD1`, pinned to the right edge of every navigational row (team rows, player rows, fixture rows, Next/Last Match cards) and vertically centred **on the shield/matchup line**, not on the whole row — absolute-positioned in the row's right gutter so centred clusters keep their symmetry.

### 5.1b The cool grey family (owner-settled 2026-07-14)

Every non-chrome grey surface derives from ONE hue — `#E9EDF2`, a cool blue-cast grey — at fixed strengths. Warm/neutral greys (`#FAFAFA`, `#F3F4F6`, `#F0F0F3`, `#E5E7EB`) are RETIRED from fills and keylines; only chrome `#C7CBD1` sits outside the family (it's structure, not surface).

| Strength | Hex | What lives here |
|---|---|---|
| 50% over white | `#F4F6F9` | Page ground (`page-gradient.tsx`), scroll-edge fades, DEV banner strip, picker-modal ground — all four sites must move in lockstep |
| ~70% | `#EFF2F6` | Chart bar tracks, SVG grid strokes, quiet chart badges — one register lighter than value boxes so box and track never merge |
| Full | `#E9EDF2` | Quiet/loser score boxes, unselected pills, team-toggle idle sides, pressed-state feedback, the D-tile keyline |
| Keyline | `#E3E8EF` | Card borders + hairlines that used to be `#E5E7EB` |

White cards + this family + chrome + the two text tokens is the complete neutral system. If a new grey is needed, derive it from `#E9EDF2` — don't introduce a new hue.

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
- The semantic leader/winner green is **`#5CB04E`** app-wide since 2026-07-14 — the wordmark's light-zone green, replacing the old `#059669`, so every leading bar, W dot, up-arrow and subject dot matches the brand lockup. The lagger red stays `#DC2626`.
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
| `ScoreBoxSize.row` | 26 × 22 pt | 4 pt | List / table row cell | Fixtures list score cells, My Team Last Match scores |
| `ScoreBoxSize.card` | 40 × 34 pt | 8 pt | Hero / card-scale | Home fixture carousel scores, Fixture detail header scores |

Dimensions are tuned to the Barlow Condensed digits — tiles hug the numerals broadcast-bug style rather than floating them in air (re-tuned 2026-07-07 when the display face landed; condensed digits are ~30% narrower than system digits).

**Fill / text pairing:**
- Winner box: `Colors.light.textSecondary` fill + `Colors.light.textInverse` (white) text.
- Loser / neutral box: `#E9EDF2` fill (the full-strength cool grey — also the fill for unselected pills, team toggles and pressed states) + `Colors.light.textSecondary` text. Chart bar *tracks* sit one register lighter at `#EFF2F6` — cool-cast, but never matching the boxes, so box and track stay distinct shapes.
- **Winner verdicts compare the ROUNDED display values** (owner rule 2026-07-14): if both sides show the same whole number, that's a tie — both boxes quiet. No dark box on a difference the user can't see. This applies to every paired bar row — fixture Stats, predictor drill, team-vs-tier-average, player-vs-peer-average — and **the average side takes the dark box when it's the better side**; the dark fill is not reserved for the subject.
- **W/D/L record tiles are NOT the match pairing** (owner correction 2026-07-10): the dark fill sits **permanently on the W box** — wins are the identity number — with L always quiet, regardless of which count is higher. The **D box is white with a 1pt `#E9EDF2` cool-grey keyline** (moved off chrome 2026-07-14) — its own state between the dark W and quiet L. Applies to the teams-directory rows, standings rows and the team hero. Unit letters (`W`/`D`/`L`, `CM`/`KG`) render *inside* the tile as a 7–8pt `WorkSans_500Medium_Italic` suffix (italic since 2026-07-14 — units lean with the digits, see §6.1).
- Face: `BarlowCondensed_700Bold_Italic` (no `fontWeight`, no `tabular-nums` — see §3).
- Text size: `TextSize.lg` for `row`, `TextSize.xl` for `card` — same size as the neighbouring nation codes.

**Not match scores, not this token:** the rankings points tile ("93.9") self-sizes on `paddingHorizontal` with the token's height/radius only — the fixed widths are now digit-hugging and too narrow for rating values.

**Usage — spread the token so all three dimensions stay locked:**

```typescript
// Good — spread the token, so width / height / radius change together
// if the token ever gets tuned. Nothing else in the style can drift.
scoreBoxSmall: {
  ...ScoreBoxSize.row,
  backgroundColor: '#E9EDF2',
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

### 6.1 The score-bug treatment (skew + positional wing cuts) — owner-locked 2026-07-14

Every score/value box in the app carries the broadcast score-bug treatment, exported from `theme.ts` as the `ScoreBug` token:

- **Skew.** The box leans `skewX: '-8deg'` — the same axis as the Barlow Condensed italic digits, so tile and numerals lean together. The box *content* (the inner text/stack) counter-skews `+8deg` (`ScoreBug.counterSkew`) so glyphs render on their own natural italic axis, not double-slanted.
- **Wing cuts are PANE-POSITIONAL, never winner-relative.** A box's cut is decided by where it sits on the pane, regardless of which side is winning or losing:
  - Left-edge boxes → `ScoreBug.cutLeft` (`borderTopLeftRadius: 0`, `borderBottomRightRadius: 0`)
  - Right-edge boxes → `ScoreBug.cutRight` (`borderTopRightRadius: 0`, `borderBottomLeftRadius: 0`)
  - **Three-box rows (W/D/L trios):** outer boxes take their positional cuts; the **centre box stays fully rounded** — no cuts.

  Owner's phrasing: *"this styles as a pane not as box to box / score to score relative."* A losing left-edge box still cuts left; a winning right-edge box still cuts right.
- **Apply via style arrays** so cut and skew stay token-driven: `[styles.box, ScoreBug.cutLeft, winner && styles.win]`. Never hand-code the radii or the transform.
- **Clipping gotcha:** a wrapper with `overflow: 'hidden'` + `borderRadius` will round the sharp cuts back off (this bit the stats-pane premium blur). Rounding belongs on overlay layers, never on a wrap that contains score boxes.
- **Unit suffixes lean too.** Units/symbols rendered inside a score box (`CM`/`KG` stacks, `PTS`, `%`, per-game suffixes) use `WorkSans_500Medium_Italic` — the true italic cut of the supporting face, never a fake skew — so they lean with the condensed digits.

### 6.2 No decimals — ever (owner law 2026-07-14)

**"No decimal place values anywhere in any cards ever."** Every value a card displays is a whole number: `String(Math.round(v))` in display formatters, integer fields from the API where the contract allows. This covers score boxes, readout tiles, chart badges, narrative prose, and driver values alike. The only exemption is **SVG path geometry** (`toFixed` inside path/coordinate math — smooth paths, radar vertices, progression curves), which is drawing precision, not displayed data.

### Match-state annotations (FT / KO / LIVE / HT)

The little label between the two score boxes ("FT" for completed, "LIVE" or a minute-count for live, "HT" for half-time, kickoff time for scheduled) has two canonical treatments, mirroring the score-box scale:

| Context | FT-annotation spec |
|---|---|
| Row (with `ScoreBoxSize.row`) | `TextSize.sm` (12pt), Barlow face, `TextTracking.wide`, `Colors.light.textSecondary` |
| Card (with `ScoreBoxSize.card`) | `TextSize.md` (14pt), Barlow face, `TextTracking.wide`, `Colors.light.textSecondary` |

Roughly 60–65% of the neighbouring code size — muted, but legible in the condensed face (10pt condensed turns to lint). The annotation is *informational*, not decorative; it should never compete visually with the scores it sits between.

**Live / HT variants** carry the same size but swap the colour token: `StatusColor.live` for a red live indicator, `StatusColor.warning` for HT amber. **KO / kickoff-time variants** are Barlow at the *code* size of their tier (see §3 matchup strip), `Colors.light.textSecondary` — the clock is data-in-waiting, one register below the codes.

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

---

## 8. Section titles & date grammar

**One title register app-wide** (owner-settled 2026-07-08, extended to date headers 2026-07-10): `BarlowCondensed_700Bold_Italic`, `TextSize.md` (14pt), `TextTracking.wide`, `textTransform: 'uppercase'`, `Colors.light.textSecondary`. This covers card titles (one-word names: Profile · Form · Momentum …), squad unit headers (FRONT ROW), directory group headers (TIER 1 NATIONS), **and the fixtures-list date headers** (SAT · 11 JUL 2026). Grey condensed caps say "wayfinding"; the same face in black says "identity". Never set titles in `WorkSans_500Medium` or system bold — metrics grab attention, not titles.

**Date grammar:**
- Upcoming fixtures: plain date + ` · Upcoming` — **no** "Today"/"Tomorrow" relative labels.
- Kickoff clocks are always device-local via `formatKickoffTime` — never `slice(11,16)` on the UTC string.
- Scheduled rows show the kickoff time in the score slot (clock = data-in-waiting, one register below the codes).

**Pill rule:** filter pills 12pt / action pills 14pt, both `WorkSans_500Medium` (action pills may use `WorkSans_600SemiBold`); the *selected* pill fills `Colors.light.textSecondary` with a white label — selection is a functional-register state, never black.

---

## 9. Row geometry (the list-row law)

**One list-row anatomy app-wide**, cloned from the fixtures list (owner-locked 2026-07-10). Reference implementation: `fixtures/index.tsx` rows; clones: `team-hero-row.tsx` (Teams directory / picker / Home selector) and the squad `PlayerRow` in `teams/[id].tsx`.

- **Two bands, gap 8** (`Spacing.two`; widened from 4 on 2026-07-13 with the Work Sans move — the rounder secondary earns more air): the matchup line, then a centred meta line in the `metaText` register (`WorkSans_500Medium`, `TextSize.sm`, `textSecondary`).
- **Row padding:** `paddingVertical: Spacing.three` (16pt). Rows are separated **only** by the chrome-grey inset hairline (`#C7CBD1`, `StyleSheet.hairlineWidth`, `marginHorizontal: Spacing.three`) rendered *between* rows — never after the last row, and never a full-width whisper-grey borderBottom. Cards must NOT add a child `gap` around rows (it stacks with the rows' own padding).
- **Anchors:** 24pt shields (`FlagSize.row`) in fixed 24pt wraps; codes in the display face at `TextSize.lg` inside fixed width-40 centred slots.
- **Middle column:** fixed-width, centred, `ScoreBoxSize.row` boxes (fixtures: 96pt / two boxes; teams W-D-L trio: 112pt, gap 4).
- **Chevron lane:** disclosure chevron absolute-positioned in the right gutter (right −4 with an 18pt reserved lane, or −8 riding into row padding), vertically centred on the matchup line.
- **Variable-width content centres absolutely:** when wing content varies per row (player names), the centred cluster must be absolute-positioned over the row (`left/right/top/bottom: 0`), NOT flexed — flexed middles drift with wing width.
- **Squad rows:** caps-jersey + two-line nameplate flush left, code + shield flush right, CM/KG pair absolute-centred, `Position · Age` meta beneath, symmetric 12pt wing inset. Name size follows the **proportion law**: hero name (md 14) ÷ hero code (xl 22) ≈ 0.64 → row names = row code (lg 16) × 0.64 ≈ `TextSize.xs`.

---

## 10. Hero family (the three-band anatomy)

Every drill hero clones the match hero's stack (owner-locked 2026-07-10):

1. **Date-slot meta line** (rank line / `position · age` / competition date).
2. **Anchor row** — `marginVertical: Spacing.three`, header band gap `Spacing.two`, ALL elements on ONE vertical centre.
3. **Venue-slot meta line** (venue / season workload `N starts · N from bench · N mins` / `Head Coach · Name`).

- **Team hero:** rank line / shield+code · `[W dark][D quiet][L quiet]` prev-10 tiles · cap total in the code register + glyph-only jersey / head-coach line.
- **Player heroes** (Teams card and fixture drill are IDENTICAL by rule): `position · age` / caps-jersey + two-line nameplate · CM & KG in `ScoreBoxSize.card` tiles (units inside) · code + shield / season-workload line.
- **Jersey-beside-shield sizing law:** a jersey glyph next to a `TeamFlagShield` renders at the shield's **rendered height** = shield width ÷ 0.9045 (the shield's W/H aspect). Hero: `FlagSize.medium / 0.9045`; rows: `FlagSize.row / 0.9045`. Apply everywhere, unprompted.
- **Squad-glyph identity:** player identity is the `CapsJerseyBadge` (squad-colour shirt, cap count as the shirt number; `hideNumber` for the glyph-only team-hero/row variant — 26pt jerseys can't hold 4-digit caps, the value sits beside the glyph in the code register instead). The anonymous person avatar is retired on player surfaces.
- **minHeight is a FLOOR, not a lock:** shared hero/card minHeights (`DRILL_HERO_MIN_HEIGHT`, `PAGE_CARD_MIN_HEIGHT` in `theme.ts`) must exceed the tallest intrinsic content of every surface that shares them, or the "shared" height silently varies.
