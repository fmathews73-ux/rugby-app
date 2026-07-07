import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View , type StyleProp, type ViewStyle } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { useTeam } from '@/api/hooks';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { FlipCard, NarrativeBack } from '@/components/narrative-flip-card';
import { Colors, FlagSize, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamAggregate } from '@/hooks/use-team-aggregate';
import {
  RADAR_AWAY_FILL,
  RADAR_FILL,
  RadarChart,
  buildRadarAxes,
} from '@/components/insights/radar-chart';

/**
 * Profile radar card. When only `primaryTeamId` is set, renders that
 * team's polygon over the 50%-reference hexagon. When a compare team is
 * also present, BOTH polygons are overlaid on the same axes — primary
 * (home) in blue, compare (away) in purple. The two team polygons act
 * as each other's reference, so the 50%-hexagon is dropped in that mode.
 *
 * On the fixture-drill Insights tab the profile is *match-scoped* — the
 * polygons read as the story of *this* fixture. For scheduled matches
 * there is no such story yet, so `fixtureStatus === 'scheduled'` renders
 * an empty state instead of the teams' historical aggregate. Pass no
 * `fixtureStatus` (My Team on Home page) to always render the polygon
 * from whatever aggregate the caller supplies.
 */
export function InsightsCanvas({
  primaryTeamId,
  compareTeamId,
  fixtureStatus,
  asOfDate,
  lookback,
  style,
  read,
}: {
  primaryTeamId: string | null;
  compareTeamId?: string | null;
  fixtureStatus?: Fixture['status'];
  /** Freeze the aggregates to fixtures before this ISO timestamp —
   *  the pre-match pane passes kickoff so the radar reads as-of. */
  asOfDate?: string;
  /** Restrict the aggregate window (e.g. prev-10 on the pre-match
   *  pane, matching the analysis engine's window). */
  lookback?: number;
  style?: StyleProp<ViewStyle>;
  /** Live narrative for the flip back. When provided the reader icon
      FLIPS the card (pre-match grammar); when omitted it opens the
      legacy explainer modal (Match Analysis pane — migrates later). */
  read?: string | null;
}) {
  const [infoOpen, setInfoOpen] = useState(false);

  const primaryTeam = useTeam(primaryTeamId ?? '');
  const compareTeam = useTeam(compareTeamId ?? '');
  const { data: primaryAgg, isLoading: primaryLoading } = useTeamAggregate(
    primaryTeamId ?? '',
    asOfDate,
    lookback,
  );
  const { data: compareAgg, isLoading: compareLoading } = useTeamAggregate(
    compareTeamId ?? '',
    asOfDate,
    lookback,
  );

  const primaryAxes = useMemo(() => buildRadarAxes(primaryAgg), [primaryAgg]);
  const compareAxes = useMemo(() => buildRadarAxes(compareAgg), [compareAgg]);

  const hasCompare = compareTeamId !== null && compareTeamId !== undefined && compareTeamId !== '';
  const primaryReady = Boolean(primaryAgg && primaryAgg.gamesPlayed > 0);
  const compareReady = Boolean(compareAgg && compareAgg.gamesPlayed > 0);
  const canRender = hasCompare ? primaryReady || compareReady : primaryReady;
  const isLoading = primaryLoading || (hasCompare && compareLoading);

  const primaryShort = primaryTeam.data?.short_name ?? primaryTeamId?.toUpperCase() ?? '—';
  const compareShort = compareTeam.data?.short_name ?? (compareTeamId ?? '').toUpperCase();

  const flipMode = read !== undefined;

  const front = (
    <View style={flipMode ? [styles.card, styles.cardFill] : [styles.card, style]}>
      {/* Title left; accessory then the reader icon pinned right —
          same corner slot as the Home carousel cards. */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Profile</Text>
        <View style={styles.headerRightGroup}>
          {/* Single-team mode anchors the header with the team's xs
              flag; compare mode's colour legend sits under the chart. */}
          {!hasCompare && primaryTeam.data ? (
          <TeamFlagShield flagCode={primaryTeam.data.flag_code} width={FlagSize.xs} />
        ) : null}
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the Profile radar">
            <Ionicons name="reader-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
      </View>

      {fixtureStatus === 'scheduled' ? (
        <Text style={styles.empty}>
          Profile populates once the match is under way.
        </Text>
      ) : canRender ? (
        // Both team polygons overlaid when a compare team is set — no
        // toggle needed. Home page single-team mode (no compareTeamId)
        // renders the primary polygon only against the 50%-reference
        // hexagon.
        // Legend overlays the canvas's empty bottom band (absolute) so
        // the card's height stays identical to Home's Team Profile.
        <View style={styles.chartWrap}>
          <RadarChart
            axes={primaryReady ? primaryAxes : compareAxes}
            compareAxes={hasCompare && primaryReady && compareReady ? compareAxes : null}
          />
          {hasCompare ? (
            <View style={styles.legend}>
              <LegendChip label={primaryShort} color={RADAR_FILL} />
              <LegendChip label={compareShort} color={RADAR_AWAY_FILL} />
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.empty}>
          {isLoading ? 'Loading…' : 'No completed matches to profile yet.'}
        </Text>
      )}

      {!flipMode ? (
        <InfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} hasCompare={hasCompare} />
      ) : null}
    </View>
  );

  if (!flipMode) return front;
  return (
    <FlipCard
      style={style}
      flipped={infoOpen}
      front={front}
      back={
        <NarrativeBack
          title="Profile"
          onClose={() => setInfoOpen(false)}
          read={read}
          purpose={
            <>
              Both sides' eight-dimension shapes from their last 10 matches,
              overlaid — where the polygons separate is where this match
              will most likely be decided.
            </>
          }
        />
      }
    />
  );
}

function LegendChip({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.legendChip}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function InfoModal({
  visible,
  onClose,
  hasCompare,
}: {
  visible: boolean;
  onClose: () => void;
  hasCompare: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Profile</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            Eight-axis rugby analytics radar. Axes cover
            {' '}<Text style={styles.modalStrong}>Attack</Text>,
            {' '}<Text style={styles.modalStrong}>Defence</Text>,
            {' '}<Text style={styles.modalStrong}>Set-piece</Text>,
            {' '}<Text style={styles.modalStrong}>Discipline</Text>,
            {' '}<Text style={styles.modalStrong}>Kicking</Text>,
            {' '}<Text style={styles.modalStrong}>Territory</Text>,
            {' '}<Text style={styles.modalStrong}>Possession</Text>, and
            {' '}<Text style={styles.modalStrong}>Turnovers</Text>.
          </Text>
          {hasCompare ? (
            <Text style={styles.modalBody}>
              Both team polygons are drawn on the same axes:
              {' '}<Text style={styles.modalStrong}>home</Text> in blue,
              {' '}<Text style={styles.modalStrong}>away</Text> in purple.
              Overlap regions naturally darken through blending, so the
              shape gaps between the two sides (the axes where one team's
              polygon reaches further than the other's) tell the profile
              story at a glance.
            </Text>
          ) : (
            <Text style={styles.modalBody}>
              The dashed octagon at 50% radius is the notional
              international average — the team's polygon reaching outside
              means above average on that axis, inside means below.
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Front face fills the flip container (grow-only).
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
    // Chart-card title rule — same as the Home carousel cards.
    fontFamily: 'Barlow_700Bold',
    fontSize: TextSize.sm,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  chartWrap: { position: 'relative' },
  // One row below the canvas, centred — the card's minHeight slack
  // absorbs the row, so this costs no card height.
  legend: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },

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
});
