import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import type { Fixture, Result } from '@rugby-app/shared';

import { fetchJson } from '@/api/client';
import { useCompetitions, useTeam, useTeams } from '@/api/hooks';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { Colors, FlagSize, ScoreBoxSize, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useMyTeamId } from '@/hooks/use-my-team-id';
import { formatFixtureDate } from '@/lib/format-fixture-date';

// App-wide 24pt card column — matches FixtureCarousel's card width and
// the Fixtures / Teams landing pages.
const HORIZONTAL_MARGIN = Spacing.four;

/**
 * Home-page card that surfaces the user's team's next and last fixtures
 * as tap-through navigation rows. Reads the team id from `useMyTeamId`
 * — same source of truth as [[team-selector-card]] above it and the
 * Preview-style analytics cards below. Renders nothing when no team is
 * chosen (the selector card handles the empty state).
 *
 * Each row is a Pressable that pushes into the fixture drill on tap
 * (`/fixtures/<id>` — nested inside the Fixtures tab so the AppHeader +
 * tab bar persist through the drill).
 */
export function MyTeamMatchesCard() {
  const [myTeamId] = useMyTeamId();
  if (!myTeamId) return null;
  return <Populated teamId={myTeamId} padded />;
}

/** Team-scoped variant for the team drill — no outer page padding
 *  (the drill pane owns the 24pt card column). */
export function TeamMatchesCard({ teamId }: { teamId: string }) {
  return <Populated teamId={teamId} />;
}

function Populated({ teamId, padded = false }: { teamId: string; padded?: boolean }) {
  const router = useRouter();
  const team = useTeam(teamId);
  const allTeams = useTeams();
  const competitions = useCompetitions();

  const teamById = useMemo(() => {
    const m = new Map<string, { flag_code: string; short_name: string }>();
    for (const t of allTeams.data ?? []) {
      m.set(t.id, { flag_code: t.flag_code, short_name: t.short_name });
    }
    return m;
  }, [allTeams.data]);

  const compById = useMemo(() => {
    const m = new Map<string, { short_name: string }>();
    for (const c of competitions.data ?? []) m.set(c.id, { short_name: c.short_name });
    return m;
  }, [competitions.data]);

  const myTeamInfo = team.data
    ? { flag_code: team.data.flag_code, short_name: team.data.short_name }
    : null;

  const nowIso = new Date().toISOString();

  const nextMatch = useMemo(() => {
    if (!team.data) return null;
    const upcoming = team.data.fixtures
      .filter((f) => f.status === 'scheduled' && f.kickoff_utc >= nowIso)
      .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));
    return upcoming[0] ?? null;
  }, [team.data, nowIso]);

  const lastMatch = useMemo(() => {
    if (!team.data) return null;
    const completed = team.data.fixtures
      .filter((f) => f.status === 'completed')
      .sort((a, b) => b.kickoff_utc.localeCompare(a.kickoff_utc));
    return completed[0] ?? null;
  }, [team.data]);

  // Fetch the last match's Result so the FT score can render inline.
  // Single query gated on `enabled` — the key matches the app-wide
  // ['fixtureResult', id] convention so TanStack Query dedupes with the
  // other consumers (Fixtures list, picker form, team aggregates).
  const lastResultQuery = useQuery({
    queryKey: ['fixtureResult', lastMatch?.id ?? ''],
    queryFn: () => fetchJson<Result>(`/fixtures/${lastMatch!.id}/result`),
    enabled: Boolean(lastMatch),
  });
  const lastResult = lastResultQuery.data;

  if (!team.data) return null;

  return (
    <View style={padded ? styles.page : undefined}>
      <View style={styles.card}>
        <NavSection
          label="Next Match"
          onPress={nextMatch ? () => router.push(`/fixtures/${nextMatch.id}`) : undefined}>
          {nextMatch && myTeamInfo ? (
            <>
              <Text style={styles.dateCentered}>{formatFixtureDate(nextMatch)}</Text>
              <FixtureLine
                fixture={nextMatch}
                teamId={teamId}
                myTeam={myTeamInfo}
                oppTeam={teamById.get(
                  nextMatch.home_team_id === teamId ? nextMatch.away_team_id : nextMatch.home_team_id,
                )}
                competition={compById.get(nextMatch.competition_id)}
                chevron
              />
            </>
          ) : (
            <Text style={styles.mutedRow}>No upcoming fixtures.</Text>
          )}
        </NavSection>

        <NavSection
          label="Last Match"
          onPress={lastMatch ? () => router.push(`/fixtures/${lastMatch.id}`) : undefined}>
          {lastMatch && myTeamInfo ? (
            <>
              <Text style={styles.dateCentered}>{formatFixtureDate(lastMatch)}</Text>
              <FixtureLine
                fixture={lastMatch}
                teamId={teamId}
                myTeam={myTeamInfo}
                oppTeam={teamById.get(
                  lastMatch.home_team_id === teamId ? lastMatch.away_team_id : lastMatch.home_team_id,
                )}
                competition={compById.get(lastMatch.competition_id)}
                result={lastResult}
                chevron
              />
            </>
          ) : (
            <Text style={styles.mutedRow}>No completed fixtures.</Text>
          )}
        </NavSection>
      </View>
    </View>
  );
}

