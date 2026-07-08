import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';

import { useTeam } from '@/api/hooks';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { FlipCard, NarrativeBack } from '@/components/narrative-flip-card';
import { Colors, FlagSize, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamAnalysis } from '@/hooks/use-team-analysis';
import { useTeamAggregate } from '@/hooks/use-team-aggregate';
import { CHART_LINE_COLOR } from '@/lib/smooth-path';
import { TeamToggle, type ToggleSide } from '@/components/insights/team-toggle';

const LOOKBACK = 10;

/**
 * Compact KPI strip below the Radar. Numbers-first surface for viewers who
 * want the underlying values rather than the shape of the radar. Each row
 * shows a per-game average with a one-line explanation and a subtle bar
 * indicating how the value compares to a typical Tier-1 range.
 */
export function EfficiencyKpis({
  teamId,
  compareTeamId,
  asOfDate,
  style,
  title,
  showCornerFlag = true,
}: {
  teamId: string;
  compareTeamId?: string | null;
  /** When set, `useTeamAggregate` drops fixtures at or after this ISO
   *  timestamp — freezes the season-to-date averages to the state as of
   *  a specific match. */
  asOfDate?: string;
  /** Optional card-root style override — the Home carousel passes
   *  `flex: 1` so sibling pages normalise to equal heights. */
  style?: StyleProp<ViewStyle>;
  /** Optional header label override (e.g. Home's "My Team ..." titles). */
  title?: string;
  /** Hide the corner flag — Home's my-team cards drop it since the
   *  whole stack is already scoped to the selected team. */
  showCornerFlag?: boolean;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const analysis = useTeamAnalysis(teamId);
  const [activeSide, setActiveSide] = useState<ToggleSide>('primary');

  // Reset toggle back to primary whenever the compare team changes.
  useEffect(() => {
    setActiveSide('primary');
  }, [compareTeamId]);

  const primaryTeam = useTeam(teamId);
  const compareTeam = useTeam(compareTeamId ?? '');
  // Prev-10 window — the same lookback as Form, Profile, and the
  // scouting/percentile reads, so every BI card describes one coherent
  // stretch of matches. The full-season baseline lives in the team
  // Stats pane and the analysis narrative instead.
  const primaryAggregate = useTeamAggregate(teamId, asOfDate, LOOKBACK);
  const compareAggregate = useTeamAggregate(compareTeamId ?? '', asOfDate, LOOKBACK);

  const hasCompare = Boolean(compareTeamId);
  const activeAggregate = activeSide === 'primary' ? primaryAggregate : compareAggregate;
  const data = activeAggregate.data;
  const isLoading = activeAggregate.isLoading;

  const kpis = useMemo(() => {
    if (!data) return [];
    const g = data.perGame;
    return [
      {
        label: 'Points scored',
        value: g.pointsScored.toFixed(1), suffix: '/g',
        bar: clip(g.pointsScored / 40),
        avg: clip(T1_AVERAGES.pointsScored / 40),
      },
      {
        label: 'Points conceded',
        value: g.pointsConceded.toFixed(1), suffix: '/g',
        bar: clip(g.pointsConceded / 40),
        avg: clip(T1_AVERAGES.pointsConceded / 40),
        inverted: true,
      },
      {
        label: 'Tries scored',
        value: g.tries.toFixed(1), suffix: '/g',
        bar: clip(g.tries / 5),
        avg: clip(T1_AVERAGES.tries / 5),
      },
      {
        label: 'Possession',
        value: g.possessionPercent.toFixed(0), suffix: '%',
        bar: clip(g.possessionPercent / 100),
        avg: clip(T1_AVERAGES.possessionPercent / 100),
      },
      {
        label: 'Tackle success',
        value: g.tackleSuccessPercent.toFixed(0), suffix: '%',
        bar: clip(g.tackleSuccessPercent / 100),
        avg: clip(T1_AVERAGES.tackleSuccessPercent / 100),
      },
      {
        label: 'Penalties conceded',
        value: g.penaltiesConceded.toFixed(1), suffix: '/g',
        bar: clip(g.penaltiesConceded / 15),
        avg: clip(T1_AVERAGES.penaltiesConceded / 15),
        inverted: true,
      },
    ];
  }, [data]);

  return (
    <FlipCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title={title ?? 'Efficiency'}
          onClose={() => setInfoOpen(false)}
          read={analysis.data?.kpis}
          purpose={
            <>Six per-game averages from the last 10 matches, barred against a Tier-1 ceiling; the dark tick marks the Tier-1 average for each metric.</>
          }
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
      {/* Title left; toggle/flag then the utility info icon pinned
          right on the same line (same corner slot as Team Profile). */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>{title ?? 'Efficiency'}</Text>
        <View style={styles.headerRightGroup}>
          {hasCompare ? (
            <TeamToggle
              primaryLabel={primaryTeam.data?.short_name ?? teamId.toUpperCase()}
              compareLabel={compareTeam.data?.short_name ?? (compareTeamId ?? '').toUpperCase()}
              activeSide={activeSide}
              onSelect={setActiveSide}
            />
          ) : showCornerFlag && primaryTeam.data ? (
            <TeamFlagShield flagCode={primaryTeam.data.flag_code} width={FlagSize.xs} />
          ) : null}
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain Efficiency KPIs">
            <Ionicons name="reader-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
      </View>

      {isLoading && !data ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : data && data.gamesPlayed > 0 ? (
        <View style={styles.kpiList}>
          {kpis.map((k) => (
            <KpiRow
              key={k.label}
              label={k.label}
              value={k.value}
              suffix={k.suffix}
              bar={k.bar}
              avg={k.avg}
              inverted={k.inverted}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>No completed matches yet.</Text>
      )}
        </View>
      }
    />
  );
}

function KpiRow({
  label,
  value,
  suffix,
  bar,
  avg,
  inverted,
}: {
  label: string;
  value: string;
  suffix: string;
  bar: number;
  avg: number;
  inverted?: boolean;
}) {
  const good = kpiIsGood(bar, avg, inverted);
  return (
    <View style={styles.kpiRow}>
      <Text style={styles.kpiLabel}>{label}</Text>
      {/* Bar and value share one line — track flexes, value sits in a
          fixed right rail so every track ends at the same point. */}
      <View style={styles.kpiLine}>
        <View style={styles.kpiTrack}>
          <View
            style={[
              styles.kpiFill,
              {
                width: `${bar * 100}%`,
                backgroundColor: kpiBarColor(bar, avg, inverted),
              },
            ]}
          />
          {/* T1-average reference marker — small vertical black line sitting
              slightly taller than the track, so it reads over the coloured
              fill without competing with the value's dominant colour. */}
          <View style={[styles.kpiAvgMarker, { left: `${avg * 100}%` }]} />
        </View>
        {/* Value as a mini score tile following the match-score
            convention: above the T1 average (polarity-aware) takes the
            winner pairing (dark fill, white digits), below takes the
            loser pairing (light fill, grey digits). */}
        <View style={[styles.kpiValueBox, good ? styles.kpiValueBoxWin : null]}>
          <Text style={[styles.kpiValueText, good ? styles.kpiValueTextWin : null]}>
            {value}
            <Text style={[styles.kpiSuffix, good ? styles.kpiValueTextWin : null]}>{suffix}</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

function clip(x: number): number {
  return Math.max(0, Math.min(1, x));
}

// Row-fill tokens — green for a "good" bar level, red for a "poor" one.
// Matches the win/loss + rankings-movement palette used elsewhere in the app.
const GOOD_COLOR = '#059669';
const BAD_COLOR = StatusColor.live;

// Tier-1 international per-game averages. Hard-coded for now (dev-data
// mode); replace with a live-computed average across the T1 pool when we
// cut over to real feeds. Positions the black reference marker on each
// bar and thresholds the green/red colour of the fill.
const T1_AVERAGES = {
  pointsScored: 22,
  pointsConceded: 22,
  tries: 3,
  possessionPercent: 50,
  tackleSuccessPercent: 85,
  penaltiesConceded: 9,
};

/**
 * Colour a KPI bar based on how the team's actual value compares to the
 * Tier-1 average. Non-inverted metrics (points scored, tackle success,
 * etc.) go green when at or above the average, red when below. Inverted
 * metrics (points conceded, penalties conceded — higher is worse) flip
 * the comparison — at or below average is good.
 */
function kpiIsGood(bar: number, avg: number, inverted: boolean | undefined): boolean {
  const atOrAbove = bar >= avg;
  return inverted ? !atOrAbove : atOrAbove;
}

function kpiBarColor(bar: number, avg: number, inverted: boolean | undefined): string {
  return kpiIsGood(bar, avg, inverted) ? GOOD_COLOR : BAD_COLOR;
}

const styles = StyleSheet.create({
  // Front face fills the flip container (grow-only — natural height
  // stays content-driven).
  cardFill: { flexGrow: 1 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.three,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerRow: {
    // Standard air below the title/icon row so charts never creep
    // into the header (with the card gap: 16pt total).
    marginBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionLabel: {
    // Same card-header treatment as the Teams landing cards.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: TextTracking.wide,
  },
  headerMeta: {
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
  },
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },
  // Extra `marginTop` on top of the card's own `gap: Spacing.two` so
  // there's a full Spacing.three (16pt) of breathing room between the
  // header row and the first KPI bar, matching the rhythm of the other
  // Preview cards.
  // flex + space-evenly so the rows spread through whatever height the
  // carousel grants the card (tallest-sibling stretch) instead of
  // top-packing above dead space.
  kpiList: { flex: 1, justifyContent: 'space-evenly' },
  kpiRow: { gap: 4 },
  kpiLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  kpiLabel: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.regular,
    color: Colors.light.textSecondary,
  },
  // Mini score tile in the fixed right rail — match-score convention:
  // loser pairing by default, winner pairing when beating the average.
  kpiValueBox: {
    width: 44,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValueBoxWin: { backgroundColor: Colors.light.textSecondary },
  kpiValueText: {
    // Trial: the match-score face on KPI values — condensed italic at
    // the row-score size (the tile already follows the win/loss fill
    // convention, so the digits now match the scoreboard voice too).
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.textSecondary,
  },
  kpiValueTextWin: { color: Colors.light.textInverse },
  kpiSuffix: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
  },
  kpiTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    position: 'relative',
    // `overflow: visible` so the T1-average marker can extend a couple of
    // pixels above and below the track edge — makes it read as a distinct
    // reference tick, not part of the fill.
    overflow: 'visible',
  },
  kpiFill: {
    height: '100%',
    borderRadius: 2,
  },
  kpiAvgMarker: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    width: 1.5,
    marginLeft: -0.75,
    backgroundColor: CHART_LINE_COLOR,
  },

  // Modal
});
