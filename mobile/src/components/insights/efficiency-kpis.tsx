import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';

import { useTeam } from '@/api/hooks';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { Colors, FlagSize, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
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
    <View style={[styles.card, style]}>
      {/* Title left; toggle/flag then the utility info icon pinned
          right on the same line (same corner slot as Team Profile). */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>{title ?? 'Efficiency KPIs'}</Text>
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
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
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

      <KpiInfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />
    </View>
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
        {/* Value as a mini score tile — the quiet losing-score
            treatment on every row (the solid winner fill read too
            harsh here); the bar colour alone carries the verdict. */}
        <View style={styles.kpiValueBox}>
          <Text style={styles.kpiValueText}>
            {value}
            <Text style={styles.kpiSuffix}>{suffix}</Text>
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

function KpiInfoModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Efficiency KPIs</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            Per-game averages across the team's last 10 completed matches —
            the same window as Form and Profile — over the six most-scanned
            rugby metrics. Each bar shows the value relative to a plausible
            Tier-1 ceiling, giving a quick "how good is this number,
            really?" read without needing to memorise benchmarks.
          </Text>
          <View style={styles.modalDivider} />
          <Text style={styles.modalBody}>
            The small dark tick on each bar marks the{' '}
            <Text style={styles.modalStrong}>Tier-1 average</Text> for that
            metric — a bar ending past the tick is running ahead of the
            typical top-tier side, and the fill turns green or red by how
            the value compares to it.
          </Text>
          <View style={styles.modalDivider} />
          <Text style={styles.modalBody}>
            Two rows are <Text style={styles.modalStrong}>inverted</Text>{' '}
            (Points conceded, Penalties conceded) — a longer bar means the team
            is giving away more, which is worse, so their colours flip: staying
            UNDER the tick is the good side.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    fontFamily: 'Barlow_700Bold',
    fontSize: TextSize.sm,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
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
  kpiList: { flex: 1, justifyContent: 'space-evenly', marginTop: Spacing.one },
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
  // Mini score tile in the fixed right rail — the quiet losing-score
  // pairing (light fill, grey digits) on every row.
  kpiValueBox: {
    width: 52,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValueText: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.four,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: TextSize.lg,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
  },
  modalBody: {
    fontSize: TextSize.sm,
    color: Colors.light.text,
    lineHeight: 20,
  },
  modalStrong: {
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
  },
  modalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginVertical: Spacing.one,
  },
});
