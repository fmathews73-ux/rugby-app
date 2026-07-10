import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View , type StyleProp, type ViewStyle } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { useFixtureResult, useTeam } from '@/api/hooks';
import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { LegendChip } from '@/components/insights/legend-chip';
import { CardTitle } from '@/components/card-title';
import { FlipTrigger } from '@/components/flip-trigger';
import { teamDotColor } from '@/lib/team-colors';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamAggregate } from '@/hooks/use-team-aggregate';
import {
  RADAR_AWAY_FILL,
  RADAR_FILL,
  RadarChart,
  buildMatchRadarAxes,
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
  fixtureId,
  asOfDate,
  lookback,
  style,
  read,
}: {
  primaryTeamId: string | null;
  compareTeamId?: string | null;
  fixtureStatus?: Fixture['status'];
  /** Match mode (owner call 2026-07-09): when set, BOTH polygons are
   *  built from THIS fixture's Result — the shape of the match itself,
   *  not the coming-in prev-10 aggregates. Primary must be the home
   *  side. Pre-Match and team surfaces omit this and stay aggregate. */
  fixtureId?: string;
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

  const matchScoped = Boolean(fixtureId);
  const primaryTeam = useTeam(primaryTeamId ?? '');
  const compareTeam = useTeam(compareTeamId ?? '');
  const result = useFixtureResult(fixtureId ?? '', fixtureStatus);
  const { data: primaryAgg, isLoading: primaryLoading } = useTeamAggregate(
    matchScoped ? '' : (primaryTeamId ?? ''),
    asOfDate,
    lookback,
  );
  const { data: compareAgg, isLoading: compareLoading } = useTeamAggregate(
    matchScoped ? '' : (compareTeamId ?? ''),
    asOfDate,
    lookback,
  );

  const primaryAxes = useMemo(
    () => (matchScoped ? (result.data ? buildMatchRadarAxes(result.data, 'home') : []) : buildRadarAxes(primaryAgg)),
    [matchScoped, result.data, primaryAgg],
  );
  const compareAxes = useMemo(
    () => (matchScoped ? (result.data ? buildMatchRadarAxes(result.data, 'away') : []) : buildRadarAxes(compareAgg)),
    [matchScoped, result.data, compareAgg],
  );

  const hasCompare = compareTeamId !== null && compareTeamId !== undefined && compareTeamId !== '';
  const primaryReady = matchScoped
    ? primaryAxes.length > 0
    : Boolean(primaryAgg && primaryAgg.gamesPlayed > 0);
  const compareReady = matchScoped
    ? compareAxes.length > 0
    : Boolean(compareAgg && compareAgg.gamesPlayed > 0);
  const canRender = hasCompare ? primaryReady || compareReady : primaryReady;
  const isLoading = matchScoped
    ? result.isLoading
    : primaryLoading || (hasCompare && compareLoading);

  const primaryShort = primaryTeam.data?.short_name ?? primaryTeamId?.toUpperCase() ?? '—';
  const compareShort = compareTeam.data?.short_name ?? (compareTeamId ?? '').toUpperCase();

  const front = (
    <View style={[styles.card, styles.cardFill]}>
      {/* Title left; accessory then the reader icon pinned right —
          same corner slot as the Home carousel cards. */}
      <View style={styles.headerRow}>
        {/* Radar/2x2 rule: title centred on the chart's vertical axis;
            bar-chart cards keep left titles. */}
        <View style={styles.titleCentreFill} pointerEvents="none">
          <CardTitle title="Profile" />
        </View>
        <Pressable
          onPress={() => setInfoOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Explain the Profile radar">
          <FlipTrigger />
        </Pressable>
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
            // Nation identity colours — the squad palette (white
            // shirts fall back to their accent), matching the Home
            // Profile and every matrix dot.
            // Borderless like the Home Profile: no outline strokes,
            // dots carry each side's colour.
            strokeColor="transparent"
            fillColor={primaryTeamId ? teamDotColor(primaryTeamId) : undefined}
            dotColor={primaryTeamId ? teamDotColor(primaryTeamId) : undefined}
            compareStrokeColor="transparent"
            compareFillColor={compareTeamId ? teamDotColor(compareTeamId) : undefined}
            compareDotColor={compareTeamId ? teamDotColor(compareTeamId) : undefined}
            // Home Profile fill treatment: flat colour at 25%, no
            // radial gradient — the two translucencies blend where the
            // shapes overlap.
            flatFillOpacity={0.25}
          />
          {hasCompare ? (
            <View style={styles.legend}>
              <LegendChip
                label={primaryShort}
                color={(primaryTeamId ? teamDotColor(primaryTeamId) : undefined) ?? RADAR_FILL}
              />
              <LegendChip
                label={compareShort}
                color={(compareTeamId ? teamDotColor(compareTeamId) : undefined) ?? RADAR_AWAY_FILL}
              />
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
    <FadeCard
      style={style}
      flipped={infoOpen}
      front={front}
      back={
        <NarrativeBack
          title="Profile"
          onClose={() => setInfoOpen(false)}
          read={read}
          purpose={
            matchScoped ? (
              <>
                Both sides' eight-dimension shapes from THIS match, overlaid —
                where the polygons separate is where the game is being won
                and lost. Live fixtures reshape as the numbers move.
              </>
            ) : (
              <>
                Both sides' eight-dimension shapes from their last 10 matches,
                overlaid — where the polygons separate is where this match
                will most likely be decided.
              </>
            )
          }
        />
      }
    />
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
    position: 'relative',
    justifyContent: 'flex-end',
    // Standard air below the title/icon row so charts never creep
    // into the header (with the card gap: 16pt total).
    marginBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleCentreFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
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
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },

});
