import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueries } from '@tanstack/react-query';

import type { Fixture, MatchPrediction, Team } from '@rugby-app/shared';

import { fetchJson } from '@/api/client';
import { useSeasons, useTeams } from '@/api/hooks';
import { CardHeaderActions } from '@/components/card-header-actions';
import { INSUFFICIENT_INSIGHT, fitNarrative } from '@/lib/fit-narrative';
import { CardTitle } from '@/components/card-title';
import { CompetitionPicker } from '@/components/competition-picker';
import { FadeCard, NarrativeBack, BackStrong } from '@/components/narrative-flip-card';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-views';
import { FadingScrollView } from '@/components/fading-scroll-view';
import { PageGradient } from '@/components/page-gradient';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { PAGE_BOTTOM_INSET, Colors, FlagSize, ScoreBoxSize, ScoreBug, Spacing, TextSize, TextTracking } from '@/constants/theme';

/**
 * Predictor — ONE prediction per team: their NEXT match, nothing
 * further (owner decision 2026-07-13). A match beyond a team's next
 * game depends on results that haven't happened, so it isn't priced
 * here — every row re-prices as rounds complete. Tournament/champion
 * predictions were descoped the same day: they're derivatives of
 * match predictions and "work themselves out as the competition
 * unfolds".
 *
 * Probabilities come from the API against the real Phase 6 contract
 * (docs/predictor-phase-spec.md §4), computed synthetically until the
 * BigQuery ML cutover (spec §2d) — dev-only behind the DEV banner.
 */

// Same filter strip as the Fixtures landing page — one pill grammar
// across every tab except Home (owner call 2026-07-14).
const ALL_COMPETITIONS = 'all';
const FILTER_OPTIONS = [
  { id: ALL_COMPETITIONS, label: 'All' },
  { id: 'six-nations', label: 'Six Nations' },
  { id: 'rugby-championship', label: 'Rugby C’ship' },
  { id: 'summer-tests', label: 'Summer' },
  { id: 'autumn-tests', label: 'Autumn' },
  { id: 'rugby-europe-championship', label: 'Rugby Europe' },
  { id: 'pacific-nations-cup', label: 'Pacific Cup' },
  { id: 'world-cup', label: 'World Cup' },
] as const;

const NEXT_MATCHES_ABOUT = (
  <>
    One prediction per team — their <BackStrong>next match only</BackStrong>.
    Anything further depends on results that haven’t happened yet, so it
    isn’t priced; each fixture re-prices as rounds complete. The dark box
    is the favourite, and <BackStrong>78 means 78 of 100 replays</BackStrong>,
    not a promise. Probabilities weigh world-ranking gap, home advantage,
    recent form and head-to-head — tap a match for the full breakdown.
  </>
);

type TeamLite = Pick<Team, 'id' | 'short_name' | 'flag_code' | 'name'>;

export default function PredictorScreen() {
  const [competitionFilter, setCompetitionFilter] = useState<string>(ALL_COMPETITIONS);
  const seasons = useSeasons();
  const teams = useTeams();

  const seasonIds = useMemo(() => seasons.data?.map((s) => s.id) ?? [], [seasons.data]);
  const fixtureQueries = useQueries({
    queries: seasonIds.map((sid) => ({
      queryKey: ['seasonFixtures', sid],
      queryFn: () => fetchJson<Fixture[]>(`/seasons/${sid}/fixtures`),
    })),
  });

  const teamById = useMemo(() => {
    const m = new Map<string, TeamLite>();
    for (const t of teams.data ?? []) m.set(t.id, t);
    return m;
  }, [teams.data]);

  // Every team's NEXT fixture, deduped (one match covers both sides),
  // soonest kickoff first.
  const nextMatches = useMemo(() => {
    const all: Fixture[] = fixtureQueries.flatMap((q) => q.data ?? []);
    const open = all
      .filter((f) => f.status === 'scheduled' || f.status === 'live' || f.status === 'half-time')
      .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));
    const nextByTeam = new Map<string, Fixture>();
    for (const f of open) {
      if (!nextByTeam.has(f.home_team_id)) nextByTeam.set(f.home_team_id, f);
      if (!nextByTeam.has(f.away_team_id)) nextByTeam.set(f.away_team_id, f);
    }
    const seen = new Set<string>();
    const deduped: Fixture[] = [];
    for (const f of nextByTeam.values()) {
      // Only keep a match when it is the next fixture for BOTH sides —
      // if one side plays sooner elsewhere, this isn't a next-match
      // prediction for them and their form will have moved.
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      if (nextByTeam.get(f.home_team_id)?.id === f.id && nextByTeam.get(f.away_team_id)?.id === f.id) {
        deduped.push(f);
      }
    }
    return deduped
      .filter(
        (f) => competitionFilter === ALL_COMPETITIONS || f.competition_id === competitionFilter,
      )
      .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));
  }, [fixtureQueries, competitionFilter]);

  const predictionQueries = useQueries({
    queries: nextMatches.map((f) => ({
      queryKey: ['matchPrediction', f.id],
      queryFn: () => fetchJson<MatchPrediction>(`/predictor/match/${f.id}`),
    })),
  });
  const predictionByFixture = useMemo(() => {
    const m = new Map<string, MatchPrediction>();
    for (const q of predictionQueries) {
      if (q.data) m.set(q.data.fixture_id, q.data);
    }
    return m;
  }, [predictionQueries]);

  const isLoading =
    seasons.isLoading || teams.isLoading || fixtureQueries.some((q) => q.isLoading);
  const error = seasons.error ?? teams.error ?? fixtureQueries.find((q) => q.error)?.error;

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      <PageGradient />
      <CompetitionPicker
        options={FILTER_OPTIONS}
        selected={competitionFilter}
        onSelect={setCompetitionFilter}
      />
      <FadingScrollView contentContainerStyle={styles.scroll}>
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} />
        ) : nextMatches.length === 0 ? (
          <EmptyState label="No upcoming matches to predict." />
        ) : (
          <NextMatchesCard
            fixtures={nextMatches}
            teamById={teamById}
            predictionByFixture={predictionByFixture}
          />
        )}
      </FadingScrollView>
    </SafeAreaView>
  );
}

