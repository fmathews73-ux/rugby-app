import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { usePlayer } from '@/api/hooks';
import { Colors, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { usePlayerAggregate, type PlayerStatField } from '@/hooks/use-player-aggregate';
import { usePlayerMatchStats } from '@/hooks/use-player-match-stats';
import { POSITION_LABELS } from '@/lib/player-roles';

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
  /** Hide the row when this match's value AND the baseline are both
   *  zero — keeps non-kickers' sheets free of empty goal-kicking rows
   *  without ever hiding a real datapoint. */
  hideWhenZero?: boolean;
}

/** Full feed sheet, grouped in the app's category order. */
const SHEET_SECTIONS: readonly { label: string; metrics: readonly SheetMetric[] }[] = [
  {
    label: 'Attack',
    metrics: [
      { field: 'points', label: 'Points' },
      { field: 'tries', label: 'Tries' },
      { field: 'try_assists', label: 'Try assists' },
      { field: 'carries', label: 'Carries' },
      { field: 'metres_carried', label: 'Metres carried' },
      { field: 'clean_breaks', label: 'Clean breaks' },
      { field: 'defenders_beaten', label: 'Defenders beaten' },
      { field: 'offloads', label: 'Offloads' },
      { field: 'passes', label: 'Passes' },
    ],
  },
  {
    label: 'Kicking',
    metrics: [
      { field: 'kicks_from_hand', label: 'Kicks from hand' },
      { field: 'kick_metres', label: 'Kick metres' },
      { field: 'conversions', label: 'Conversions', hideWhenZero: true },
      { field: 'penalty_goals', label: 'Penalty goals', hideWhenZero: true },
      { field: 'drop_goals', label: 'Drop goals', hideWhenZero: true },
    ],
  },
  {
    label: 'Defence & Breakdown',
    metrics: [
      { field: 'tackles_made', label: 'Tackles' },
      { field: 'missed_tackles', label: 'Missed tackles', inverted: true },
      { field: 'turnovers_won', label: 'Turnovers won' },
      { field: 'rucks_hit', label: 'Rucks hit' },
      { field: 'lineout_takes', label: 'Lineout takes', hideWhenZero: true },
      { field: 'lineout_steals', label: 'Lineout steals', hideWhenZero: true },
    ],
  },
  {
    label: 'Discipline',
    metrics: [
      { field: 'handling_errors', label: 'Handling errors', inverted: true },
      { field: 'penalties_conceded', label: 'Penalties conceded', inverted: true },
      { field: 'yellow_cards', label: 'Yellow cards', inverted: true, hideWhenZero: true },
      { field: 'red_cards', label: 'Red cards', inverted: true, hideWhenZero: true },
    ],
  },
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
  const [infoOpen, setInfoOpen] = useState(false);
  const open = playerId !== null;
  const pid = playerId ?? '';

  const player = usePlayer(pid);
  const sheet = usePlayerMatchStats(fixture.id, pid);
  // Baseline frozen at THIS fixture's kickoff — the norm the player
  // carried into the match, not one polluted by the match itself.
  const baseline = usePlayerAggregate(pid, fixture.kickoff_utc, BASELINE_LOOKBACK);

  const sections = useMemo(() => {
    if (!sheet.data) return [];
    const base = baseline.data;
    return SHEET_SECTIONS.map((section) => ({
      label: section.label,
      rows: section.metrics
        .map((m) => {
          const value = sheet.data![m.field];
          const norm = base && base.appearances > 0 ? base.perGame[m.field] : null;
          if (m.hideWhenZero && value === 0 && (norm === null || norm < 0.05)) return null;
          let variance: { direction: 'up' | 'down'; label: string; good: boolean } | null = null;
          // Chips mark MATERIAL departures only (±15%); rows in line
          // with the norm stay quiet — flat markers were tried and
          // dropped as noise. A value appearing against a zero norm is
          // always material.
          if (norm !== null) {
            const label = `vs ${norm.toFixed(1)}`;
            const higherIsGood = !m.inverted;
            if (norm > 0 && Math.abs(value / norm - 1) >= VARIANCE_THRESHOLD) {
              const direction = value > norm ? 'up' : 'down';
              variance = { direction, label, good: direction === 'up' ? higherIsGood : !higherIsGood };
            } else if (norm === 0 && value > 0) {
              variance = { direction: 'up', label, good: higherIsGood };
            }
          }
          return { ...m, value, variance };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
    })).filter((s) => s.rows.length > 0);
  }, [sheet.data, baseline.data]);

  const position = player.data ? POSITION_LABELS[player.data.primary_position] : null;
  // No appearances before this kickoff = no norm to compare against
  // (first sheet in the window). Say so explicitly rather than showing
  // bare rows — we never invent a baseline.
  const noBaseline =
    !baseline.isLoading && (baseline.data?.appearances ?? 0) === 0;
  const minutesLine = sheet.data
    ? `${position ? `${position} · ` : ''}${sheet.data.minutes_played}' · ${sheet.data.started ? 'started' : 'off the bench'}`
    : (position ?? null);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Backdrop sits BEHIND the sheet as its own layer — wrapping
            the sheet in a Pressable stole the ScrollView's responder
            and killed scrolling. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            {/* Same anonymous person glyph as the header profile, squad
                rows and player hero. */}
            <Ionicons
              name="person-circle-outline"
              size={40}
              color={Colors.light.textSecondary}
              style={styles.avatar}
            />
            <View style={styles.headerText}>
              <View style={styles.nameRow}>
                <Text style={styles.playerName}>{player.data?.name ?? ''}</Text>
                <Pressable
                  onPress={() => setInfoOpen(true)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Explain the match stat sheet">
                  <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
                </Pressable>
              </View>
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
            <>
              {noBaseline ? (
                <Text style={styles.noBaselineNote}>
                  First appearance in the window — variance chips appear once a
                  pre-match baseline exists.
                </Text>
              ) : null}
            <ScrollView style={styles.statScroll} showsVerticalScrollIndicator={false}>
              {sections.map((section) => (
                <View key={section.label} style={styles.statSection}>
                  <Text style={styles.sectionMiniLabel}>{section.label}</Text>
                  {section.rows.map((r) => (
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
              ))}
            </ScrollView>
            </>
          )}

          <Pressable
            onPress={() => {
              onClose();
              router.push(`/teams/player/${pid}`);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.profilePill, pressed && { opacity: 0.8 }]}>
            <Text style={styles.profilePillText}>View Profile</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.infoBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={styles.infoCard} onPress={() => {}}>
            <View style={styles.infoHeader}>
              <Text style={styles.infoTitle}>Match Stat Sheet</Text>
              <Pressable onPress={() => setInfoOpen(false)} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={Colors.light.text} />
              </Pressable>
            </View>
            <Text style={styles.infoBody}>
              This player&apos;s full stat line from this match, grouped the same
              way as the team stats. The coloured chip compares each number
              against <Text style={styles.infoStrong}>the per-game norm the
              player carried into this match</Text> (their previous {BASELINE_LOOKBACK}{' '}
              appearances, frozen at kickoff) — ↑ above their norm, ↓ below it,
              green when the move is good, red when it isn&apos;t. Rows without
              a chip are within 15% of the norm: a normal day at the office.
            </Text>
            <Text style={styles.infoBody}>
              Goal-kicking, cards and lineout rows hide when they carry nothing.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  avatar: { alignSelf: 'center' },
  headerText: { gap: 2, flexShrink: 1, flex: 1 },
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noBaselineNote: {
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
  },
  // Sheet body scrolls — the full grouped stat line outgrows a fixed
  // sheet; capped so the grabber + profile link stay in reach.
  statScroll: {
    marginTop: Spacing.one,
    maxHeight: 420,
  },
  statSection: {
    marginBottom: Spacing.two,
  },
  sectionMiniLabel: {
    fontSize: 10,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
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
  // Black pill CTA — same active-pill grammar as the tab strips.
  profilePill: {
    alignSelf: 'center',
    backgroundColor: Colors.light.text,
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    marginTop: Spacing.one,
  },
  profilePillText: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    color: Colors.light.background,
    letterSpacing: TextTracking.wide,
  },
  infoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  infoCard: {
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
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoTitle: {
    fontSize: TextSize.lg,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
  },
  infoBody: {
    fontSize: TextSize.sm,
    color: Colors.light.text,
    lineHeight: 20,
  },
  infoStrong: {
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
  },
});
