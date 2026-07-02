import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueries } from '@tanstack/react-query';

import type { Fixture, Result } from '@rugby-app/shared';

import { fetchJson } from '@/api/client';
import { useCompetitions, useTeam, useTeams } from '@/api/hooks';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { TeamPickerModal } from '@/components/team-picker-modal';
import { Colors, FlagSize, ScoreBoxSize, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useMyTeamId } from '@/hooks/use-my-team-id';

const FORM_LOOKBACK = 5; // Number of recent completed fixtures to show in Form row.

const HORIZONTAL_MARGIN = 40; // Matches FixtureCarousel + HomeRankingsCarousel.

/** Convert an ISO datetime string ("2026-07-04T20:10:00Z") to dd-mm-yyyy. */
function formatDateDMY(isoDateTime: string): string {
  const [yyyy, mm, dd] = isoDateTime.slice(0, 10).split('-');
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Home-page card for the user's favourite team. Two states:
 *   - Empty: header + "Select your favorite team" + filter icon to open picker
 *   - Populated: flag + name, Next Match, Last Match, and Form (last N results)
 * Selection persists across launches via `useMyTeamId`.
 */
export function MyTeamCard() {
  const [myTeamId, setMyTeamId] = useMyTeamId();
  const [pickerOpen, setPickerOpen] = useState(false);
  const teams = useTeams();

  const selectedTeam = useMemo(
    () => (myTeamId ? teams.data?.find((t) => t.id === myTeamId) : undefined),
    [myTeamId, teams.data],
  );

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>
            My Team{selectedTeam ? `: ${selectedTeam.name}` : ''}
          </Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            hitSlop={12}
            style={({ pressed }) => [styles.filterButton, pressed && styles.filterButtonPressed]}>
            <Ionicons name="options-outline" size={20} color={Colors.light.text} />
          </Pressable>
        </View>

        {myTeamId ? <PopulatedBody teamId={myTeamId} /> : <EmptyBody />}
      </View>

      <TeamPickerModal
        visible={pickerOpen}
        teams={teams.data ?? []}
        currentTeamId={myTeamId}
        onCancel={() => setPickerOpen(false)}
        onConfirm={(id) => {
          setMyTeamId(id);
          setPickerOpen(false);
        }}
        onClear={() => {
          setMyTeamId(null);
          setPickerOpen(false);
        }}
      />
    </View>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyBody() {
  return (
    <View style={styles.emptyBody}>
      <Text style={styles.emptyText}>Select your favorite team</Text>
    </View>
  );
}

// ─── Populated state ─────────────────────────────────────────────────────────

function PopulatedBody({ teamId }: { teamId: string }) {
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

  const formFixtures = useMemo(() => {
    if (!team.data) return [];
    return team.data.fixtures
      .filter((f) => f.status === 'completed')
      .sort((a, b) => b.kickoff_utc.localeCompare(a.kickoff_utc))
      .slice(0, FORM_LOOKBACK);
  }, [team.data]);

  // Batch-fetch results for the form fixtures + the last match (for its score).
  const resultTargets = useMemo(() => {
    const ids = new Set<string>(formFixtures.map((f) => f.id));
    if (lastMatch) ids.add(lastMatch.id);
    return [...ids];
  }, [formFixtures, lastMatch]);

  const resultQueries = useQueries({
    queries: resultTargets.map((id) => ({
      queryKey: ['fixtureResult', id],
      queryFn: () => fetchJson<Result>(`/fixtures/${id}/result`),
    })),
  });

  const resultByFixture = useMemo(() => {
    const m = new Map<string, Result>();
    for (const q of resultQueries) if (q.data) m.set(q.data.fixture_id, q.data);
    return m;
  }, [resultQueries]);

  if (!team.data) return null;

  return (
    <View style={styles.populatedBody}>
      {/* Team identity moved into the card header (My Team: {name}). Card
          jumps straight into Next / Last / Form. Each row is tappable and
          navigates to that fixture's detail page — chevron affords it. */}
      <NavSection
        label="Next Match"
        rightHeader={nextMatch ? formatDateDMY(nextMatch.kickoff_utc) : undefined}
        onPress={nextMatch ? () => router.push(`/fixture/${nextMatch.id}`) : undefined}>
        {nextMatch && myTeamInfo ? (
          <FixtureLine
            fixture={nextMatch}
            teamId={teamId}
            myTeam={myTeamInfo}
            oppTeam={teamById.get(
              nextMatch.home_team_id === teamId ? nextMatch.away_team_id : nextMatch.home_team_id,
            )}
            competition={compById.get(nextMatch.competition_id)}
          />
        ) : (
          <Text style={styles.mutedRow}>No upcoming fixtures.</Text>
        )}
      </NavSection>

      <NavSection
        label="Last Match"
        rightHeader={lastMatch ? formatDateDMY(lastMatch.kickoff_utc) : undefined}
        onPress={lastMatch ? () => router.push(`/fixture/${lastMatch.id}`) : undefined}>
        {lastMatch && myTeamInfo ? (
          <FixtureLine
            fixture={lastMatch}
            teamId={teamId}
            myTeam={myTeamInfo}
            oppTeam={teamById.get(
              lastMatch.home_team_id === teamId ? lastMatch.away_team_id : lastMatch.home_team_id,
            )}
            competition={compById.get(lastMatch.competition_id)}
            result={resultByFixture.get(lastMatch.id)}
          />
        ) : (
          <Text style={styles.mutedRow}>No completed fixtures.</Text>
        )}
      </NavSection>

      <Section label={`Form (last ${FORM_LOOKBACK})`}>
        {formFixtures.length === 0 ? (
          <Text style={styles.mutedRow}>Not enough matches yet.</Text>
        ) : (
          <View style={styles.formRow}>
            {formFixtures.map((fx) => (
              <FormBadge
                key={fx.id}
                fixture={fx}
                teamId={teamId}
                result={resultByFixture.get(fx.id)}
              />
            ))}
          </View>
        )}
      </Section>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

/**
 * Tappable variant of Section — the section label sits top-left, an optional
 * `rightHeader` value (used for the fixture date) sits top-right, and a
 * right-chevron affordance sits bottom-right hinting "tap to open". When
 * `onPress` is undefined (e.g. no matching fixture), the chevron is hidden
 * and the row is inert.
 */
function NavSection({
  label,
  rightHeader,
  onPress,
  children,
}: {
  label: string;
  rightHeader?: string;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  const inert = !onPress;
  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      style={({ pressed }) => [styles.section, pressed && !inert && { opacity: 0.75 }]}>
      <View style={styles.navSectionHeader}>
        <Text style={styles.sectionLabel}>{label}</Text>
        {rightHeader ? <Text style={styles.navSectionDate}>{rightHeader}</Text> : null}
      </View>
      {children}
      {!inert ? (
        <View style={styles.navSectionFooter}>
          <Ionicons name="chevron-forward" size={18} color={Colors.light.textSecondary} />
        </View>
      ) : null}
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
}: {
  fixture: Fixture;
  teamId: string;
  myTeam: { flag_code: string; short_name: string };
  oppTeam: { flag_code: string; short_name: string } | undefined;
  competition: { short_name: string } | undefined;
  result?: Result;
}) {
  const isHome = fixture.home_team_id === teamId;
  const oppId = isHome ? fixture.away_team_id : fixture.home_team_id;
  const oppShort = oppTeam?.short_name ?? oppId.toUpperCase();

  // Middle slot: for completed fixtures, a `[score] FT [score]` cluster
  // where the winner's box is filled dark with white number (matches the
  // Fixtures list + World Rugby Rankings points treatment app-wide). For
  // scheduled fixtures, the kickoff time — matches the Fixtures list
  // upcoming-row convention.
  let middle: React.ReactNode;
  if (result) {
    const teamScore = isHome ? result.home_score : result.away_score;
    const oppScore = isHome ? result.away_score : result.home_score;
    const teamWins = teamScore > oppScore;
    const oppWins = oppScore > teamScore;
    middle = (
      <View style={styles.scoreCluster}>
        <View style={[styles.scoreBoxSmall, teamWins && styles.scoreBoxSmallWinner]}>
          <Text
            style={[
              styles.scoreBoxSmallText,
              teamWins && styles.scoreBoxSmallTextWinner,
            ]}>
            {teamScore}
          </Text>
        </View>
        <Text style={styles.ftLabel}>FT</Text>
        <View style={[styles.scoreBoxSmall, oppWins && styles.scoreBoxSmallWinner]}>
          <Text
            style={[
              styles.scoreBoxSmallText,
              oppWins && styles.scoreBoxSmallTextWinner,
            ]}>
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
          <TeamFlagBall2D flagCode={myTeam.flag_code} size={FlagSize.row} />
          <Text style={styles.fixtureCode}>{myTeam.short_name}</Text>
        </View>
        {middle}
        <View style={[styles.fixtureSide, styles.fixtureSideRight]}>
          <Text style={styles.fixtureCode}>{oppShort}</Text>
          {oppTeam ? (
            <TeamFlagBall2D flagCode={oppTeam.flag_code} size={FlagSize.row} />
          ) : null}
        </View>
      </View>
      <Text style={styles.fixtureMeta} numberOfLines={1}>
        {competition?.short_name ?? fixture.competition_id} · {fixture.venue}
      </Text>
    </View>
  );
}

function FormBadge({
  fixture,
  teamId,
  result,
}: {
  fixture: Fixture;
  teamId: string;
  result?: Result;
}) {
  if (!result) {
    return (
      <View style={[styles.formBadge, styles.formBadgeUnknown]}>
        <Text style={styles.formBadgeText}>–</Text>
      </View>
    );
  }
  const isHome = fixture.home_team_id === teamId;
  const teamScore = isHome ? result.home_score : result.away_score;
  const oppScore = isHome ? result.away_score : result.home_score;
  let letter: 'W' | 'L' | 'D';
  let style;
  if (teamScore > oppScore) {
    letter = 'W';
    style = styles.formBadgeWin;
  } else if (teamScore < oppScore) {
    letter = 'L';
    style = styles.formBadgeLoss;
  } else {
    letter = 'D';
    style = styles.formBadgeDraw;
  }
  return (
    <View style={[styles.formBadge, style]}>
      <Text style={styles.formBadgeText}>{letter}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: HORIZONTAL_MARGIN,
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: TextSize.lg,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
  },
  filterButton: {
    padding: 6,
    borderRadius: 8,
  },
  filterButtonPressed: { backgroundColor: '#F3F4F6' },

  emptyBody: {
    paddingVertical: Spacing.two,
  },
  emptyText: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },

  populatedBody: { gap: Spacing.three },

  section: {
    // Breathing room between the section label and its body content
    // (fixture flags for Next / Last, form badges for Form).
    gap: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F3F4F6',
  },
  sectionLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  navSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Explicit bottom space between the section label and the flag row —
    // safer than relying on the section's `gap` which behaves inconsistently
    // on Pressable in some RN versions.
    marginBottom: Spacing.two,
  },
  navSectionDate: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  navSectionFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 2,
    // 8pt breathing room below the chevron, mirroring the 8pt above the
    // flag row so the section reads with symmetric top-and-bottom padding.
    marginBottom: Spacing.two,
  },

  fixtureBlock: { gap: 4 },
  fixtureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  fixtureSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  // Right side reverses so the flag stays on the outer edge and the code sits
  // between the flag and the middle score/vs — mirrors the left side.
  fixtureSideRight: { justifyContent: 'flex-end' },
  fixtureCode: {
    fontSize: TextSize.md,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.text,
  },
  // ─── Score cluster (completed fixtures) ────────────────────────────────────
  // Same visual language as the Fixtures list winner box and the World Rugby
  // Rankings points tile — 30×24 rounded 4pt box, dark fill + white number
  // for the winner, light-grey fill + primary text for the loser, uppercase
  // "FT" label between.
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
  scoreBoxSmallWinner: { backgroundColor: Colors.light.text },
  scoreBoxSmallText: {
    fontSize: TextSize.md,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },
  scoreBoxSmallTextWinner: { color: Colors.light.textInverse },
  ftLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  // Kickoff time in the middle slot for scheduled fixtures. Same treatment
  // as the Fixtures list `timeMid` — tabular-nums, semibold, primary text —
  // so the whole app uses one convention for "upcoming fixture middle slot".
  fixtureTime: {
    fontSize: TextSize.md,
    fontWeight: TextWeight.semibold,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },
  fixtureMeta: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  mutedRow: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
  },

  formRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  formBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formBadgeWin: { backgroundColor: '#059669' },
  formBadgeLoss: { backgroundColor: '#DC2626' },
  formBadgeDraw: { backgroundColor: '#9CA3AF' },
  formBadgeUnknown: { backgroundColor: '#E5E7EB' },
  formBadgeText: {
    color: Colors.light.textInverse,
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
  },
});
