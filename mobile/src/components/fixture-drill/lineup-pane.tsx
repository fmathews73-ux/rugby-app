import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Coach, CoachRole, Fixture, LineUp, MatchOfficial, MatchOfficialRole, Player } from '@rugby-app/shared';

import { useFixtureOfficials, useTeamCoachingStaff, useTeams } from '@/api/hooks';
import { jerseyGlyphColors, type JerseyGlyph } from '@/lib/team-colors';
import { LoadingState } from '@/components/state-views';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';

// ─── Line-Up pane ────────────────────────────────────────────────────────────

export function LineUpPane({
  fixture,
  lineups,
  lineupsLoading,
  playerById,
}: {
  fixture: Fixture;
  lineups: LineUp[];
  lineupsLoading: boolean;
  playerById: Map<string, Player>;
}) {
  const homeCoaches = useTeamCoachingStaff(fixture.home_team_id);
  const awayCoaches = useTeamCoachingStaff(fixture.away_team_id);
  const officials = useFixtureOfficials(fixture.id);
  // Player whose match-scoped stat sheet is open in the bottom modal.
  // Player taps push the match-sheet ROUTE (owner call 2026-07-10 —
  // the bottom-sheet modal was the app's last modal drill); back
  // returns here to the Line-Up.
  const router = useRouter();
  // Stack-aware push: the fixture drill is hosted in the Fixtures,
  // Tables AND Teams stacks (standings/fixture and teams/fixture
  // re-exports); the player page must open in whichever stack we're
  // standing in so back walks the same chain down.
  const pathname = usePathname();
  const playerPathname = pathname.startsWith('/standings')
    ? '/standings/player/[pid]'
    : pathname.startsWith('/teams')
      ? '/teams/fixture-player/[pid]'
      : '/fixtures/player/[pid]';
  const openPlayer = (pid: string) =>
    router.push({
      pathname: playerPathname,
      params: { pid, fixtureId: fixture.id },
    });
  const teams = useTeams();
  const homeFlag = teams.data?.find((t) => t.id === fixture.home_team_id)?.flag_code;
  const awayFlag = teams.data?.find((t) => t.id === fixture.away_team_id)?.flag_code;
  if (fixture.status === 'scheduled') {
    return (
      <View style={styles.paneEmpty}>
        <Text style={styles.paneEmptyText}>
          Line-ups are typically published shortly before kickoff. Nothing to show yet.
        </Text>
      </View>
    );
  }
  if (lineupsLoading) return <LoadingState />;
  if (lineups.length === 0) {
    return (
      <View style={styles.paneEmpty}>
        <Text style={styles.paneEmptyText}>No line-ups recorded for this fixture.</Text>
      </View>
    );
  }
  const homeLineup = lineups.find((lu) => lu.team_id === fixture.home_team_id);
  const awayLineup = lineups.find((lu) => lu.team_id === fixture.away_team_id);

  // Pair up entries index-by-index. Starting XV numbers 1-15 are canonical
  // positions shared across both teams; bench 16-23 loosely mirror as
  // well. Iterating by the longer of the two lists means either team can
  // have a missing entry without breaking the row structure.
  const startingRows = pairEntries(
    homeLineup?.starting_xv ?? [],
    awayLineup?.starting_xv ?? [],
  );
  const benchRows = pairEntries(homeLineup?.bench ?? [], awayLineup?.bench ?? []);

  // Cumulative Test caps per side — the same jersey badge the rows
  // carry, summed for the header (home left of the title, away right).
  const totalCaps = (
    rows: readonly { home: LineUpEntry | null; away: LineUpEntry | null }[],
    side: 'home' | 'away',
  ) =>
    rows.reduce((t, r) => {
      const e = r[side];
      return t + (e ? playerById.get(e.player_id)?.cap_count ?? 0 : 0);
    }, 0);

  return (
    <View style={styles.lineupContainer}>
      {/* Nation shields at the outer edges, caps totals inside them,
          title centred — the pane's own matchup strip. */}
      <View style={[styles.lineupSectionHeader, styles.lineupSectionHeaderSpread]}>
        <View style={styles.lineupHeaderSide}>
          {homeFlag ? <TeamFlagShield flagCode={homeFlag} width={24} /> : null}
          <CapsJersey caps={totalCaps(startingRows, 'home')} glyph={jerseyGlyphColors(fixture.home_team_id)} />
        </View>
        <Text style={styles.categoryLabel}>Starting XV</Text>
        <View style={styles.lineupHeaderSide}>
          <CapsJersey caps={totalCaps(startingRows, 'away')} glyph={jerseyGlyphColors(fixture.away_team_id)} mirrored />
          {awayFlag ? <TeamFlagShield flagCode={awayFlag} width={24} /> : null}
        </View>
      </View>
      <View style={styles.insetDivider} />
      {startingRows.map(({ home, away }, i) => (
        <LineUpCompareRow
          homeGlyph={jerseyGlyphColors(fixture.home_team_id)}
          awayGlyph={jerseyGlyphColors(fixture.away_team_id)}
          key={`start-${i}`}
          home={home}
          away={away}
          playerById={playerById}
          onPressPlayer={openPlayer}
        />
      ))}

      <View style={[styles.lineupSectionHeader, styles.lineupSectionHeaderSpread]}>
        <View style={styles.lineupHeaderSide}>
          {homeFlag ? <TeamFlagShield flagCode={homeFlag} width={24} /> : null}
          <CapsJersey caps={totalCaps(benchRows, 'home')} glyph={jerseyGlyphColors(fixture.home_team_id)} />
        </View>
        <Text style={styles.categoryLabel}>Bench</Text>
        <View style={styles.lineupHeaderSide}>
          <CapsJersey caps={totalCaps(benchRows, 'away')} glyph={jerseyGlyphColors(fixture.away_team_id)} mirrored />
          {awayFlag ? <TeamFlagShield flagCode={awayFlag} width={24} /> : null}
        </View>
      </View>
      <View style={styles.insetDivider} />
      {benchRows.map(({ home, away }, i) => (
        <LineUpCompareRow
          homeGlyph={jerseyGlyphColors(fixture.home_team_id)}
          awayGlyph={jerseyGlyphColors(fixture.away_team_id)}
          key={`bench-${i}`}
          home={home}
          away={away}
          playerById={playerById}
          onPressPlayer={openPlayer}
        />
      ))}

      {/* Coaching staff — hidden entirely if the feed returns nothing (real
          feeds may not carry it — PRD register #7). Synthetic dev data
          gives every team 4 roles: head, attack, defence, forwards. */}
      {(homeCoaches.data?.length ?? 0) + (awayCoaches.data?.length ?? 0) > 0 ? (
        <>
          <View style={styles.lineupSectionHeader}>
            <Text style={styles.categoryLabel}>Coaches</Text>
          </View>
      <View style={styles.insetDivider} />
          {pairCoachesByRole(homeCoaches.data ?? [], awayCoaches.data ?? []).map(
            ({ role, home, away }) => (
              <CoachingCompareRow key={role} role={role} home={home} away={away} />
            ),
          )}
        </>
      ) : null}

      {/* Match officials — announced pre-match, so this section renders for
          scheduled fixtures too. Hidden if the feed returns nothing. */}
      {(officials.data?.length ?? 0) > 0 ? (
        <>
          <View style={styles.lineupSectionHeader}>
            <Text style={styles.categoryLabel}>Officials</Text>
          </View>
      <View style={styles.insetDivider} />
          {sortOfficialsByRole(officials.data ?? []).map((o) => (
            <OfficialRow key={o.id} official={o} />
          ))}
        </>
      ) : null}

    </View>
  );
}

