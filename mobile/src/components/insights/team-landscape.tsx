import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';

import { useTeams, useTeamsFormSummary } from '@/api/hooks';
import { MatrixChart } from '@/components/insights/matrix-chart';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';

/**
 * Team Landscape — the strategy-matrix view of the international pool.
 * Every nation with completed matches is a dot: x = points scored per
 * game (attack), y = points conceded per game INVERTED (up = tighter
 * defence), crosshairs at the pool medians. Four quadrants tell you
 * what kind of side lives where; the subject team is highlighted so
 * the reader sees its neighbourhood, not just its numbers. Data comes
 * from the /teams/form-summary read-model (prev-10 window, one fetch
 * for the whole pool).
 */
export function TeamLandscape({
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
        x: s.points_scored_per_game,
        y: s.points_conceded_per_game,
      }));
  }, [summary.data, teams.data]);

  return (
    <View style={[styles.card, style]}>
      {/* Title left, utility info icon pinned right on the same line. */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Team Landscape</Text>
        <Pressable
          onPress={() => setInfoOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Explain the team landscape matrix">
          <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
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
          quadrants={{ tr: 'COMPLETE', tl: 'GRINDERS', br: 'ENTERTAINERS', bl: 'EXPOSED' }}
          xCaption="POINTS SCORED /GAME →"
          yCaption="TIGHTER DEFENCE →"
        />
      )}

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Team Landscape</Text>
              <Pressable onPress={() => setInfoOpen(false)} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={Colors.light.text} />
              </Pressable>
            </View>
            <Text style={styles.modalBody}>
              Every international side with completed matches, plotted on its last-10
              per-game numbers: <Text style={styles.modalStrong}>points scored</Text>{' '}
              left to right, <Text style={styles.modalStrong}>points conceded</Text>{' '}
              bottom to top (higher on the chart = tighter defence). The crosshairs
              sit at the pool medians, and this team is the green dot.
            </Text>
            <Text style={styles.modalBody}>
              The quadrants: <Text style={styles.modalStrong}>Complete</Text> sides
              (top right) score heavily and concede little. <Text style={styles.modalStrong}>
              Grinders</Text> (top left) win low-scoring arm-wrestles.{' '}
              <Text style={styles.modalStrong}>Entertainers</Text> (bottom right)
              outscore their own leaks. <Text style={styles.modalStrong}>Exposed</Text>{' '}
              (bottom left) are struggling at both ends. Where a team sits, and who
              its neighbours are, says more than either number alone.
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