function NavSection({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  const inert = !onPress;
  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      style={({ pressed }) => [
        styles.section,
        !inert && styles.sectionWithChevron,
        pressed && !inert && { opacity: 0.75 },
      ]}>
      <View style={styles.navSectionHeader}>
        <Text style={styles.sectionLabel}>{label}</Text>
      </View>
      {children}
    </Pressable>
  );
}

function FixtureLine({
  fixture,
  teamId,
  myTeam,
  oppTeam,
  competition,
  result,
  chevron,
}: {
  fixture: Fixture;
  teamId: string;
  myTeam: { flag_code: string; short_name: string };
  oppTeam: { flag_code: string; short_name: string } | undefined;
  competition: { short_name: string } | undefined;
  result?: Result;
  /** Pressability cue — rendered inside the matchup row so it centres
      on the shields, not the whole section. */
  chevron?: boolean;
}) {
  const isHome = fixture.home_team_id === teamId;
  const oppId = isHome ? fixture.away_team_id : fixture.home_team_id;
  const oppShort = oppTeam?.short_name ?? oppId.toUpperCase();

  let middle: React.ReactNode;
  if (result) {
    const teamScore = isHome ? result.home_score : result.away_score;
    const oppScore = isHome ? result.away_score : result.home_score;
    const teamWins = teamScore > oppScore;
    const oppWins = oppScore > teamScore;
    middle = (
      <View style={styles.scoreCluster}>
        <View style={[styles.scoreBoxSmall, teamWins && styles.scoreBoxSmallWinner]}>
          <Text style={[styles.scoreBoxSmallText, teamWins && styles.scoreBoxSmallTextWinner]}>
            {teamScore}
          </Text>
        </View>
        <Text style={styles.ftLabel}>FT</Text>
        <View style={[styles.scoreBoxSmall, oppWins && styles.scoreBoxSmallWinner]}>
          <Text style={[styles.scoreBoxSmallText, oppWins && styles.scoreBoxSmallTextWinner]}>
            {oppScore}
          </Text>
        </View>
      </View>
    );
  } else {
    middle = <Text style={styles.fixtureTime}>{fixture.kickoff_utc.slice(11, 16)}</Text>;
  }

  return (
    <View style={styles.fixtureBlock}>
      <View style={styles.fixtureRow}>
        <View style={styles.fixtureSide}>
          <TeamFlagShield flagCode={myTeam.flag_code} width={FlagSize.row} />
          <Text style={styles.fixtureCode}>{myTeam.short_name}</Text>
        </View>
        {middle}
        <View style={[styles.fixtureSide, styles.fixtureSideRight]}>
          <Text style={styles.fixtureCode}>{oppShort}</Text>
          {oppTeam ? <TeamFlagShield flagCode={oppTeam.flag_code} width={FlagSize.row} /> : null}
        </View>
        {chevron ? (
          // Sits in the section's right-padding gutter (absolute, so
          // the centred clusters don't shift) at the row's mid-height.
          <View style={styles.rowChevron}>
            <Ionicons name="chevron-forward" size={16} color="#C7CBD1" />
          </View>
        ) : null}
      </View>
      <Text style={styles.fixtureMeta} numberOfLines={1}>
        {competition?.short_name ?? fixture.competition_id} · {fixture.venue}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: HORIZONTAL_MARGIN },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.three,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  section: {
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  navSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  // Centered date sitting between the section label and the score/time
  // row — matches the FixtureCarouselCard's date position at the top of
  // each hero card.
  dateCentered: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  // Row content stops short of the right edge so the away flag never
  // collides with the pinned chevron.
  sectionWithChevron: {
    paddingRight: 24,
  },
  rowChevron: {
    position: 'absolute',
    right: -24,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  mutedRow: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
  },

  // Fixture-row internals — kept in-file so this component stays self-
  // contained after the old MyTeamCard is removed.
  // 8pt gap so the padding BELOW the score/time row (to the venue meta
  // line) matches the padding ABOVE it (from the centred date via the
  // section's `gap: Spacing.two`).
  fixtureBlock: { gap: Spacing.two },
  fixtureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  fixtureSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
  },
  fixtureSideRight: {
    justifyContent: 'flex-end',
  },
  fixtureCode: {
    // 24pt-shield rule: sport-display face at lg beside row shields.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.text,
    letterSpacing: TextTracking.wide,
  },
  fixtureTime: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.textSecondary,
  },
  fixtureMeta: {
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },

  scoreCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreBoxSmall: {
    ...ScoreBoxSize.row,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBoxSmallWinner: { backgroundColor: Colors.light.textSecondary },
  scoreBoxSmallText: {
    fontSize: TextSize.lg,
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    color: Colors.light.textSecondary,
  },
  scoreBoxSmallTextWinner: { color: Colors.light.textInverse },
  ftLabel: {
    fontSize: TextSize.sm,
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
});
