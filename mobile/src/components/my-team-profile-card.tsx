import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';

import { BackStrong, FlipCard, NarrativeBack } from '@/components/narrative-flip-card';
import { RadarChart, buildRadarAxes } from '@/components/insights/radar-chart';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
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
  const { data: aggregate, isLoading } = useTeamAggregate(teamId, undefined, LOOKBACK);
  const axes = useMemo(() => buildRadarAxes(aggregate), [aggregate]);

  return (
    // Flip-card pilot (owner call 2026-07-07): the info icon flips the
    // card to its narrative back face — purpose + live read — instead
    // of opening a modal. The overall team summary narrative lives on
    // this card's back; the radar is the app's overall-shape card.
    <FlipCard
      style={style}
      flipped={infoOpen}
      front={
        <View style={[styles.card, styles.cardFill]}>
          {/* Title left, utility info icon pinned right on the same line. */}
          <View style={styles.headerRow}>
            <Text style={styles.sectionLabel}>Team Profile</Text>
            <Pressable
              onPress={() => setInfoOpen(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Explain the Profile radar">
              <Ionicons name="reader-outline" size={14} color={Colors.light.textSecondary} />
            </Pressable>
          </View>

          {aggregate && aggregate.gamesPlayed > 0 ? (
            <RadarChart axes={axes} />
          ) : (
            <Text style={styles.empty}>
              {isLoading ? 'Loading…' : 'Not enough completed matches yet.'}
            </Text>
          )}
        </View>
      }
      back={
        <NarrativeBack
          title="Team Profile"
          onClose={() => setInfoOpen(false)}
          read={analysis.data?.summary}
          purpose={
            <>
              The team's playing shape over the last {LOOKBACK} matches,
              across eight dimensions from <BackStrong>Attack</BackStrong> to{' '}
              <BackStrong>Turnovers</BackStrong>. The dashed octagon marks the
              international average — outside it is above par.
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
    // Standard air below the title/icon row so charts never creep
    // into the header (with the card gap: 16pt total).
    marginBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    // Same card-header treatment as the Teams landing cards.
    fontFamily: 'Barlow_700Bold',
    fontSize: TextSize.sm,
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
