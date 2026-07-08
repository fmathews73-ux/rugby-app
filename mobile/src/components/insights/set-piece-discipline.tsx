import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';

import { useTeams, useTeamsFormSummary } from '@/api/hooks';
import { MatrixChart } from '@/components/insights/matrix-chart';
import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { AppLogo } from '@/components/app-logo';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamAnalysis } from '@/hooks/use-team-analysis';

/**
 * Set Piece & Discipline matrix — the CONTROL read to the Landscape's
 * OUTPUT read. x = combined scrum + lineout success (the platform),
 * y = penalties conceded per game inverted (up = cleaner). A side in
 * the top-right owns its own ball and gives nothing away; bottom-left
 * is feeding opponents possession AND position. Same pool data
 * (/teams/form-summary, prev-10) and the same matrix grammar as the
 * Team Landscape.
 */
export function SetPieceDiscipline({
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
      .filter((s) => s.games_played > 0)
      .map((s) => ({
        id: s.team_id,
        code: codeById.get(s.team_id) ?? s.team_id.toUpperCase(),
        x: (s.scrum_success_percent + s.lineout_success_percent) / 2,
        y: s.penalties_conceded_per_game,
      }));
  }, [summary.data, teams.data]);

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Set-Piece"
          onClose={() => setInfoOpen(false)}
          read={analysis.data?.setPieceDiscipline}
          purpose={
            <>Nations plotted by set-piece success against penalties conceded — four quadrants from Controlled to Under Siege.</>
          }
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
      {/* Title left, utility info icon pinned right on the same line. */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Set-Piece</Text>
        <Pressable
          onPress={() => setInfoOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Explain the set-piece and discipline matrix">
          <AppLogo height={14} spin />
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
          quadrants={{ tr: 'CONTROLLED', tl: 'TIDY', br: 'HEAVY-HANDED', bl: 'UNDER SIEGE' }}
          xCaption="SET-PIECE SUCCESS % →"
          yCaption="FEWER PENALTIES →"
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
    // Standard air below the title/icon row so charts never creep
    // into the header (with the card gap: 16pt total).
    marginBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
