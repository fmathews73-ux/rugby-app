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
 * Possession matrix — does the ball convert to scoreboard? x =
 * possession share per game, y = POINTS SCORED per game (up = more
 * scoreboard; fed negated because the matrix plots smaller y higher).
 * Top-right turns its share into points; top-left wins WITHOUT the
 * ball; bottom-right holds it and has nothing to show. Tier-scoped
 * like every pool matrix (owner call 2026-07-09 — this replaced a
 * last-10 per-match scatter so the card compares against the tier
 * like its neighbours). Same pool data (/teams/form-summary, prev-10)
 * and matrix grammar as the Team Landscape.
 */
export function PossessionOutcome({
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

  const points = useMemo(() => {
    const codeById = new Map((teams.data ?? []).map((t) => [t.id, t.short_name]));
    return (summary.data ?? [])
      // Tier-scoped pool (owner call 2026-07-09): a side is measured
      // against ITS OWN tier — same philosophy as the tier-average
      // stats — so crosshairs are tier medians, not whole-pool ones.
      .filter((s) => s.games_played > 0 && TIER_1_IDS.has(s.team_id) === TIER_1_IDS.has(teamId))
      .map((s, i, rows) => {
        // Margin per game → 0..1 weight for dot size (outcome as the
        // third axis; owner call 2026-07-09 — the y-axis stays pure
        // attack conversion).
        const margins = rows.map(
          (r) => (r.per_game.pointsScored ?? 0) - (r.per_game.pointsConceded ?? 0),
        );
        const minM = Math.min(...margins, 0);
        const span = Math.max(Math.max(...margins, 0) - minM, 1);
        return {
          id: s.team_id,
          code: codeById.get(s.team_id) ?? s.team_id.toUpperCase(),
          x: s.per_game.possessionPercent ?? s.possession_percent,
          // Negated: the matrix plots smaller y higher, scoring is
          // higher-is-better.
          y: -(s.per_game.pointsScored ?? 0),
          weight: (margins[i]! - minM) / span,
        };
      });
  }, [summary.data, teams.data, teamId]);

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Possession"
          onClose={() => setInfoOpen(false)}
          read={analysis.data?.possession}
          purpose={
            <>Every nation in the team’s tier over the last 10 plotted by possession share against points scored per game — when they have the ball, do they score — from Converters to Shut Out. Dot size is the side’s points margin per game.</>
          }
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
      {/* Title left, utility info icon pinned right on the same line. */}
      <View style={styles.headerRow}>
        {/* Radar/2x2 rule: title centred on the chart's vertical axis;
            bar-chart cards keep left titles. */}
        <View style={styles.titleCentreFill} pointerEvents="none">
          <CardTitle title="Possession" />
        </View>
        <Pressable
          onPress={() => setInfoOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Explain the possession matrix">
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
          quadrants={{ tr: 'CONVERTERS', tl: 'COUNTER-PUNCHERS', br: 'NOTHING TO SHOW', bl: 'SHUT OUT' }}
          xCaption="POSSESSION % →"
          yCaption="POINTS SCORED →"
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
