import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { MatchEvent, Player } from '@rugby-app/shared';

import { useFixtureEvents, useFixturePlayers, useTeam } from '@/api/hooks';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { TeamToggle, type ToggleSide } from '@/components/insights/team-toggle';

/**
 * Player Leaders — a broadcast-style "who led each category in this match"
 * grid. Deliberately opinion-free: no composite score, just the raw
 * per-category leader with their number. Toggle pill switches home ↔ away.
 *
 * The category list is designed to grow. When Opta stats land at Phase 6
 * cutover we can drop in tackles, turnovers, metres, line breaks, offloads,
 * try assists, kicks — each as one more `Category` descriptor in the array
 * below. See project memory [[project-rugby-data-provider]] for the full
 * Opta metric target list.
 */
export function PlayerLeaders({
  fixtureId,
  homeTeamId,
  awayTeamId,
}: {
  fixtureId: string;
  homeTeamId: string;
  awayTeamId: string;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [activeSide, setActiveSide] = useState<ToggleSide>('primary');

  useEffect(() => {
    setActiveSide('primary');
  }, [awayTeamId]);

  const events = useFixtureEvents(fixtureId);
  const players = useFixturePlayers(fixtureId);
  const homeTeam = useTeam(homeTeamId);
  const awayTeam = useTeam(awayTeamId);

  const activeTeamId = activeSide === 'primary' ? homeTeamId : awayTeamId;

  const leaders = useMemo(
    () => computeLeaders(events.data ?? [], activeTeamId, players.data ?? []),
    [events.data, activeTeamId, players.data],
  );

  const isLoading = events.isLoading || players.isLoading;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Player Leaders</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain Player Leaders">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
        <TeamToggle
          primaryLabel={homeTeam.data?.short_name ?? homeTeamId.toUpperCase()}
          compareLabel={awayTeam.data?.short_name ?? awayTeamId.toUpperCase()}
          activeSide={activeSide}
          onSelect={setActiveSide}
        />
      </View>

      {isLoading && leaders.length === 0 ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : leaders.length === 0 ? (
        <Text style={styles.empty}>No player-attributed events yet.</Text>
      ) : (
        <View style={styles.list}>
          {leaders.map((l) => (
            <View key={l.categoryId} style={styles.leaderRow}>
              <Text style={styles.categoryLabel}>{l.categoryLabel}</Text>
              <View style={styles.leaderBody}>
                <Text style={styles.value}>
                  {l.value}
                  <Text style={styles.suffix}>{' '}{l.suffix}</Text>
                </Text>
                <Text style={styles.playerName} numberOfLines={1}>
                  {l.playerName}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <InfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />
    </View>
  );
}

// ─── Category descriptors ────────────────────────────────────────────────────
// One entry per "leader in X" tile. Each descriptor pairs a label + suffix
// with an aggregation over player-attributed events.

interface Leader {
  categoryId: string;
  categoryLabel: string;
  playerName: string;
  value: number;
  suffix: string;
}

interface Category {
  id: string;
  label: string;
  suffix: string;
  compute: (events: readonly MatchEvent[], teamId: string) => { playerId: string; value: number } | null;
}

const CATEGORIES: readonly Category[] = [
  {
    id: 'scorer',
    label: 'Top Scorer',
    suffix: 'pts',
    compute: (events, teamId) =>
      topByAggregation(events, teamId, (e) => (e.points > 0 ? e.points : 0)),
  },
  {
    id: 'tackler',
    label: 'Top Tackler',
    suffix: 'tackles',
    compute: (events, teamId) =>
      topByAggregation(events, teamId, (e) => (e.type === 'tackle' ? 1 : 0)),
  },
  {
    id: 'carrier',
    label: 'Top Carrier',
    suffix: 'carries',
    compute: (events, teamId) =>
      topByAggregation(events, teamId, (e) => (e.type === 'carry' ? 1 : 0)),
  },
  {
    id: 'turnovers',
    label: 'Turnovers',
    suffix: 'turnovers',
    compute: (events, teamId) =>
      topByAggregation(events, teamId, (e) => (e.type === 'turnover-won' ? 1 : 0)),
  },
  {
    id: 'linebreaker',
    label: 'Line Breaks',
    suffix: 'breaks',
    compute: (events, teamId) =>
      topByAggregation(events, teamId, (e) => (e.type === 'line-break' ? 1 : 0)),
  },
  {
    id: 'try-assist',
    label: 'Try Assists',
    suffix: 'assists',
    compute: (events, teamId) =>
      topByAggregation(events, teamId, (e) => (e.type === 'try-assist' ? 1 : 0)),
  },
  {
    id: 'discipline',
    label: 'Most Penalised',
    suffix: 'cards',
    compute: (events, teamId) =>
      topByAggregation(events, teamId, (e) =>
        e.type === 'yellow-card' || e.type === 'red-card' ? 1 : 0,
      ),
  },
  // Still-awaiting-Opta categories worth wiring at cutover:
  //   Most Metres (per-carry gains + break metres)
  //   Kicking     (per-player kick-in-play metres)
];

function computeLeaders(
  events: readonly MatchEvent[],
  teamId: string,
  players: readonly Player[],
): Leader[] {
  const playerById = new Map(players.map((p) => [p.id, p]));
  const out: Leader[] = [];
  for (const cat of CATEGORIES) {
    const top = cat.compute(events, teamId);
    if (!top || top.value <= 0) continue;
    const p = playerById.get(top.playerId);
    out.push({
      categoryId: cat.id,
      categoryLabel: cat.label,
      playerName: p ? shortName(p.name) : '—',
      value: top.value,
      suffix: cat.suffix,
    });
  }
  return out;
}

/** Generic "top player by any per-event contribution" — pass a `scoreFn`
 *  that returns the contribution of one event for the aggregation. Skips
 *  events without a player attribution or the wrong team. */
function topByAggregation(
  events: readonly MatchEvent[],
  teamId: string,
  scoreFn: (event: MatchEvent) => number,
): { playerId: string; value: number } | null {
  const totals = new Map<string, number>();
  for (const e of events) {
    if (e.team_id !== teamId || !e.player_id) continue;
    const s = scoreFn(e);
    if (s <= 0) continue;
    totals.set(e.player_id, (totals.get(e.player_id) ?? 0) + s);
  }
  let bestId: string | null = null;
  let bestValue = 0;
  for (const [id, v] of totals) {
    if (v > bestValue) {
      bestValue = v;
      bestId = id;
    }
  }
  return bestId ? { playerId: bestId, value: bestValue } : null;
}

/** "Firstname Lastname" → "F. Lastname". */
function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? '—';
  return `${parts[0]!.charAt(0)}. ${parts[parts.length - 1]!}`;
}

function InfoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Player Leaders</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            The one player from the selected team who led each per-category
            statistic in this match. Deliberately raw — no composite score,
            no proprietary formula. Reads like a broadcast tracker.
          </Text>
          <View style={styles.modalDivider} />
          <Text style={styles.modalBody}>
            Seven categories in view: <Text style={styles.modalStrong}>Top Scorer</Text>,
            {' '}<Text style={styles.modalStrong}>Top Tackler</Text>,
            {' '}<Text style={styles.modalStrong}>Top Carrier</Text>,
            {' '}<Text style={styles.modalStrong}>Turnovers</Text>,
            {' '}<Text style={styles.modalStrong}>Line Breaks</Text>,
            {' '}<Text style={styles.modalStrong}>Try Assists</Text>,
            {' '}<Text style={styles.modalStrong}>Most Penalised</Text>.
            Two more (metres gained, kicking metres) light up when the real
            Opta feed lands at Phase 6 cutover.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.four,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.04,
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

  list: { gap: Spacing.two + 2 },
  // Row layout: category label left-aligned, player + value right-aligned.
  // Category label fixed-width so category-column edges align down the card.
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  categoryLabel: {
    width: 112,
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  leaderBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  playerName: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.semibold,
    color: Colors.light.text,
    flexShrink: 1,
  },
  value: {
    fontSize: TextSize.md,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },
  suffix: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.regular,
    color: Colors.light.textSecondary,
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
  modalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginVertical: Spacing.one,
  },
});
