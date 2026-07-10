import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueries } from '@tanstack/react-query';

import type { Fixture, Team } from '@rugby-app/shared';

import { fetchJson } from '@/api/client';
import { useLatestRanking, useSeasons, useTeams } from '@/api/hooks';
import { CompetitionPicker } from '@/components/competition-picker';
import { FadingFlatList } from '@/components/fading-scroll-view';
import { PageGradient } from '@/components/page-gradient';
import { TeamHeroRow } from '@/components/team-hero-row';
import { ErrorState, LoadingState } from '@/components/state-views';
import { PAGE_BOTTOM_INSET, Colors, Spacing, TextSize, TextTracking } from '@/constants/theme';
import { useMyTeamId } from '@/hooks/use-my-team-id';

import { TIER_1_IDS } from '@/lib/tiers';

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
  // team's current rank (and points, for the My Team hero row).
  const rankings = useLatestRanking();
  const rankRowByTeam = useMemo(() => {
    const m = new Map<string, { rank: number; points: number }>();
    for (const row of rankings.data?.rows ?? []) m.set(row.team_id, { rank: row.rank, points: row.points });
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
      const ra = rankRowByTeam.get(a.id)?.rank ?? Number.MAX_SAFE_INTEGER;
      const rb = rankRowByTeam.get(b.id)?.rank ?? Number.MAX_SAFE_INTEGER;
      return ra !== rb ? ra - rb : a.name.localeCompare(b.name);
    };

    // Competition filter → one card, that competition's nations by rank.
    if (filter !== ALL_FILTER) {
      const members = query.data.filter((t) => competitionTeamIds.has(t.id)).sort(byRank);
      return [
        { label: FILTER_CARD_TITLES[filter] ?? 'Competition', teams: members },
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
    if (myTeam) out.push({ label: 'My Team', teams: [myTeam] });
    out.push({ label: 'Tier 1 Nations', teams: tier1 });
    out.push({ label: 'Tier 2 Nations', teams: tier2 });
    return out;
  })();

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      <PageGradient />
      <CompetitionPicker options={TEAM_FILTERS} selected={filter} onSelect={setFilter} />
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} />
      ) : (
        <FadingFlatList
          data={groups}
          keyExtractor={(g) => g.label}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: group }) => (
            <View style={styles.card}>
              {/* Title sits INSIDE the card — same header treatment as
                  the Fixtures day cards. */}
              <View style={styles.cardHeader}>
                <Text style={styles.cardHeaderText}>{group.label}</Text>
              </View>
              <View style={styles.insetDivider} />
              {/* Every row carries the shared hero-row grammar — same
                  layout as the Home Team Selector and picker rows. */}
              {group.teams.map((t, i) => (
                <Fragment key={t.id}>
                <Pressable
                  onPress={() => router.push(`/teams/${t.id}`)}
                  style={({ pressed }) => [styles.teamRow, pressed && styles.teamRowPressed]}>
                  <TeamHeroRow
                    team={t}
                    rankRow={rankRowByTeam.get(t.id)}
                    right={<Ionicons name="chevron-forward" size={16} color="#C7CBD1" />}
                  />
                </Pressable>
                {i < group.teams.length - 1 ? <View style={styles.insetDivider} /> : null}
                </Fragment>
              ))}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  listContent: {
    paddingHorizontal: Spacing.four,
    // 8pt drop from the pill strip's hairline — matches Home's
    // header-to-hero gap and the Fixtures / Standings pages.
    paddingTop: Spacing.two,
    paddingBottom: PAGE_BOTTOM_INSET,
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
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  // Standalone inset divider — chevron-chrome grey, 16pt side inset
  // (same as the picker / fixtures day cards).
  insetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C7CBD1',
    marginHorizontal: Spacing.three,
  },
  cardHeaderText: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },

  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    // Fixture-row geometry: same 16pt vertical padding.
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  teamRowPressed: { backgroundColor: Colors.light.backgroundElement },
});
