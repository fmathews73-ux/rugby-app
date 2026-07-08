import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View , type StyleProp, type ViewStyle } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { useTeam } from '@/api/hooks';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { FlipCard, NarrativeBack } from '@/components/narrative-flip-card';
import { AppLogo } from '@/components/app-logo';
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
  /** Live narrative for the flip back. */
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

  const front = (
    <View style={[styles.card, styles.cardFill]}>
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
            <AppLogo height={14} />
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

    </View>
  );

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
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
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
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },

});