/** Roles rendered in order — head coach first, then attack / defence /
 *  forwards. If a team is missing a role, we still show the row (empty
 *  name on that side) so home/away stay index-aligned. */
const COACH_ROLE_ORDER: readonly CoachRole[] = [
  'head-coach',
  'attack-coach',
  'defence-coach',
  'forwards-coach',
  'skills-coach',
  'kicking-coach',
  'assistant-coach',
];

const COACH_ROLE_LABELS: Record<CoachRole, string> = {
  'head-coach': 'Head Coach',
  'attack-coach': 'Attack Coach',
  'defence-coach': 'Defence Coach',
  'forwards-coach': 'Forwards Coach',
  'skills-coach': 'Skills Coach',
  'kicking-coach': 'Kicking Coach',
  'assistant-coach': 'Assistant Coach',
};

function pairCoachesByRole(
  home: readonly Coach[],
  away: readonly Coach[],
): { role: CoachRole; home: Coach | null; away: Coach | null }[] {
  const homeByRole = new Map(home.map((c) => [c.role, c]));
  const awayByRole = new Map(away.map((c) => [c.role, c]));
  const roles = new Set<CoachRole>([...homeByRole.keys(), ...awayByRole.keys()]);
  return COACH_ROLE_ORDER
    .filter((r) => roles.has(r))
    .map((role) => ({ role, home: homeByRole.get(role) ?? null, away: awayByRole.get(role) ?? null }));
}

