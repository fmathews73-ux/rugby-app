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

import { useLatestRanking, useTeams } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, Spacing } from '@/constants/theme';

const ACCENT = '#4F46E5';
const UP = '#059669';
const DOWN = '#DC2626';

/** Matches Home's `HORIZONTAL_MARGIN` — used per-page inside the carousel so
 * both pages align to the centre carousel card above. */
const PAGE_HORIZONTAL_MARGIN = 40;

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
          <MensRankingsCard />
        </View>
        <View style={[styles.page, { width: screenWidth }]}>
          <WomensPlaceholderCard />
        </View>
      </ScrollView>

      <View style={styles.dotsRow}>
        <View style={[styles.dot, activeIdx === 0 ? styles.dotActive : styles.dotInactive]} />
        <View style={[styles.dot, activeIdx === 1 ? styles.dotActive : styles.dotInactive]} />
      </View>
    </View>
  );
}

// ─── Men's card ──────────────────────────────────────────────────────────────

function MensRankingsCard() {
  const router = useRouter();
  const ranking = useLatestRanking();
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
        <Text style={styles.genderLabel}>Men</Text>
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
                  <TeamFlagBall2D flagCode={team.flag_code} size={22} />
                ) : (
                  <View style={styles.flagFallback} />
                )}
                <Text style={styles.teamName} numberOfLines={1}>
                  {team?.name ?? row.team_id.toUpperCase()}
                </Text>
                <Text style={styles.points}>{row.points}</Text>
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
        <Ionicons name="chevron-forward" size={16} color={ACCENT} />
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

// ─── Women's placeholder ─────────────────────────────────────────────────────

function WomensPlaceholderCard() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>World Rugby Rankings</Text>
        <Text style={styles.genderLabel}>Women</Text>
      </View>

      <View style={styles.placeholderBody}>
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>COMING SOON</Text>
        </View>
        <Text style={styles.placeholderText}>
          Women’s internationals are a future scope expansion (PRD register #3).
          The pipeline’s adapter model already supports a second ranking source
          — plug in the women’s data whenever it’s in scope.
        </Text>
      </View>
    </View>
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
    shadowOpacity: 0.05,
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
  title: { fontSize: 16, fontWeight: '700', color: Colors.light.text },
  genderLabel: {
    fontSize: 16,
    fontWeight: '300',
    color: Colors.light.textSecondary,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
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
  rank: { width: 18, fontSize: 14, fontWeight: '700', color: Colors.light.text },
  flagFallback: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E5E7EB' },
  teamName: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.light.text },
  points: { width: 40, textAlign: 'right', fontSize: 13, fontWeight: '700', color: Colors.light.text },
  movement: { width: 52, textAlign: 'right', fontSize: 12, fontWeight: '700' },
  movementUp: { color: UP },
  movementDown: { color: DOWN },
  movementFlat: { width: 52, textAlign: 'right', fontSize: 14, color: Colors.light.textSecondary },
  movementNew: {
    width: 52,
    textAlign: 'right',
    fontSize: 10,
    fontWeight: '700',
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
  footerText: { fontSize: 13, fontWeight: '700', color: ACCENT, letterSpacing: 0.2 },

  placeholderBody: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  comingSoonBadge: {
    borderWidth: 1,
    borderColor: ACCENT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  comingSoonText: { color: ACCENT, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  placeholderText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: Spacing.three,
  },
  dot: { width: 8, height: 8, borderRadius: 999 },
  dotActive: { backgroundColor: ACCENT },
  dotInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
});
