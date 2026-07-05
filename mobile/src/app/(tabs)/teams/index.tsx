import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueries } from '@tanstack/react-query';

import type { Fixture, Team } from '@rugby-app/shared';

import { fetchJson } from '@/api/client';
import { useLatestRanking, useSeasons, useTeams } from '@/api/hooks';
import { CompetitionPicker } from '@/components/competition-picker';
import { FormCircles } from '@/components/form-circles';
import { PageGradient } from '@/components/page-gradient';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, FlagSize, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useMyTeamId } from '@/hooks/use-my-team-id';
import { useTeamRecentForm } from '@/hooks/use-team-recent-form';
import { worldCupTitles } from '@/lib/world-cup-titles';

const TIER_1_IDS = new Set(['eng', 'fra', 'ire', 'ita', 'sco', 'wal', 'arg', 'aus', 'nzl', 'rsa']);
const FORM_LOOKBACK = 5;

const ALL_FILTER = 'all';

// Same pill labels as the Fixtures strip so the two landing pages read
// as siblings. A competition pill filters the directory to that
// competition's participating nations.
const TEAM_FILTERS = [
  { id: ALL_FILTER, label: 'All' },
  { id: 'six-nations', label: 'Six Nations' },
  { id: 'rugby-championship', label: 'Rugby C’ship' },
  { id: 'summer-tests', label: 'Summer' },
  { id: 'autumn-tests', label: 'Autumn' },
  { id: 'rugby-europe-championship', label: 'Rugby Europe' },
  { id: 'pacific-nations-cup', label: 'Pacific Cup' },
  { id: 'world-cup', label: 'World Cup' },
] as const;

const FILTER_CARD_TITLES: Record<string, string> = {
  'six-nations': 'Six Nations',
  'rugby-championship': 'Rugby Championship',
  'summer-tests': 'Summer Tests',
  'autumn-tests': 'Autumn Nations Series',
  'rugby-europe-championship': 'Rugby Europe Championship',
  'pacific-nations-cup': 'Pacific Nations Cup',
  'world-cup': 'Rugby World Cup 2027',
};

interface TeamGroup {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  teams: Team[];
}

/**
 * Teams — all 28 international sides, split by tier and sorted by current
 * world ranking within tier (best first). The Home-screen My Team pick is
 * spotlighted above. Each group renders as ONE card with the title inside
 * — the same card grammar as the Fixtures day cards, so the two landing
 * pages read as siblings. Tap a row → team detail.
 */
