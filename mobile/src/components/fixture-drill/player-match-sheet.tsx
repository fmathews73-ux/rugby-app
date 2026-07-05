import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { usePlayer } from '@/api/hooks';
import { Colors, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { usePlayerAggregate, type PlayerStatField } from '@/hooks/use-player-aggregate';
import { usePlayerMatchStats } from '@/hooks/use-player-match-stats';

const BASELINE_LOOKBACK = 10;
/** Same materiality threshold as the Analysis card's baseline callouts. */
const VARIANCE_THRESHOLD = 0.15;
const GOOD_COLOR = '#059669';
const BAD_COLOR = StatusColor.live;

interface SheetMetric {
  field: PlayerStatField;
  label: string;
  /** Lower is better — flips the variance chip's good/bad colouring. */
  inverted?: boolean;
}

const SHEET_METRICS: readonly SheetMetric[] = [
  { field: 'points', label: 'Points' },
  { field: 'tries', label: 'Tries' },
  { field: 'carries', label: 'Carries' },
  { field: 'metres_carried', label: 'Metres carried' },
  { field: 'clean_breaks', label: 'Clean breaks' },
  { field: 'defenders_beaten', label: 'Defenders beaten' },
  { field: 'offloads', label: 'Offloads' },
  { field: 'tackles_made', label: 'Tackles' },
  { field: 'turnovers_won', label: 'Turnovers won' },
  { field: 'penalties_conceded', label: 'Penalties conceded', inverted: true },
];

/**
 * Match-scoped player sheet — bottom-sheet modal opened by tapping a
 * player row on the fixture Line-Up. Shows this match's stat line with
 * variance chips against the player's prev-10 baseline WALKING INTO
 * this match (aggregate frozen at kickoff), so "8 carries · ↓ vs 11.2"
 * reads as today-vs-their-norm. Links through to the full trend-scoped
 * player card under the Teams tab.
 *
 * Stat sheets exist for completed fixtures only — live matches show an
 * explanatory empty state until full-time.
 */
export function PlayerMatchSheet({
  fixture,
  playerId,
  onClose,
}: {
  fixture: Fixture;
  /** Null = sheet closed. */
  playerId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const open = playerId !== null;
  const pid = playerId ?? '';

  const player = usePlayer(pid);
  const sheet = usePlayerMatchStats(fixture.id, pid);
  // Baseline frozen at THIS fixture's kickoff — the norm the player
  // carried into the match, not one polluted by the match itself.
  const baseline = usePlayerAggregate(pid, fixture.kickoff_utc, BASELINE_LOOKBACK);

  const rows = useMemo(() => {
    if (!sheet.data) return [];
    const base = baseline.data;
    return SHEET_METRICS.map((m) => {
      const value = sheet.data![m.field];
      const norm = base && base.appearances > 0 ? base.perGame[m.field] : null;
      let variance: { direction: 'up' | 'down'; label: string; good: boolean } | null = null;
      if (norm !== null && norm > 0) {
        const ratio = value / norm;
        if (Math.abs(ratio - 1) >= VARIANCE_THRESHOLD) {
          const direction = ratio > 1 ? 'up' : 'down';
          const higherIsGood = !m.inverted;
          variance = {
            direction,
            label: `vs ${norm.toFixed(1)}`,
            good: direction === 'up' ? higherIsGood : !higherIsGood,
          };
        }
      }
      return { ...m, value, variance };
    });
  }, [sheet.data, baseline.data]);

  const minutesLine = sheet.data
    ? `${sheet.data.minutes_played}' · ${sheet.data.started ? 'started' : 'off the bench'}`
    : null;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop backdrop-tap from closing when tapping the sheet body. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.playerName}>{player.data?.name ?? ''}</Text>
              {minutesLine ? <Text style={styles.minutes}>{minutesLine}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>

          {sheet.isLoading || baseline.isLoading ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : !sheet.data ? (
            <Text style={styles.empty}>
              Match stat line populates at full-time.
            </Text>
          ) : (
            <View style={styles.statList}>
              {rows.map((r) => (
                <View key={r.field} style={styles.statRow}>
                  <Text style={styles.statLabel}>{r.label}</Text>
                  <View style={styles.statRight}>
                    <Text style={styles.statValue}>{formatValue(r.value)}</Text>
                    {r.variance ? (
                      <Text
                        style={[
                          styles.varianceChip,
                          { color: r.variance.good ? GOOD_COLOR : BAD_COLOR },
                        ]}>
                        {r.variance.direction === 'up' ? '↑' : '↓'} {r.variance.label}
                      </Text>
                    ) : (
                      <View style={styles.varianceSpacer} />
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          <Pressable
            onPress={() => {
              onClose();
              router.push(`/teams/player/${pid}`);
            }}
            style={({ pressed }) => [styles.profileLink, pressed && { opacity: 0.6 }]}>
            <Text style={styles.profileLinkText}>View full profile</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.light.text} />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function formatValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four + Spacing.three,
    gap: Spacing.two,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: Spacing.one,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerText: { gap: 2, flexShrink: 1 },
  playerName: {
    fontSize: TextSize.lg,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
  },
  minutes: {
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.four,
    textAlign: 'center',
  },
  statList: {
    marginTop: Spacing.one,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  statLabel: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  statRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  statValue: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
    minWidth: 32,
    textAlign: 'right',
  },
  // Fixed-width variance slot so values align in a column whether or
  // not a row carries a chip.
  varianceChip: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    fontVariant: ['tabular-nums'],
    width: 74,
  },
  varianceSpacer: { width: 74 },
  profileLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.two,
    marginTop: Spacing.one,
  },
  profileLinkText: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.semibold,
    color: Colors.light.text,
    letterSpacing: TextTracking.wide,
  },
});
