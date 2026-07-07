/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    // Text on dark backgrounds — score-box winner numbers, form W/L/D badges,
    // dark-mode style pills.
    textInverse: '#FFFFFF',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    textInverse: '#000000',
  },
} as const;

/**
 * Semantic status colours. Use `StatusColor.<name>` (never a raw hex) for
 * anything that carries meaning — live matches, warnings, premium hints.
 * Documented in `docs/design-system.md` §5.
 */
export const StatusColor = {
  /** Live matches, destructive actions (Clear reset, remove). */
  live: '#DC2626',
  /** Half-time indicator, upcoming-warning states. */
  warning: '#F59E0B',
  /** Premium-tier badges, ErrorState messaging. Same amber family as
   *  `warning` but a deeper stop for higher visual weight. */
  premium: '#B45309',
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/**
 * Canonical pill-strip grammar — shared by CompetitionPicker (scrollable
 * filter strips on Fixtures / Standings / Teams) and SegmentedTabs
 * (equal-width sub-tabs on the fixture / team / player drills). Both
 * components MUST read these tokens rather than local numbers so every
 * pill strip in the app carries identical padding, dims, and type.
 */
/**
 * Shared drill-hero height — the pinned white identity block above the
 * sub-tab pills on the fixture, team, and player drills. Sized to the
 * fixture matchup hero's natural content (date line + 56pt flag/score
 * row + meta line, 16pt padding each end); the team / player heroes
 * centre their shorter content inside the same height so all three
 * drills measure identically from header to pill strip.
 */
/** Bottom inset under the last card of every scrolling page — clears
 *  the footer tab bar with consistent air app-wide. */
export const PAGE_BOTTOM_INSET = 60;

export const DRILL_HERO_MIN_HEIGHT = 140;

export const PillStrip = {
  /** Pill label: 12pt bold, wide tracking. */
  labelSize: 12,
  labelTracking: 0.4,
  /** Pill body. */
  padV: 6,
  padH: 12,
  radius: 999,
  /** Strip chrome. */
  stripPadV: Spacing.two + 2,
  stripPadH: Spacing.four,
  gap: Spacing.two,
} as const;

/**
 * Canonical widths for `TeamFlagShield`. Three steps — medium / row / xs —
 * so hierarchy is legible without near-duplicate sizes creeping in.
 * `medium` is the HERO scale: every drill hero (fixture matchup, team,
 * player) tops out at 40pt. The old hero (96) and header (56) steps were
 * removed once nothing rendered them — do not reintroduce oversized
 * steps; do not pass raw numbers to the flag component.
 */
export const FlagSize = {
  medium: 40, // drill heroes, teams tab rows, fixture line-up
  row: 24, // standings, fixtures list, rankings tables, mini-carousels
  xs: 16, // card-header corner flags (Form / Trajectory / KPIs / Profile)
} as const;

/**
 * Two canonical score-box tile sizes. `row` is used for anything sitting
 * inside a list row / table row / meta section (Fixtures list, My Team card
 * Last Match, World Rugby Rankings points tile). `card` is used for hero
 * / card-scale score displays (Home fixture carousel, Fixture detail
 * header). No other sizes are allowed — spread the whole object into a
 * StyleSheet entry so all three dimensions stay locked together.
 *
 * Docs: `docs/design-system.md` §6.
 */
export const ScoreBoxSize = {
  // Tuned to the Barlow Condensed score digits — tiles hug the numerals
  // broadcast-bug style instead of floating them in air.
  row: { width: 26, height: 22, borderRadius: 4 },
  card: { width: 40, height: 34, borderRadius: 8 },
} as const;

/**
 * Canonical type scale — 6 steps, Tailwind-style numeric names. Every text style
 * in the app must pick fontSize from here rather than raw numbers, so hierarchy
 * stays legible and the scale doesn't sprawl. Design doc in
 * `docs/design-system.md` explains the rationale.
 */
export const TextSize = {
  xs: 10, // uppercase micro labels, dev banner, tiny pills
  sm: 12, // caption / meta text
  md: 14, // body default, list rows
  lg: 16, // subtitles, section headers, prominent list rows
  xl: 22, // screen and card titles, hero scores and hero names
} as const;

/**
 * Weights collapsed to three. Data-app tone stays lighter with regular as the
 * default body weight and bold reserved for headlines / scores.
 */
export const TextWeight = {
  regular: '400',
  semibold: '600',
  bold: '700',
} as const;

/**
 * Only two tracking values are needed. Default 0 everywhere; `wide` (1.0)
 * for uppercase micro labels that need the standard tracking treatment.
 */
export const TextTracking = {
  normal: 0,
  wide: 1,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
