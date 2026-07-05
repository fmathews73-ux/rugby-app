import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useLatestRanking, useLatestWomensRanking, useTeams } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, FlagSize, ScoreBoxSize, Spacing, TextSize, TextWeight } from '@/constants/theme';

const UP = '#059669';
const DOWN = '#DC2626';

/** App-wide 24pt card column — used per-page inside the carousel so
 * both pages align to the centre carousel card above. */
const PAGE_HORIZONTAL_MARGIN = Spacing.four;

/**
 * Two-page paged carousel: Men's rankings + Women's placeholder.
 *
 * PRD register #3 (v0.4) resolved v1 scope to Men's only, so the women's
 * page is a "coming soon" placeholder — the shape is ready, real data
 * plugs in when scope expands.
 */
export function HomeRankingsCarousel() {
  const { width: screenWidth } = useWindowDimensions();
  const [activeIdx, setActiveIdx] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    if (idx !== activeIdx && (idx === 0 || idx === 1)) setActiveIdx(idx);
  };

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}>
        <View style={[styles.page, { width: screenWidth }]}>
          <RankingsCard gender="mens" />
        </View>
        <View style={[styles.page, { width: screenWidth }]}>
          <RankingsCard gender="womens" />
        </View>
      </ScrollView>

      <View style={styles.dotsRow}>
        <View style={[styles.dot, activeIdx === 0 ? styles.dotActive : styles.dotInactive]} />
        <View style={[styles.dot, activeIdx === 1 ? styles.dotActive : styles.dotInactive]} />
      </View>
    </View>
  );
}

// ─── Shared rankings card ────────────────────────────────────────────────────
// Same card shape for both genders — only the data source and the gender label
// differ. Register #3 (v0.4) originally limited scope to Men's; flipped
// 2026-07-02 to include Women's alongside.

function RankingsCard({ gender }: { gender: 'mens' | 'womens' }) {
  const router = useRouter();
  const mensRanking = useLatestRanking();
  const womensRanking = useLatestWomensRanking();
  const ranking = gender === 'mens' ? mensRanking : womensRanking;
  const genderLabel = gender === 'mens' ? 'Men' : 'Women';
  const teams = useTeams();

  const teamById = useMemo(
    () =>
      new Map(
        (teams.data ?? []).map((t) => [
          t.id,
          { name: t.name, short_name: t.short_name, flag_code: t.flag_code },
        ]),
      ),
    [teams.data],
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>World Rugby Rankings</Text>
        <Text style={styles.genderLabel}>{genderLabel}</Text>
      </View>

      {ranking.isLoading ? (
        <LoadingState />
      ) : ranking.isError ? (
        <ErrorState error={ranking.error} />
      ) : ranking.data ? (
        <View style={styles.list}>
          {ranking.data.rows.slice(0, 5).map((row) => {
            const team = teamById.get(row.team_id);
            return (
              <View key={row.team_id} style={styles.row}>
                <Text style={styles.rank}>{row.rank}</Text>
                {team ? (
                  <TeamFlagBall2D flagCode={team.flag_code} size={FlagSize.row} />
                ) : (
                  <View style={styles.flagFallback} />
                )}
                <Text style={styles.teamName} numberOfLines={1}>
                  {team?.name ?? row.team_id.toUpperCase()}
                </Text>
                <View style={styles.pointsBox}>
                  <Text style={styles.pointsBoxText}>{row.points}</Text>
                </View>
                <MovementBadge movement={row.movement} />
              </View>
            );
          })}
        </View>
      ) : null}

      <Pressable
        onPress={() => router.push('/rankings')}
        style={({ pressed }) => [styles.footer, pressed && styles.footerPressed]}>
        <Text style={styles.footerText}>See all rankings</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.light.text} />
      </Pressable>
    </View>
  );
}

function MovementBadge({ movement }: { movement: number | null }) {
  if (movement === null) {
    return <Text style={styles.movementNew}>NEW</Text>;
  }
  if (movement === 0) {
    return <Text style={styles.movementFlat}>—</Text>;
  }
  const isUp = movement > 0;
  return (
    <Text style={[styles.movement, isUp ? styles.movementUp : styles.movementDown]}>
      {isUp ? '▲' : '▼'} {Math.abs(movement)}
    </Text>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: PAGE_HORIZONTAL_MARGIN,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.four,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: { fontSize: TextSize.lg, fontWeight: TextWeight.bold, color: Colors.light.text },
  genderLabel: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.regular,
    color: Colors.light.textSecondary,
  },
  subtitle: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.semibold,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },

  list: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  rank: { width: 18, fontSize: TextSize.md, fontWeight: TextWeight.bold, color: Colors.light.text, fontVariant: ['tabular-nums'] },
  flagFallback: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E5E7EB' },
  teamName: { flex: 1, fontSize: TextSize.md, fontWeight: TextWeight.semibold, color: Colors.light.text },
  // Styled to match the winner-score box on the Fixtures list — solid dark
  // tile with white number, 24pt tall, 4pt radius. Reads as the "hero"
  // number in the row, consistent with the "winning score" affordance
  // elsewhere in the app.
  pointsBox: {
    ...ScoreBoxSize.row,
    backgroundColor: Colors.light.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsBoxText: {
    fontSize: TextSize.md,
    fontWeight: TextWeight.bold,
    color: Colors.light.textInverse,
    fontVariant: ['tabular-nums'],
  },
  movement: { width: 52, textAlign: 'right', fontSize: TextSize.sm, fontWeight: TextWeight.bold, fontVariant: ['tabular-nums'] },
  movementUp: { color: UP },
  movementDown: { color: DOWN },
  movementFlat: { width: 52, textAlign: 'right', fontSize: TextSize.md, color: Colors.light.textSecondary },
  movementNew: {
    width: 52,
    textAlign: 'right',
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: Spacing.two,
  },
  footerPressed: { opacity: 0.5 },
  footerText: { fontSize: TextSize.sm, fontWeight: TextWeight.bold, color: Colors.light.text },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: Spacing.three,
  },
  dot: { width: 6, height: 6, borderRadius: 999 },
  dotActive: { backgroundColor: Colors.light.textSecondary },
  dotInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.light.textSecondary,
  },
});
