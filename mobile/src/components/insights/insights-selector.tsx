import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLatestRanking, useTeam } from '@/api/hooks';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, FlagSize, ScoreBoxSize, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';

const HORIZONTAL_MARGIN = 40;

/**
 * Team-selection row for the Insights page. Reuses the Fixtures list matchup
 * pattern — `[flag] [code] [score] FT [score] [code] [flag]` — but swaps in
 * ranks for the scores and "VS" for "FT". Each side is a tappable dropdown.
 *
 *   Left side  = primary team. Defaults to My Team.
 *   Right side = compare team. Empty state renders a grey flag placeholder
 *                + "ADD" code so the row looks like a full matchup with an
 *                unselected slot rather than a disparate button.
 */
export function InsightsSelector({
  primaryTeamId,
  compareTeamId,
  onOpenPrimaryPicker,
  onOpenComparePicker,
  onClearCompare,
}: {
  primaryTeamId: string | null;
  compareTeamId: string | null;
  onOpenPrimaryPicker: () => void;
  onOpenComparePicker: () => void;
  onClearCompare: () => void;
}) {
  const primary = useTeam(primaryTeamId ?? '');
  const compare = useTeam(compareTeamId ?? '');
  const ranking = useLatestRanking();

  const rankById = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of ranking.data?.rows ?? []) m.set(row.team_id, row.rank);
    return m;
  }, [ranking.data]);

  const primaryRank = primaryTeamId ? rankById.get(primaryTeamId) : undefined;
  const compareRank = compareTeamId ? rankById.get(compareTeamId) : undefined;
  const hasCompare = compareTeamId !== null && compare.data !== undefined;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.matchupRow}>
          {/* ─── Left side: primary team ─────────────────────────────────── */}
          <Pressable
            onPress={onOpenPrimaryPicker}
            style={({ pressed }) => [styles.side, pressed && styles.pressedFade]}
            accessibilityRole="button"
            accessibilityLabel={`Change primary team, currently ${primary.data?.name ?? 'not set'}`}>
            <View style={styles.flagWrap}>
              {primary.data ? (
                <TeamFlagBall2D flagCode={primary.data.flag_code} size={FlagSize.row} />
              ) : null}
            </View>
            <Text style={styles.teamCode}>
              {primary.data?.short_name ?? '—'}
            </Text>
          </Pressable>

          {/* ─── Middle slot: [rank] VS [rank] ───────────────────────────── */}
          <View style={styles.middleSlot}>
            <RankCard rank={primaryRank} />
            <Text style={styles.vsLabel}>VS</Text>
            <RankCard rank={compareRank} placeholder={!hasCompare} />
          </View>

          {/* ─── Right side: compare team OR ADD placeholder ─────────────── */}
          {hasCompare ? (
            <Pressable
              onPress={onOpenComparePicker}
              style={({ pressed }) => [styles.side, styles.sideRight, pressed && styles.pressedFade]}
              accessibilityRole="button"
              accessibilityLabel={`Change compare team, currently ${compare.data!.name}`}>
              <Text style={styles.teamCode}>{compare.data!.short_name}</Text>
              <View style={styles.flagWrap}>
                <TeamFlagBall2D flagCode={compare.data!.flag_code} size={FlagSize.row} />
              </View>
            </Pressable>
          ) : (
            <Pressable
              onPress={onOpenComparePicker}
              style={({ pressed }) => [styles.side, styles.sideRight, pressed && styles.pressedFade]}
              accessibilityRole="button"
              accessibilityLabel="Add compare team">
              <Text style={[styles.teamCode, styles.teamCodePlaceholder]}>ADD</Text>
              <View style={[styles.flagWrap, styles.flagPlaceholder]} />
            </Pressable>
          )}
        </View>

        {/* Clear compare — small dismiss chip pinned to the row's top-right
            edge when compare is set. Kept out of the matchup row so it
            doesn't disrupt the flag-to-flag symmetry. */}
        {hasCompare ? (
          <Pressable
            onPress={onClearCompare}
            hitSlop={10}
            style={styles.clear}
            accessibilityRole="button"
            accessibilityLabel="Reset compare team">
            <Ionicons name="refresh-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Small filled tile displaying a team's rank. Same shape as the Fixtures
 * list score box (`ScoreBoxSize.row`) but always dark-filled — a rank is
 * always the "winner" treatment. Placeholder variant is a subtle grey
 * dashed slot used when the compare side is empty.
 */
function RankCard({ rank, placeholder }: { rank: number | undefined; placeholder?: boolean }) {
  if (placeholder) {
    return (
      <View style={[styles.rankCard, styles.rankCardPlaceholder]}>
        <Text style={styles.rankCardTextPlaceholder}>—</Text>
      </View>
    );
  }
  return (
    <View style={styles.rankCard}>
      {rank ? (
        <Text style={styles.rankCardText}>
          <Text style={styles.rankCardHash}>#</Text>
          {rank}
        </Text>
      ) : (
        <Text style={styles.rankCardText}>—</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: HORIZONTAL_MARGIN,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    overflow: 'hidden',
  },

  // ─── Matchup row (mirrors Fixtures list) ────────────────────────────────
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  // Natural width (no flex:1), gap matching the matchupRow's gap, so the
  // flag → code → middle → code → flag chain sits at uniform 8pt spacing
  // just like the Fixtures list row.
  side: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // Right side keeps the same [code, flag] order as the fixtures row; no
  // extra justification needed since the side is now natural-width.
  sideRight: {},
  pressedFade: { opacity: 0.6 },

  flagWrap: {
    width: FlagSize.row,
    height: FlagSize.row,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Grey circular slot for the unselected compare team. Solid instead of
  // dashed so it reads as a filled placeholder, not a "missing" error.
  flagPlaceholder: {
    borderRadius: FlagSize.row / 2,
    backgroundColor: '#F3F4F6',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },

  teamCode: {
    width: 40,
    textAlign: 'center',
    fontSize: TextSize.md,
    fontWeight: TextWeight.semibold,
    color: Colors.light.text,
  },
  // "ADD" placeholder uses secondary text to signal it's a slot, not a team.
  teamCodePlaceholder: {
    color: Colors.light.textSecondary,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
  },

  // Fixed-width middle slot so the flags on either side stay at the same
  // horizontal position row-to-row — mirrors Fixtures list `middleCompleted`.
  middleSlot: {
    width: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  vsLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },

  // ─── Rank card (analogue of Fixtures score box) ─────────────────────────
  rankCard: {
    ...ScoreBoxSize.row,
    backgroundColor: Colors.light.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankCardText: {
    fontSize: TextSize.md,
    fontWeight: TextWeight.bold,
    color: Colors.light.textInverse,
    fontVariant: ['tabular-nums'],
  },
  // Smaller `#` prefix so the number reads as the primary character.
  rankCardHash: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.semibold,
  },
  rankCardPlaceholder: {
    backgroundColor: '#F3F4F6',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  rankCardTextPlaceholder: {
    fontSize: TextSize.md,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
  },

  // ─── Reset compare ─────────────────────────────────────────────────────
  // Tucked INSIDE the card's top-right corner when a compare team is set.
  // Same spec as the info-icon utility icon (design system §7) — 14pt icon,
  // textSecondary, no chrome — just absolutely positioned.
  clear: {
    position: 'absolute',
    top: Spacing.one + 2,
    right: Spacing.one + 2,
  },
});
