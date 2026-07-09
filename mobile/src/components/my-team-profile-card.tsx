import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';

import { BackStrong, FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { RadarChart, buildRadarAxes, buildRadarAxesFromPerGame } from '@/components/insights/radar-chart';
import { FlipTrigger } from '@/components/flip-trigger';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeam, useTeamsFormSummary } from '@/api/hooks';
import { teamDotColor } from '@/lib/team-colors';
import { TIER_1_IDS } from '@/lib/tiers';
import { CardTitle } from '@/components/card-title';
import { useTeamAggregate } from '@/hooks/use-team-aggregate';
import { useTeamAnalysis } from '@/hooks/use-team-analysis';

const LOOKBACK = 10;

/**
 * Home-page Profile radar for the user's team, aggregated over their most-
 * recent `LOOKBACK` completed fixtures. Same 8-axis polygon (Attack /
 * Defence / Set-piece / Discipline / Kicking / Territory / Possession /
 * Turnovers) as the fixture-drill Insights Profile card, but scoped to
 * the team's recent form window rather than a single 80-minute match.
 *
 * Sits directly above the Form (last 10) sparkline so the two cards
 * share the same lookback window — Form tells the story of the last 10
 * results; Profile tells the story of the *shape* of those results.
 *
 * Returns nothing until a team is selected — [[team-selector-card]]
 * handles the empty state.
 */
/** Team-scoped variant for the team drill — same card, caller-scoped
 *  team id instead of the Home My Team selection. */
export function TeamProfileCard({
  teamId,
  style,
}: {
  teamId: string;
  style?: StyleProp<ViewStyle>;
}) {
  return <Populated teamId={teamId} style={style} />;
}

function Populated({
  teamId,
  style,
}: {
  teamId: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const analysis = useTeamAnalysis(teamId);
  const team = useTeam(teamId);
  const { data: aggregate, isLoading } = useTeamAggregate(teamId, undefined, LOOKBACK);
  const axes = useMemo(() => buildRadarAxes(aggregate), [aggregate]);
  // Tier-average reference: mean per-game sheet across the subject's
  // tier, run through the same axis scales — the dashed polygon is a
  // real benchmark, not a constant ring.
  const pool = useTeamsFormSummary();
  const referenceAxes = useMemo(() => {
    const peers = (pool.data ?? []).filter(
      (r) => r.games_played > 0 && TIER_1_IDS.has(r.team_id) === TIER_1_IDS.has(teamId),
    );
    if (peers.length < 4) return null;
    const avg: Record<string, number> = {};
    for (const key of Object.keys(peers[0]!.per_game)) {
      avg[key] = peers.reduce((sum, r) => sum + (r.per_game[key] ?? 0), 0) / peers.length;
    }
    return buildRadarAxesFromPerGame(avg);
  }, [pool.data, teamId]);

  return (
    // Flip-card pilot (owner call 2026-07-07): the info icon flips the
    // card to its narrative back face — purpose + live read — instead
    // of opening a modal. The overall team summary narrative lives on
    // this card's back; the radar is the app's overall-shape card.
    <FadeCard
      style={style}
      flipped={infoOpen}
      front={
        <View style={[styles.card, styles.cardFill]}>
          {/* Title left, utility info icon pinned right on the same line. */}
          <View style={styles.headerRow}>
            <CardTitle
              title="Profile"
              flagCode={team.data?.flag_code}
              code={team.data?.short_name}
              comparison="vs TIER AVG"
              centerTitle
            />
            <Pressable
              onPress={() => setInfoOpen(true)}
              style={styles.headerTrigger}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Explain the Profile radar">
              <FlipTrigger />
            </Pressable>
          </View>

          {aggregate && aggregate.gamesPlayed > 0 ? (
            <RadarChart
              axes={axes}
              referenceAxes={referenceAxes}
              // Team identity colour — the same guarded jersey colour
              // the chart dots use (white shirts fall back to their
              // secondary); gradient/stroke weights unchanged.
              // Borderless flat fill (owner calls 2026-07-09): the
              // team colour at 25% with no outline — the dots vanish
              // with the stroke by design.
              strokeColor="transparent"
              fillColor={teamDotColor(teamId)}
              flatFillOpacity={0.25}
            />
          ) : null}
          {aggregate && aggregate.gamesPlayed > 0 ? (
            /* Bottom-centred legend — Progression grammar: team fill
               swatch + code, dashed marker + TIER AVG. */
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: teamDotColor(teamId) }]} />
                <Text style={styles.legendText}>
                  {team.data?.short_name ?? teamId.toUpperCase()}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.empty}>
              {isLoading ? 'Loading…' : 'Not enough completed matches yet.'}
            </Text>
          )}
        </View>
      }
      back={
        <NarrativeBack
          title="Profile"
          flagCode={team.data?.flag_code}
          code={team.data?.short_name}
          comparison="vs TIER AVG"
          onClose={() => setInfoOpen(false)}
          read={analysis.data?.summary}
          purpose={
            <>
              The team's playing shape over the last {LOOKBACK} matches,
              across eight dimensions from <BackStrong>Attack</BackStrong> to{' '}
              <BackStrong>Turnovers</BackStrong>. The dashed outline traces the
              tier average on every axis — outside it is above the tier
              on that dimension.
            </>
          }
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  // Front face must fill the flip container so front and back share
  // one footprint — grow-only, natural height stays content-driven.
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
    // Standard air below the title/icon row so charts never creep
    // into the header (with the card gap: 16pt total).
    marginBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTrigger: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sectionLabel: {
    // Same card-header treatment as the Teams landing cards.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: TextTracking.wide,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendSwatch: {
    width: 9,
    height: 9,
    borderRadius: 999,
    opacity: 0.45,
  },
  // Dashed tier-average marker — a short dashed rule matching the
  // reference curve.
  // Matrix size-legend register — one legend voice across the cards.
  legendText: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 8,
    letterSpacing: 0.4,
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