export default function TeamsScreen() {
  const router = useRouter();
  const query = useTeams();
  const [myTeamId] = useMyTeamId();
  const [filter, setFilter] = useState<string>(ALL_FILTER);

  // Latest men's World Rugby snapshot — annotates each row with the
  // team's current rank, same as the Team Picker modal.
  const rankings = useLatestRanking();
  const rankByTeam = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of rankings.data?.rows ?? []) m.set(row.team_id, row.rank);
    return m;
  }, [rankings.data]);

  // Competition participants are derived from that competition's season
  // fixtures (home ∪ away across all its seasons) — no roster endpoint
  // needed, and the fixture queries share cache with the Fixtures tab.
  const seasons = useSeasons();
  const filterSeasonIds = useMemo(
    () =>
      filter === ALL_FILTER
        ? []
        : (seasons.data ?? []).filter((s) => s.competition_id === filter).map((s) => s.id),
    [seasons.data, filter],
  );
  const fixtureQueries = useQueries({
    queries: filterSeasonIds.map((sid) => ({
      queryKey: ['seasonFixtures', sid],
      queryFn: () => fetchJson<Fixture[]>(`/seasons/${sid}/fixtures`),
    })),
  });
  // Computed per render (not memoised): a handful of cached arrays and
  // ≤28 ids — cheaper than tracking useQueries' unstable identity.
  const competitionTeamIds = new Set<string>();
  for (const q of fixtureQueries) {
    for (const f of q.data ?? []) {
      competitionTeamIds.add(f.home_team_id);
      competitionTeamIds.add(f.away_team_id);
    }
  }

  const groups = ((): TeamGroup[] => {
    if (!query.data) return [];
    // Best world ranking first; unranked sides sink alphabetically.
    const byRank = (a: Team, b: Team) => {
      const ra = rankByTeam.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const rb = rankByTeam.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return ra !== rb ? ra - rb : a.name.localeCompare(b.name);
    };

    // Competition filter → one card, that competition's nations by rank.
    if (filter !== ALL_FILTER) {
      const members = query.data.filter((t) => competitionTeamIds.has(t.id)).sort(byRank);
      return [
        {
          label: FILTER_CARD_TITLES[filter] ?? 'Competition',
          icon: 'trophy-outline',
          teams: members,
        },
      ];
    }

    const tier1: Team[] = [];
    const tier2: Team[] = [];
    for (const t of query.data) {
      // My Team lives only in its spotlight group, not in its tier list.
      if (t.id === myTeamId) continue;
      (TIER_1_IDS.has(t.id) ? tier1 : tier2).push(t);
    }
    tier1.sort(byRank);
    tier2.sort(byRank);

    const myTeam = query.data.find((t) => t.id === myTeamId);
    const out: TeamGroup[] = [];
    if (myTeam) out.push({ label: 'My Team', icon: 'heart-outline', teams: [myTeam] });
    out.push({ label: 'Tier 1 Nations', icon: 'list-outline', teams: tier1 });
    out.push({ label: 'Tier 2 Nations', icon: 'list-outline', teams: tier2 });
    return out;
  })();

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
      <PageGradient />
      <CompetitionPicker options={TEAM_FILTERS} selected={filter} onSelect={setFilter} />
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.label}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: group }) => (
            <View style={styles.card}>
              {/* Title sits INSIDE the card — same header treatment as
                  the Fixtures day cards. */}
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderTitle}>
                  <Ionicons name={group.icon} size={12} color={Colors.light.textSecondary} />
                  <Text style={styles.cardHeaderText}>{group.label}</Text>
                </View>
              </View>
              {group.teams.map((t, i) => (
                <TeamRow
                  key={t.id}
                  team={t}
                  rank={rankByTeam.get(t.id)}
                  isLast={i === group.teams.length - 1}
                  onPress={() => router.push(`/teams/${t.id}`)}
                />
              ))}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

/**
 * One row in a group card. No chevron (fixture rows don't carry one
 * either) — the whole row is the tap target. Form circles + trophy
 * right-aligned; the fixed trophy slot keeps the circles on one vertical
 * column across rows.
 */
function TeamRow({
  team,
  rank,
  isLast,
  onPress,
}: {
  team: Team;
  rank: number | undefined;
  isLast: boolean;
  onPress: () => void;
}) {
  const { outcomes } = useTeamRecentForm(team.id, FORM_LOOKBACK);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.teamRow,
        !isLast && styles.teamRowDivider,
        pressed && styles.teamRowPressed,
      ]}>
      <TeamFlagBall2D flagCode={team.flag_code} size={FlagSize.medium} />
      <View style={styles.rowText}>
        <Text style={styles.rowShort}>{team.short_name}</Text>
        {rank !== undefined ? <Text style={styles.rowRank}>#{rank}</Text> : null}
      </View>
      <View style={styles.rowRight}>
        <FormCircles outcomes={outcomes} lookback={FORM_LOOKBACK} />
        <View style={styles.rowTrophySlot}>
          {worldCupTitles(team.id) > 0 ? (
            <View style={styles.rowTrophyBadge}>
              <Ionicons name="trophy" size={12} color={Colors.light.textSecondary} />
              <Text style={styles.rowTrophyCount}>X{worldCupTitles(team.id)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  listContent: {
    paddingHorizontal: Spacing.four,
    // 8pt drop from the pill strip's hairline — matches Home's
    // header-to-hero gap and the Fixtures / Standings pages.
    paddingTop: Spacing.two,
    paddingBottom: 40,
    gap: Spacing.three,
  },

  // Group card — identical grammar to the Fixtures day card: no inner
  // padding on the card itself so row divider hairlines span full width.
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  cardHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardHeaderText: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.semibold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },

  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 4,
    gap: Spacing.three,
  },
  teamRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  teamRowPressed: { backgroundColor: Colors.light.backgroundElement },

  rowText: {
    gap: 2,
    flexShrink: 1,
  },
  rowShort: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  rowRank: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  // Right-aligned cluster: form circles then the fixed-width trophy slot.
  rowRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.three,
  },
  rowTrophySlot: {
    width: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rowTrophyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rowTrophyCount: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
});
