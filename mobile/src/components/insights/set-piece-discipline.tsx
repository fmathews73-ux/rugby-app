import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';

import { useTeams, useTeamsFormSummary } from '@/api/hooks';
import { MatrixChart } from '@/components/insights/matrix-chart';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';

/**
 * Set-Piece & Discipline matrix — the CONTROL read to the Landscape's
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
    <View style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Set-Piece & Discipline</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the set-piece and discipline matrix">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
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

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set-Piece & Discipline</Text>
              <Pressable onPress={() => setInfoOpen(false)} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={Colors.light.text} />
              </Pressable>
            </View>
            <Text style={styles.modalBody}>
              The control matrix: <Text style={styles.modalStrong}>combined scrum and
              lineout success</Text> left to right, <Text style={styles.modalStrong}>
              penalties conceded per game</Text> bottom to top (higher on the chart =
              cleaner). Crosshairs at the pool medians; this team is the green dot.
              Last-10 window, like every read in the app.
            </Text>
            <Text style={styles.modalBody}>
              <Text style={styles.modalStrong}>Controlled</Text> sides (top right) own
              their platform and give nothing away: Test rugby's blueprint.{' '}
              <Text style={styles.modalStrong}>Tidy</Text> sides stay clean but can't
              rely on their own ball. <Text style={styles.modalStrong}>Heavy-Handed</Text>{' '}
              packs win the platform but bleed penalties doing it.{' '}
              <Text style={styles.modalStrong}>Under Siege</Text> means feeding
              opponents both possession and position, and the scoreboard usually
              follows.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
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
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
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