/** Slate read: the strongest edge, the tightest call, and how the
 *  board splits — whole-number probabilities only. */
function buildSlateRead(
  fixtures: Fixture[],
  teamById: Map<string, TeamLite>,
  predictionByFixture: Map<string, MatchPrediction>,
): string {
  const rows = fixtures
    .map((fx) => {
      const p = predictionByFixture.get(fx.id);
      if (!p) return null;
      const homePct = Math.round(p.home_win_prob * 100);
      const awayPct = Math.round(p.away_win_prob * 100);
      const homeFav = homePct >= awayPct;
      return {
        favCode:
          (homeFav ? teamById.get(fx.home_team_id) : teamById.get(fx.away_team_id))
            ?.short_name ?? '—',
        dogCode:
          (homeFav ? teamById.get(fx.away_team_id) : teamById.get(fx.home_team_id))
            ?.short_name ?? '—',
        favPct: Math.max(homePct, awayPct),
        margin: Math.abs(Math.round(p.predicted_margin.median)),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length === 0) return INSUFFICIENT_INSIGHT;

  const strongest = rows.reduce((a, b) => (b.favPct > a.favPct ? b : a));
  const tightest = rows.reduce((a, b) => (b.favPct < a.favPct ? b : a));
  const parts: string[] = [];
  parts.push(
    `The strongest call on the board is ${strongest.favCode} — ${strongest.favPct} of 100 replays against ${strongest.dogCode}${strongest.margin > 0 ? `, by ${strongest.margin} on the median` : ''}.`,
  );
  if (rows.length > 1 && tightest !== strongest) {
    parts.push(
      tightest.favPct <= 55
        ? `${tightest.favCode} against ${tightest.dogCode} is the coin toss — ${tightest.favPct} to ${100 - tightest.favPct}, close enough to swing on the day.`
        : `The tightest of the rest is ${tightest.favCode} against ${tightest.dogCode} at ${tightest.favPct}.`,
    );
  }
  const heavy = rows.filter((r) => r.favPct >= 75).length;
  if (rows.length >= 3) {
    parts.push(
      heavy === 0
        ? `No runaway favourites across the ${rows.length} fixtures — the model reads this slate as competitive.`
        : `${heavy} of the ${rows.length} fixtures read as heavy favourites; the rest stay live.`,
    );
  }
  return fitNarrative(parts) ?? INSUFFICIENT_INSIGHT;
}

function NextMatchesCard({
  fixtures,
  teamById,
  predictionByFixture,
}: {
  fixtures: Fixture[];
  teamById: Map<string, TeamLite>;
  predictionByFixture: Map<string, MatchPrediction>;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <FadeCard
      flipped={flipped}
      front={
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <CardTitle title="Upcoming Matches" />
            <View style={styles.headerActions}>
              <CardHeaderActions
                onExplain={() => setFlipped(true)}
                accessibilityLabel="Explain the match win probabilities"
              />
            </View>
          </View>
          <View style={styles.insetDivider} />
          {fixtures.map((fx, i) => (
            <Fragment key={fx.id}>
              <PredictionRow
                fx={fx}
                home={teamById.get(fx.home_team_id)}
                away={teamById.get(fx.away_team_id)}
                prediction={predictionByFixture.get(fx.id)}
              />
              {i < fixtures.length - 1 ? <View style={styles.insetDivider} /> : null}
            </Fragment>
          ))}
        </View>
      }
      back={
        <NarrativeBack
          title="Upcoming Matches"
          purpose={NEXT_MATCHES_ABOUT}
          read={buildSlateRead(fixtures, teamById, predictionByFixture)}
          onClose={() => setFlipped(false)}
        />
      }
    />
  );
}

function PredictionRow({
  fx,
  home,
  away,
  prediction,
}: {
  fx: Fixture;
  home: TeamLite | undefined;
  away: TeamLite | undefined;
  prediction: MatchPrediction | undefined;
}) {
  const router = useRouter();
  const homePct = prediction ? Math.round(prediction.home_win_prob * 100) : null;
  const awayPct = prediction ? Math.round(prediction.away_win_prob * 100) : null;
  const homeFav = homePct !== null && awayPct !== null && homePct > awayPct;
  const awayFav = homePct !== null && awayPct !== null && awayPct > homePct;

  return (
    <Pressable
      onPress={() => router.push(`/predictor/match/${fx.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open prediction for ${home?.short_name ?? fx.home_team_id} versus ${away?.short_name ?? fx.away_team_id}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.matchupRow}>
        <View style={styles.flagWrap}>
          {home ? <TeamFlagShield flagCode={home.flag_code} width={FlagSize.row} /> : null}
        </View>
        <Text style={styles.teamCode}>{home?.short_name ?? fx.home_team_id.toUpperCase()}</Text>
        <View style={styles.middle}>
          <View style={[styles.probBox, ScoreBug.cutLeft, homeFav && styles.probBoxFav]}>
            <Text style={[styles.probText, homeFav && styles.probTextFav]}>
              {homePct ?? '–'}
              <Text style={[styles.probUnit, homeFav && styles.probTextFav]}>%</Text>
            </Text>
          </View>
          <View style={[styles.probBox, ScoreBug.cutRight, awayFav && styles.probBoxFav]}>
            <Text style={[styles.probText, awayFav && styles.probTextFav]}>
              {awayPct ?? '–'}
              <Text style={[styles.probUnit, awayFav && styles.probTextFav]}>%</Text>
            </Text>
          </View>
        </View>
        <Text style={styles.teamCode}>{away?.short_name ?? fx.away_team_id.toUpperCase()}</Text>
        <View style={styles.flagWrap}>
          {away ? <TeamFlagShield flagCode={away.flag_code} width={FlagSize.row} /> : null}
        </View>
        <View style={styles.rowChevron}>
          <Ionicons name="chevron-forward" size={16} color="#C7CBD1" />
        </View>
      </View>
      {/* Verdict meta (owner call 2026-07-13): winning nation and
          margin instead of the date line. */}
      <Text style={styles.metaText}>
        {prediction
          ? Math.abs(prediction.predicted_margin.median) < 1
            ? 'Too close to call'
            : `${
                (prediction.predicted_margin.median > 0 ? home : away)?.short_name ??
                (prediction.predicted_margin.median > 0 ? 'Home' : 'Away')
              } by ${Math.abs(prediction.predicted_margin.median)}`
          : '…'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: PAGE_BOTTOM_INSET,
    gap: Spacing.three,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E3E8EF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: {
    position: 'relative',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerActions: {
    position: 'absolute',
    right: Spacing.three,
    top: Spacing.three,
  },
  insetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C7CBD1',
    marginHorizontal: Spacing.three,
  },

  row: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  rowPressed: { backgroundColor: '#E9EDF2' },
  matchupRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  flagWrap: {
    width: FlagSize.row,
    height: FlagSize.row,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamCode: {
    width: 40,
    textAlign: 'center',
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.text,
  },
  middle: {
    width: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  probBox: {
    ...ScoreBoxSize.row,
    minWidth: ScoreBoxSize.row.width + 12,
    backgroundColor: '#E9EDF2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    ...ScoreBug.skew,
  },
  probBoxFav: { backgroundColor: Colors.light.textSecondary },
  probText: {
    fontSize: TextSize.lg,
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    color: Colors.light.textSecondary,
    ...ScoreBug.counterSkew,
  },
  probTextFav: { color: Colors.light.textInverse },
  probUnit: {
    fontFamily: 'WorkSans_500Medium_Italic',
    fontSize: 7,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  rowChevron: {
    position: 'absolute',
    right: -Spacing.two,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaText: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});
