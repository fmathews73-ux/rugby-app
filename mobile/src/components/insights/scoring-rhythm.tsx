import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';

import { useTeams, useTeamsFormSummary } from '@/api/hooks';
import { MatrixChart } from '@/components/insights/matrix-chart';
import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { CardTitle } from '@/components/card-title';
import { FlipTrigger } from '@/components/flip-trigger';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamAnalysis } from '@/hooks/use-team-analysis';
import { TIER_1_IDS } from '@/lib/tiers';

/**
 * Rhythm matrix — WHEN the points come. x = first-half points per
 * game, y = second-half points per game (up = stronger second half;
 * fed negated because the matrix plots smaller y higher). Dot SIZE
 * carries the third axis: points margin per game, normalised across
 * the tier (owner call 2026-07-09) — big dots are the sides whose
 * tempo is actually winning. Tier-scoped like every pool matrix.
 */
export function ScoringRhythm({
  teamId,
  style,
}: {
  teamId: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const analysis = useTeamAnalysis(teamId);
  const summary = useTeamsFormSummary();
  const teams = useTeams();
  const subjectTeam = (teams.data ?? []).find((t) => t.id === teamId);

  const points = useMemo(() => {
    const codeById = new Map((teams.data ?? []).map((t) => [t.id, t.short_name]));
    // Tier-scoped pool (owner call 2026-07-09): a side is measured
    // against ITS OWN tier — same philosophy as the tier-average
    // stats — so crosshairs are tier medians, not whole-pool ones.
    const rows = (summary.data ?? []).filter(
      (s) => s.games_played > 0 && TIER_1_IDS.has(s.team_id) === TIER_1_IDS.has(teamId),
    );
    // Margin per game → 0..1 weight across the tier for dot size.
    const margins = rows.map(
      (s) => (s.per_game.pointsScored ?? 0) - (s.per_game.pointsConceded ?? 0),
    );
    const minM = Math.min(...margins, 0);
    const maxM = Math.max(...margins, 0);
    const span = Math.max(maxM - minM, 1);
    return rows.map((s, i) => ({
      id: s.team_id,
      code: codeById.get(s.team_id) ?? s.team_id.toUpperCase(),
      x: s.per_game.firstHalfPointsScored ?? 0,
      // Negated: the matrix plots smaller y higher, second-half
      // scoring is higher-is-better.
      y: -(s.per_game.secondHalfPointsScored ?? 0),
      weight: (margins[i]! - minM) / span,
    }));
  }, [summary.data, teams.data, teamId]);

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Rhythm"
          flagCode={subjectTeam?.flag_code}
          code={subjectTeam?.short_name}
          comparison="vs TIER AVG"
          onClose={() => setInfoOpen(false)}
          read={analysis.data?.rhythm}
          purpose={
            <>Every nation in the team’s tier plotted by first-half scoring against second-half scoring — when the points come, from Eighty Minutes to Misfiring. Dot size is the side’s points margin per game.</>
          }
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
      {/* Title left, utility info icon pinned right on the same line. */}
      <View style={styles.headerRow}>
        <CardTitle
          title="Rhythm"
          flagCode={subjectTeam?.flag_code}
          code={subjectTeam?.short_name}
          comparison="vs TIER AVG"
          centerTitle
        />
        <Pressable
          onPress={() => setInfoOpen(true)}
          style={styles.headerTrigger}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Explain the rhythm matrix">
          <FlipTrigger />
        </Pressable>
      </View>

      {summary.isLoading && points.length === 0 ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : points.length < 4 ? (
        <Text style={styles.empty}>Not enough teams with completed matches yet.</Text>
      ) : (
        <MatrixChart
          points={points}
          subjectId={teamId}
          quadrants={{ tr: 'FULL EIGHTY', tl: 'SLOW BURNERS', br: 'FAST STARTERS', bl: 'MISFIRING' }}
          xCaption="1ST-HALF POINTS /GAME →"
          yCaption="2ND-HALF POINTS →"
        />
      )}

        </View>
      }
    />
  );
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
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },
});