/** Match-official roles rendered top-to-bottom. Referee first (the on-field
 *  authority), then the two sideline officials, then the TMO — matches
 *  the standard broadcast intro. */
const OFFICIAL_ROLE_ORDER: readonly MatchOfficialRole[] = [
  'referee',
  'assistant-referee-1',
  'assistant-referee-2',
  'tmo',
];

const OFFICIAL_ROLE_LABELS: Record<MatchOfficialRole, string> = {
  'referee': 'Referee',
  'assistant-referee-1': 'Sideline',
  'assistant-referee-2': 'Sideline',
  'tmo': 'TMO',
};

function sortOfficialsByRole(officials: readonly MatchOfficial[]): MatchOfficial[] {
  return [...officials].sort(
    (a, b) => OFFICIAL_ROLE_ORDER.indexOf(a.role) - OFFICIAL_ROLE_ORDER.indexOf(b.role),
  );
}

/**
 * Single-line row: role on the left (tracked xs textSecondary), official's
 * name on the right (bold sm text). Officials are match-scoped (neutral),
 * so there's no home / away split like the coaching row.
 */
function OfficialRow({ official }: { official: MatchOfficial }) {
  return (
    <View style={styles.officialRow}>
      <Text style={styles.officialRole}>{OFFICIAL_ROLE_LABELS[official.role]}</Text>
      <Text style={styles.officialName} numberOfLines={1}>
        {official.name}
      </Text>
    </View>
  );
}

function CoachingCompareRow({
  role,
  home,
  away,
}: {
  role: CoachRole;
  home: Coach | null;
  away: Coach | null;
}) {
  return (
    <View style={styles.coachingRow}>
      <Text style={styles.coachingRole} numberOfLines={1}>
        {COACH_ROLE_LABELS[role]}
      </Text>
      <View style={styles.coachingNamesRow}>
        <Text style={styles.coachingName} numberOfLines={1}>
          {home?.name ?? '—'}
        </Text>
        <Text style={[styles.coachingName, styles.coachingNameRight]} numberOfLines={1}>
          {away?.name ?? '—'}
        </Text>
      </View>
    </View>
  );
}

type LineUpEntry = LineUp['starting_xv'][number];

/** Pair line-up entries index-by-index so both teams' same-shirt-number
 * players sit on the same row. Pads with `null` where either team has a
 * shorter list. */
function pairEntries(
  home: readonly LineUpEntry[],
  away: readonly LineUpEntry[],
): { home: LineUpEntry | null; away: LineUpEntry | null }[] {
  const max = Math.max(home.length, away.length);
  const out: { home: LineUpEntry | null; away: LineUpEntry | null }[] = [];
  for (let i = 0; i < max; i++) {
    out.push({ home: home[i] ?? null, away: away[i] ?? null });
  }
  return out;
}

