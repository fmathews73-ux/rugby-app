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
 * Defensive Integrity matrix — the game's core defensive relationship:
 * tackle completion is strongly negatively correlated with line breaks
 * conceded, because missed tackles are the proximate cause of breaks.
 * x = tackle success % (right = more complete), y = line breaks
 * conceded per game (up = tighter line; raw value fed directly since
 * the matrix plots smaller y higher). Dot size = points conceded per
 * game (bigger = leakier — the size key says POINTS CONCEDED, not
 * MARGIN). Breaks conceded are DERIVED from opponents' rows
 * (reconciliation principle), never stored independently.
 */
export function DefensiveIntegrity({
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
    return (summary.data ?? [])
      // Tier-scoped pool (owner call 2026-07-09): a side is measured
      // against ITS OWN tier — same philosophy as the tier-average
      // stats — so crosshairs are tier medians, not whole-pool ones.
      .filter((s) => s.games_played > 0 && TIER_1_IDS.has(s.team_id) === TIER_1_IDS.has(teamId))
      .map((s, i, rows) => {
        // Points conceded per game → 0..1 weight (same normalisation
        // as the margin sizing): bigger dot = leakier defence.
        const conceded = rows.map((r) => r.per_game.pointsConceded ?? 0);
        const minC = Math.min(...conceded, 0);
        const span = Math.max(Math.max(...conceded, 0) - minC, 1);
        return {
          id: s.team_id,
          code: codeById.get(s.team_id) ?? s.team_id.toUpperCase(),
          x: s.per_game.tackleSuccessPercent ?? 0,
          y: s.per_game.lineBreaksConceded ?? 0,
          weight: (conceded[i]! - minC) / span,
        };
      });
  }, [summary.data, teams.data, teamId]);

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Defence"
          flagCode={subjectTeam?.flag_code}
          code={subjectTeam?.short_name}
          comparison="vs TIER AVG"
          onClose={() => setInfoOpen(false)}
          read={analysis.data?.defensiveIntegrity}
          purpose={
            <>Every nation in the team’s tier plotted by tackle completion against line breaks conceded — missed tackles are the proximate cause of breaks, and completion under ~85% almost always shows on the scoreboard. Dot size is points conceded per game: bigger is leakier.</>
          }
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
      {/* Title left, utility info icon pinned right on the same line. */}
      <View style={styles.headerRow}>
        <CardTitle
          title="Defence"
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
          accessibilityLabel="Explain the defensive integrity matrix">
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
          quadrants={{ tr: 'THE WALL', tl: 'SCRAMBLERS', br: 'OUT OF SHAPE', bl: 'BROKEN OPEN' }}
          xCaption="TACKLE SUCCESS % →"
          yCaption="FEWER BREAKS CONCEDED →"
          sizeLabel="POINTS CONCEDED"
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
