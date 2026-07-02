import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, FlagSize, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useT1Momentum, type TeamMomentumSummary } from '@/hooks/use-t1-momentum';

const HORIZONTAL_MARGIN = 40; // Aligns with card sections on Home / Fixtures.
const MOVERS_PER_SIDE = 3;

const UP_COLOR = '#059669';
const DOWN_COLOR = StatusColor.live;

/**
 * Horizontal strip of biggest momentum movers across Tier 1 — top-N positive
 * and top-N negative teams by weighted momentum. Each tile is tappable and
 * drills into that team's Insights detail page. Above-the-fold on the
 * Insights landing, so it doubles as the tab's opening hook.
 */
export function MoversStrip() {
  const router = useRouter();
  const { data, isLoading } = useT1Momentum();
  const [infoOpen, setInfoOpen] = useState(false);

  const { risers, fallers } = useMemo(() => {
    const sortable = data.filter((t) => t.team && t.points.length > 0);
    const sorted = [...sortable].sort((a, b) => b.momentum - a.momentum);
    const positives = sorted.filter((t) => t.momentum > 0).slice(0, MOVERS_PER_SIDE);
    const negatives = sorted
      .filter((t) => t.momentum < 0)
      .slice(-MOVERS_PER_SIDE)
      .reverse(); // Worst momentum first inside the fallers group.
    return { risers: positives, fallers: negatives };
  }, [data]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerLabel}>Movers</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain Movers">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
        <Text style={styles.headerSubtitle}>Biggest momentum shifts across Tier 1</Text>
      </View>

      {isLoading && data.every((t) => !t.team) ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollRow}>
          {risers.map((t) => (
            <MoverTile
              key={`up-${t.teamId}`}
              summary={t}
              onPress={() => router.push(`/insights/${t.teamId}`)}
            />
          ))}
          {risers.length > 0 && fallers.length > 0 ? <View style={styles.divider} /> : null}
          {fallers.map((t) => (
            <MoverTile
              key={`down-${t.teamId}`}
              summary={t}
              onPress={() => router.push(`/insights/${t.teamId}`)}
            />
          ))}
        </ScrollView>
      )}

      <MoversInfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />
    </View>
  );
}

function MoverTile({
  summary,
  onPress,
}: {
  summary: TeamMomentumSummary;
  onPress: () => void;
}) {
  const isUp = summary.momentum > 0;
  const color = isUp ? UP_COLOR : DOWN_COLOR;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}>
      <View style={styles.tileHead}>
        {summary.team ? (
          <TeamFlagBall2D flagCode={summary.team.flag_code} size={FlagSize.medium} />
        ) : null}
        <Text style={styles.tileName} numberOfLines={1}>
          {summary.team?.short_name ?? summary.teamId.toUpperCase()}
        </Text>
      </View>
      <View style={styles.tileMomentum}>
        <Ionicons
          name={isUp ? 'arrow-up' : 'arrow-down'}
          size={14}
          color={color}
        />
        <Text style={[styles.tileMomentumText, { color }]}>
          {isUp ? '+' : ''}
          {summary.momentum}
        </Text>
      </View>
    </Pressable>
  );
}

function MoversInfoModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>How to read Movers</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            <Text style={styles.modalStrong}>Movers</Text> ranks Tier-1 teams by
            their <Text style={styles.modalStrong}>recency-weighted momentum
            score</Text> — the same measure used on the Home My-Team card. The
            most recent match counts 1.0×, the previous 0.8×, then 0.6×, 0.4×,
            0.2× across the last five completed fixtures.
          </Text>
          <Text style={styles.modalBody}>
            Tiles on the left are trending up (positive momentum ▲), tiles on
            the right are trending down (negative momentum ▼). Tap any tile to
            open that team's full Insights profile.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  header: {
    paddingHorizontal: HORIZONTAL_MARGIN,
    gap: 2,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  empty: {
    paddingHorizontal: HORIZONTAL_MARGIN,
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
  },
  scrollRow: {
    paddingHorizontal: HORIZONTAL_MARGIN,
    gap: Spacing.two,
    alignItems: 'stretch',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginHorizontal: Spacing.one,
  },
  tile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    minWidth: 120,
    gap: Spacing.one,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  tileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  tileName: {
    fontSize: TextSize.md,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.text,
  },
  tileMomentum: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tileMomentumText: {
    fontSize: TextSize.md,
    fontWeight: TextWeight.bold,
    fontVariant: ['tabular-nums'],
  },

  // Modal
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