/** Format a canonical Position id ('loose-head-prop') into a Title-Case
 * display label ('Loose Head Prop'). Matches the sub-tab label style
 * (Overview / Line-Up / Stats / …) — same typographic register. */
function formatPosition(pos: string): string {
  return pos
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Small jersey glyph + caps count as a side-by-side pair; `mirrored`
 *  flips the order so the away edge reads value-then-shirt. */
function CapsJersey({
  caps,
  mirrored = false,
  glyph,
}: {
  caps: number;
  mirrored?: boolean;
  /** Squad glyph colours; grey outline fallback while teams load. */
  glyph?: JerseyGlyph;
}) {
  // Solid shirt in the squad colour; white shirts (ENG, FIJ) add a
  // trim-colour outline so the shape survives the white card.
  const icon = glyph ? (
    <View>
      <Ionicons name="shirt" size={14} color={glyph.fill} />
      {glyph.border ? (
        <View style={styles.lineupJerseyBorder} pointerEvents="none">
          <Ionicons name="shirt-outline" size={14} color={glyph.border} />
        </View>
      ) : null}
    </View>
  ) : (
    <Ionicons name="shirt-outline" size={14} color={Colors.light.textSecondary} />
  );
  const value = <Text style={styles.lineupCaps}>{caps}</Text>;
  return (
    <View style={styles.lineupCapsPair}>
      {mirrored ? value : icon}
      {mirrored ? icon : value}
    </View>
  );
}

function LineUpCompareRow({
  home,
  away,
  playerById,
  onPressPlayer,
  homeGlyph,
  awayGlyph,
}: {
  home: LineUpEntry | null;
  away: LineUpEntry | null;
  playerById: Map<string, Player>;
  onPressPlayer: (playerId: string) => void;
  homeGlyph?: JerseyGlyph;
  awayGlyph?: JerseyGlyph;
}) {
  // ONE shared shirt-number badge in the centre — both sides of a
  // compare row wear the same number, so it applies to both names
  // (home name reads toward it from the left, away from the right).
  // Each side is independently tappable and opens that player's match
  // stat sheet.
  const homeLabel = home
    ? playerById.get(home.player_id)?.name ?? formatPosition(home.position)
    : '';
  const awayLabel = away
    ? playerById.get(away.player_id)?.name ?? formatPosition(away.position)
    : '';
  const shirtNumber = home?.shirt_number ?? away?.shirt_number ?? '·';
  // Caps ride the OUTER edge of each side — a quiet experience read
  // bracketing the matchup (caps · name · Nº · name · caps).
  const homeCaps = home ? playerById.get(home.player_id)?.cap_count : undefined;
  const awayCaps = away ? playerById.get(away.player_id)?.cap_count : undefined;
  return (
    <View style={styles.lineupCompareRow}>
      <Pressable
        onPress={home ? () => onPressPlayer(home.player_id) : undefined}
        disabled={!home}
        style={({ pressed }) => [styles.lineupSideLeft, pressed && { opacity: 0.6 }]}>
        {homeCaps !== undefined ? (
          <CapsJersey caps={homeCaps} glyph={homeGlyph} />
        ) : null}
        <Text
          style={[styles.lineupPosPlayer, styles.lineupNameFlex, styles.lineupPosPlayerRight]}
          numberOfLines={1}>
          {homeLabel}
        </Text>
      </Pressable>
      <View style={styles.lineupNumberBadge}>
        <Text style={styles.lineupNumberText}>{shirtNumber}</Text>
      </View>
      <Pressable
        onPress={away ? () => onPressPlayer(away.player_id) : undefined}
        disabled={!away}
        style={({ pressed }) => [styles.lineupSideRight, pressed && { opacity: 0.6 }]}>
        <Text style={[styles.lineupPosPlayer, styles.lineupNameFlex]} numberOfLines={1}>
          {awayLabel}
        </Text>
        {awayCaps !== undefined ? (
          <CapsJersey caps={awayCaps} glyph={awayGlyph} mirrored />
        ) : null}
      </Pressable>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  paneEmpty: { paddingVertical: Spacing.four, alignItems: 'center' },
  paneEmptyText: { color: Colors.light.textSecondary, fontSize: TextSize.sm, textAlign: 'center', lineHeight: 20, maxWidth: 320 },

  // Standalone inset divider under each section header — chevron-
  // chrome grey, same grammar as the list cards.
  insetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C7CBD1',
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  categoryLabel: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },

  // Line-Up section header — icon + uppercase label centred. Same
  // treatment as milestoneRow so the two panes share one section-header
  // pattern.
  lineupHeaderSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  lineupSectionHeaderSpread: {
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  lineupSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: Spacing.two,
    paddingBottom: 2,
  },

  // Matches the `statsCard` / `timelineContainer` white card so Line-Up,
  // Timeline and Stats panes share one container silhouette.
  lineupContainer: {
    gap: Spacing.two,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E3E8EF',
    padding: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  // Coaching-staff compare row — two-line stack. Row 1: role label centred.
  // Row 2: home name (left) / away name (right). Frees up full row-width
  // for each name so longer names read comfortably without truncation.
  coachingRow: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + 2,
    // Line-space between the role label and the names underneath so each
    // pairing reads as a clear "role → coaches" block rather than a
    // stacked-tight two-liner.
    gap: Spacing.two,
  },
  coachingRole: {
    fontFamily: 'WorkSans_500Medium',
    textAlign: 'center',
    fontSize: TextSize.sm,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  coachingNamesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  coachingName: {
    fontFamily: 'WorkSans_500Medium',
    flex: 1,
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  coachingNameRight: { textAlign: 'right' },

  // Official row — role (left, xs tracked textSecondary) + name (right,
  // sm bold text). One line per official; four rows total (referee, two
  // sideline, TMO). Officials are match-neutral so there's no home/away split.
  officialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + 2,
    gap: Spacing.two,
  },
  officialRole: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.sm,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  officialName: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    flexShrink: 1,
    textAlign: 'right',
  },

  lineupSectionLabel: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  // Compare row: [home #] [home player-label]   [away player-label] [away #]
  // Numbers pinned to the outer edges; each team's player-label
  // (currently the position, will become the player name when the feed
  // supplies it) sits inboard of its shirt number, closer to the centre.
  lineupCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    // Standard hairline register — was a stray #F3F4F6.
    borderBottomColor: '#E3E8EF',
  },
  // Names hug the shared centre badge — home reads toward it from the
  // left (right-aligned), away from the right (left-aligned).
  lineupSideLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  lineupSideRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // Shirt-number badge — small grey circle wrapping the tabular-nums
  // number. Same grey (#EFF2F6) used by the Stats bar tracks + KPI bar
  // tracks so all "muted-fill" surfaces in the fixture drill share one
  // token. Fixed 22 × 22 keeps a clean 11pt radius regardless of digit
  // count (single-digit numbers still centre inside a full circle).
  // Caps as an icon+value pair — small jersey glyph beside the count
  // (shirt = caps; the filled centre circle = shirt number).
  lineupCapsPair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  lineupCaps: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
  },
  lineupNameFlex: { flex: 1 },
  lineupNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    // Option B trial: quiet white badge, hairline ring; the colour
    // lives in the solid shirt glyphs instead.
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E3E8EF',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.three,
  },
  lineupNumberText: {
    // Scoreboard face — the shirt number is identity data.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  lineupJerseyBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  lineupPosPlayer: {
    fontFamily: 'WorkSans_500Medium',
    // Row text matches the Stats card label pattern: sm regular
    // textSecondary. Bold weight is reserved for the numeric read (shirt
    // number) so numbers pop and names sit as legible context around them.
    flexShrink: 1,
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  lineupPosPlayerRight: {
    textAlign: 'right',
  },
});
