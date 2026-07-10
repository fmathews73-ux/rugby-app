import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Player, Position } from '@rugby-app/shared';

import { useLatestRanking, useTeamPlayers, useTeams, useTeamsFormSummary } from '@/api/hooks';
import { TeamMatchesCard } from '@/components/my-team-matches-card';
import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { CardTitle } from '@/components/card-title';
import { FlipTrigger } from '@/components/flip-trigger';
import { buildCategoryRead } from '@/components/fixture-drill/stats-pane';
import { CountUpValue } from '@/components/insights/count-up-value';
import { useChartInk } from '@/components/insights/use-chart-ink';
import { FadingScrollView } from '@/components/fading-scroll-view';
import { TeamPreviewBlock } from '@/components/my-team-preview-cards';
import { PageGradient } from '@/components/page-gradient';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { CapsJerseyBadge, SquadJersey } from '@/components/squad-jersey';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { PAGE_BOTTOM_INSET, Colors, DRILL_HERO_MIN_HEIGHT, FlagSize, Spacing, TextSize, TextTracking, TextWeight, ScoreBoxSize } from '@/constants/theme';
import { useTeamRecentForm } from '@/hooks/use-team-recent-form';
import { TIER_1_IDS } from '@/lib/tiers';


type TeamTab = string;

// Hero outcome-dot colours — same trio as FormCircles.
const HERO_WIN = '#059669';
const HERO_LOSS = '#DC2626';
const HERO_DRAW = '#9CA3AF';

/** Position → squad-section grouping, in traditional team-sheet order. */
const POSITION_GROUPS: readonly { label: string; positions: readonly Position[] }[] = [
  { label: 'Front Row', positions: ['loose-head-prop', 'hooker', 'tight-head-prop'] },
  { label: 'Locks', positions: ['lock'] },
  { label: 'Back Row', positions: ['blindside-flanker', 'openside-flanker', 'number-8'] },
  { label: 'Half-Backs', positions: ['scrum-half', 'fly-half'] },
  { label: 'Centres', positions: ['inside-centre', 'outside-centre'] },
  { label: 'Back Three', positions: ['left-wing', 'right-wing', 'fullback'] },
];

// ONE flat pill bar, three pills (owner call 2026-07-09): the unit
// sibling pills were retired along with the stats category pills —
// the squad cards ARE the units, so the pills only duplicated them.
const TEAM_TABS: readonly { id: TeamTab; label: string }[] = [
  // Labelled Profile (owner call 2026-07-10, matching the player
  // card): the pane is the team's profile read, not a fixture preview.
  { id: 'preview', label: 'Profile' },
  { id: 'stats', label: 'Stats' },
  { id: 'squad', label: 'Squad' },
];

/** Human position labels for the player rows. */
const POSITION_LABELS: Record<Position, string> = {
  'loose-head-prop': 'Loosehead Prop',
  hooker: 'Hooker',
  'tight-head-prop': 'Tighthead Prop',
  lock: 'Lock',
  'blindside-flanker': 'Blindside Flanker',
  'openside-flanker': 'Openside Flanker',
  'number-8': 'Number 8',
  'scrum-half': 'Scrum-half',
  'fly-half': 'Fly-half',
  'left-wing': 'Left Wing',
  'inside-centre': 'Inside Centre',
  'outside-centre': 'Outside Centre',
  'right-wing': 'Right Wing',
  fullback: 'Fullback',
};

/**
 * Team hub (team overview) — the middle level of the Teams drill
 * (directory → hub → player card), structured like the fixture and
 * player drills: pinned identity header + segmented sub-tabs, pane
 * content scrolling beneath. The panes reuse the same single-team
 * components as the Home My Team stack (Profile radar, Form, Ranking
 * Trajectory, Efficiency KPIs) plus the position-grouped squad list.
 */
export default function TeamHubScreen() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const teamId = id ?? '';
  // Deep-links may request a landing pane (e.g. the player card's
  // back path builds a hub-on-Squad beneath itself, owner call
  // 2026-07-10: after a player, users browse squadmates).
  const [tab, setTab] = useState<TeamTab>(
    tabParam === 'squad' || tabParam === 'stats' ? tabParam : 'preview',
  );
  const scrollRef = useRef<ScrollView>(null);

  // Same resolve-to-top gesture as the fixture drill's sub-tabs.
  const handleTabSelect = (next: TeamTab) => {
    setTab(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };
  const isSquadView = tab === 'squad';
  const isStatsView = tab === 'stats';

  const teams = useTeams();
  const team = useMemo(
    () => teams.data?.find((t) => t.id === teamId),
    [teams.data, teamId],
  );

  const players = useTeamPlayers(teamId);

  const rankings = useLatestRanking();
  const rankRow = useMemo(
    () => rankings.data?.rows.find((r) => r.team_id === teamId) ?? null,
    [rankings.data, teamId],
  );

  // Last-5 form-guide dots (newest first) — same window and grammar as
  // the TeamHeroRow surfaces.
  // Prev-10 window drives BOTH the record tiles and the dot sequence
  // beneath them — one window, one story (owner call 2026-07-10).
  const { outcomes: outcomes10 } = useTeamRecentForm(teamId, 10);
  const wins = outcomes10.filter((o) => o === 'W').length;
  const losses = outcomes10.filter((o) => o === 'L').length;

  const squadSections = useMemo(() => {
    if (!players.data) return [];
    return POSITION_GROUPS.map((group) => {
      const groupPlayers = players.data
        .filter((p) => group.positions.includes(p.primary_position))
        .sort(
          (a, b) =>
            group.positions.indexOf(a.primary_position) -
              group.positions.indexOf(b.primary_position) ||
            a.name.localeCompare(b.name),
        );
      return {
        label: group.label,
        players: groupPlayers,
        caps: groupPlayers.reduce((sum, p) => sum + p.cap_count, 0),
      };
    }).filter((s) => s.players.length > 0);
  }, [players.data]);

  const visibleSections = squadSections;

  const squadTotals = useMemo(
    () => ({
      players: squadSections.reduce((sum, sec) => sum + sec.players.length, 0),
      caps: squadSections.reduce((sum, sec) => sum + sec.caps, 0),
    }),
    [squadSections],
  );

  if (teams.isLoading) {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safe}>
        <PageGradient />
        <LoadingState />
      </SafeAreaView>
    );
  }
  if (teams.isError || !team) {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safe}>
        <PageGradient />
        <ErrorState error={teams.error ?? new Error(`team ${teamId} not found`)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      <PageGradient />
      {/* Identity + pills pinned OUTSIDE the ScrollView. Three centred
          bands mirroring the fixture hero's grammar (date line / flags
          + score / competition · venue): full name on top, flag + code
          as the focus row, rank · points · trophies as the closing
          meta line. Form dots deliberately absent — recent form lives
          one tap away in Preview and on the directory rows. */}
      {/* Three-band hero (owner call 2026-07-10) — the locked match/
          player anatomy: rank in the date slot, W/L score tiles
          centred between the identity anchors, Last 5 + WC glyphs in
          the venue slot. */}
      <View style={styles.identityHeader}>
        {/* Date slot: the universal rank line (owner call 2026-07-10
            — trophies removed; the cabinet lives on the directory
            rows' hero ledger only). */}
        <View style={styles.heroVenueRow}>
          <Text style={styles.heroPositionLine}>
            {rankRow
              ? `World Rank #${rankRow.rank} · ${rankRow.points.toFixed(1)} pts`
              : 'Unranked'}
          </Text>
        </View>
        <View style={styles.heroRow}>
          <View style={styles.heroIdentityGroup}>
            <TeamFlagShield flagCode={team.flag_code} width={FlagSize.medium} />
            <Text style={styles.heroName}>{team.short_name}</Text>
          </View>
          <View style={styles.heroMetaStack}>
            {/* Prev-10 record in the MATCH SCORE pairing (owner call
                2026-07-10): the leading side takes the winner box
                (dark tile, inverse text), the trailing side the quiet
                grey — level records sit both-quiet like a draw. */}
            <View style={styles.heroScoreRow}>
              <View style={[styles.heroScoreBox, wins > losses && styles.heroScoreBoxWinner]}>
                <Text style={[styles.heroScoreText, wins > losses && styles.heroScoreTextWinner]}>
                  {wins}
                  <Text style={[styles.heroScoreUnit, wins > losses && styles.heroScoreTextWinner]}> W</Text>
                </Text>
              </View>
              <View style={[styles.heroScoreBox, losses > wins && styles.heroScoreBoxWinner]}>
                <Text style={[styles.heroScoreText, losses > wins && styles.heroScoreTextWinner]}>
                  {losses}
                  <Text style={[styles.heroScoreUnit, losses > wins && styles.heroScoreTextWinner]}> L</Text>
                </Text>
              </View>
            </View>
          </View>
          {/* Away-side mirror of shield+code: the CAP VALUE in the
              nation-code face beside a glyph-only jersey (owner call
              2026-07-10, matching the directory rows). */}
          <View style={styles.heroBadgeSlot}>
            <Text style={styles.heroName}>{squadTotals.caps.toLocaleString('en-GB')}</Text>
            <CapsJerseyBadge
              teamId={teamId}
              caps={0}
              size={FlagSize.medium / 0.9045}
              hideNumber
            />
          </View>
        </View>
        {/* Venue slot: the SEQUENCE behind the W/L tiles — last 10,
            newest first. */}
        <View style={styles.heroVenueRow}>
          {outcomes10.length > 0 ? (
            <>
              {outcomes10.map((o, i) => (
                <View
                  key={i}
                  style={[
                    styles.heroRecordDot,
                    {
                      backgroundColor:
                        o === 'W' ? HERO_WIN : o === 'L' ? HERO_LOSS : HERO_DRAW,
                    },
                  ]}
                />
              ))}
            </>
          ) : null}
        </View>
      </View>
      <SegmentedTabs tabs={TEAM_TABS} active={tab} onSelect={handleTabSelect} />
      <FadingScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        {tab === 'preview' && (
          <>
            {/* THE team read, identical to Home's My Team experience,
                hub-scoped: chart carousel on top (owner call
                2026-07-09, matching Home's order), then last/next
                match. The bleed unwraps the pane's 24pt padding; the
                block re-applies the card column internally (carousel
                full-width, analysis padded). */}
            <View style={styles.previewBleed}>
              <TeamPreviewBlock teamId={teamId} />
            </View>
            <TeamMatchesCard teamId={teamId} />
          </>
        )}

        {isSquadView && (
          <>
            {players.isLoading ? (
              <Text style={styles.empty}>Loading…</Text>
            ) : visibleSections.length === 0 ? (
              <Text style={styles.empty}>No squad on file.</Text>
            ) : (
              visibleSections.map((section) => (
                <View key={section.label} style={styles.card}>
                  {/* Category-card header — icon + label left, unit
                      caps/players meta right, mirroring the Teams
                      landing's MY TEAM / TIER cards. */}
                  <View style={styles.squadHeaderRow}>
                    {/* Title CENTRED over the row (owner call
                        2026-07-10); unit totals stay right-pinned. */}
                    <View style={styles.squadTitleCentreFill} pointerEvents="none">
                      <Text style={styles.sectionLabel}>{section.label}</Text>
                    </View>
                    <View style={styles.groupMetaColumn}>
                      <View style={styles.squadMetaRow}>
                        <SquadJersey teamId={teamId} />
                        <Text style={styles.sectionLabel}>
                          {section.caps.toLocaleString('en-GB')}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {/* Line-Up hairline pair: chrome-grey divider under
                      the section header; the whisper-grey row
                      separators live on each player row. */}
                  <View style={styles.squadHeaderDivider} />
                  {/* Zero-gap block: the card's 8pt child gap was
                      adding to the rows' own 16pt padding, spacing
                      squad rows 40pt apart vs the fixtures' 32. */}
                  <View>
                    {section.players.map((p) => (
                      <PlayerRow
                        key={p.id}
                        player={p}
                        teamId={teamId}
                        flagCode={team.flag_code}
                        teamCode={team.short_name}
                        onPress={() => router.push(`/teams/player/${p.id}`)}
                      />
                    ))}
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {isStatsView && <TeamStatsTable teamId={teamId} />}

      </FadingScrollView>
    </SafeAreaView>
  );
}

// ─── Stats table ────────────────────────────────────────────────────────────

// Full row parity with the fixture Stats pane (owner call
// 2026-07-09): SAME nine categories, SAME rows — only the value frame
// differs (per-game prev-10 vs tier average here; match totals
// there). Quarters becomes Halves: per-game quarter splits would need
// event-level aggregation, half splits fall out of the half-time line.
const TIER_STAT_GROUPS: readonly {
  label: string;
  description: string;
  rows: readonly { field: string; label: string; percent?: boolean; inverted?: boolean }[];
}[] = [
  {
    label: 'Overview',
    description: 'The control shares over the last 10 — possession and territory per game against the tier average, with the half-time points position.',
    rows: [
      { field: 'possessionPercent', label: 'Possession %', percent: true },
      { field: 'territoryPercent', label: 'Territory %', percent: true },
      { field: 'firstHalfPointsScored', label: 'Half-time points' },
    ],
  },
  {
    label: 'Scoring',
    description: 'How the points arrive per game over the last 10 — tries, boot and the goal-kicking return, against the tier average.',
    rows: [
      { field: 'tries', label: 'Tries' },
      { field: 'conversions', label: 'Conversions' },
      { field: 'penaltyGoals', label: 'Penalties' },
      { field: 'dropGoals', label: 'Drop goals' },
      { field: 'goalKickingPercent', label: 'Goal kicking %', percent: true },
    ],
  },
  {
    label: 'Halves',
    description: 'The shape of the eighty per game over the last 10 — points scored and conceded either side of the break, against the tier average.',
    rows: [
      { field: 'firstHalfPointsScored', label: '1st-half points' },
      { field: 'secondHalfPointsScored', label: '2nd-half points' },
      { field: 'firstHalfPointsConceded', label: '1st-half conceded', inverted: true },
      { field: 'secondHalfPointsConceded', label: '2nd-half conceded', inverted: true },
    ],
  },
  {
    label: 'Attack',
    description: 'The with-ball production line per game over the last 10 — red-zone visits and their yield, carry metres and the breaks they buy, against the tier average.',
    rows: [
      { field: 'twentyTwoEntries', label: '22 entries' },
      { field: 'pointsPerTwentyTwoEntry', label: 'Points per 22 entry' },
      { field: 'metersMade', label: 'Metres made' },
      { field: 'postContactMetres', label: 'Post-contact metres' },
      { field: 'lineBreaks', label: 'Line breaks' },
      { field: 'defendersBeaten', label: 'Defenders beaten' },
      { field: 'gainlineSuccessPercent', label: 'Gainline success %', percent: true },
      { field: 'carries', label: 'Carries' },
      { field: 'passes', label: 'Passes' },
      { field: 'offloads', label: 'Offloads' },
    ],
  },
  {
    label: 'Kicking',
    description: 'The boot per game over the last 10 — volume, metres and the contestable air battle, against the tier average.',
    rows: [
      { field: 'kicksInPlay', label: 'Kicks in play' },
      { field: 'kicksToTouch', label: 'Kicks to touch' },
      { field: 'kickMeters', label: 'Kick metres' },
      { field: 'fiftyTwentyTwos', label: '50/22 kicks' },
      { field: 'contestableKicks', label: 'Contestables kicked' },
      { field: 'contestableKicksWon', label: 'Own kicks regathered' },
      { field: 'receptionsSecured', label: 'Receptions secured' },
    ],
  },
  {
    label: 'Set-Piece',
    description: 'The platform per game over the last 10 — scrums and lineouts won and lost, against the tier average.',
    rows: [
      { field: 'scrumsWon', label: 'Scrums won' },
      { field: 'scrumsLost', label: 'Scrums lost', inverted: true },
      { field: 'lineoutsWon', label: 'Lineouts won' },
      { field: 'lineoutsLost', label: 'Lineouts lost', inverted: true },
    ],
  },
  {
    label: 'Breakdown',
    description: 'The contact-area contest per game over the last 10 — ruck and maul returns and the speed of the ball they produce, against the tier average.',
    rows: [
      { field: 'rucksWon', label: 'Rucks won' },
      { field: 'rucksLost', label: 'Rucks lost', inverted: true },
      { field: 'ruckSpeed0to3sPercent', label: 'Quick ball % (0-3s)', percent: true },
      { field: 'maulsWon', label: 'Mauls won' },
      { field: 'maulsLost', label: 'Mauls lost', inverted: true },
    ],
  },
  {
    label: 'Defence',
    description: 'The denying numbers per game over the last 10 — tackle volume, completion and the ball won back, against the tier average.',
    rows: [
      { field: 'tacklesMade', label: 'Tackles made' },
      { field: 'tackleSuccessPercent', label: 'Tackle success %', percent: true },
      { field: 'dominantTackles', label: 'Dominant tackles' },
      { field: 'turnoversWon', label: 'Turnovers won' },
      { field: 'turnoversConceded', label: 'Turnovers conceded', inverted: true },
    ],
  },
  {
    label: 'Discipline',
    description: 'The giveaway ledger per game over the last 10 — the penalty count and its causes, errors and cards, against the tier average. Lower is the win on every row.',
    rows: [
      { field: 'penaltiesConceded', label: 'Penalties conceded', inverted: true },
      { field: 'scrumPenaltiesConceded', label: 'Scrum penalties', inverted: true },
      { field: 'breakdownPenaltiesConceded', label: 'Breakdown penalties', inverted: true },
      { field: 'offsidePenaltiesConceded', label: 'Offside penalties', inverted: true },
      { field: 'handlingErrors', label: 'Handling errors', inverted: true },
      { field: 'yellowCards', label: 'Yellow cards', inverted: true },
      { field: 'redCards', label: 'Red cards', inverted: true },
    ],
  },
];

const LEADING_COLOR = '#059669';
const LAGGING_COLOR = '#DC2626';
const TIE_COLOR = Colors.light.textSecondary;

/**
 * Team Stats pane — the fixture Stats pane's exact anatomy (category
 * cards, centred labels, diverging bars, flanking values), but the
 * comparison is the team's prev-10 per-game numbers against the
 * AVERAGE OF ITS OWN TIER (Tier 1 side vs the Tier-1 mean, Tier 2 vs
 * Tier 2). Each row also carries the signed variance, coloured by
 * whether the gap favours the team (inverted-aware, so being UNDER
 * the tier average on penalties reads green).
 */
function TeamStatsTable({ teamId }: { teamId: string }) {
  // Which category's card is flipped to its narrative back (fixture
  // Stats grammar) — null when every card shows its front.
  const [flippedLabel, setFlippedLabel] = useState<string | null>(null);
  const summary = useTeamsFormSummary();
  const teams = useTeams();
  const teamCode =
    teams.data?.find((t) => t.id === teamId)?.short_name ?? teamId.toUpperCase();

  const isTier1 = TIER_1_IDS.has(teamId);
  const { subject, tierAvg } = useMemo(() => {
    const rows = summary.data ?? [];
    const subj = rows.find((r) => r.team_id === teamId);
    const members = rows.filter(
      (r) => TIER_1_IDS.has(r.team_id) === isTier1 && r.games_played > 0,
    );
    const avg: Record<string, number> = {};
    if (members.length > 0) {
      for (const key of Object.keys(members[0]!.per_game)) {
        avg[key] =
          members.reduce((sum, m) => sum + (m.per_game[key] ?? 0), 0) / members.length;
      }
    }
    return { subject: subj, tierAvg: avg };
  }, [summary.data, teamId, isTier1]);

  const tierLabel = isTier1 ? 'TIER 1 AVG' : 'TIER 2 AVG';
  if (summary.isLoading && !subject) {
    return (
      <View style={styles.card}>
        <Text style={styles.empty}>Loading…</Text>
      </View>
    );
  }
  if (!subject || subject.games_played === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.empty}>No completed matches yet.</Text>
      </View>
    );
  }

  return (
    <>
      {/* ONE card per category, stacked (fixture Stats grammar) — each
          card flips to its About + Insights back; vertical scroll, not
          a carousel: stats are scan-and-compare reads. */}
      {TIER_STAT_GROUPS.map((group) => (
        <FadeCard
          key={group.label}
          flipped={flippedLabel === group.label}
          back={
            <NarrativeBack
              title={group.label}
              onClose={() => setFlippedLabel(null)}
              purpose={group.description}
              read={buildTierRead(group, subject.per_game, tierAvg, teamCode)}
            />
          }
          front={
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <CardTitle title={group.label} />
                <View style={styles.tierHeaderRightGroup}>
                  <Text style={styles.statLegendText}>{tierLabel}</Text>
                  <Pressable
                    onPress={() => setFlippedLabel(group.label)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Read about ${group.label}`}>
                    <FlipTrigger />
                  </Pressable>
                </View>
              </View>
              <View style={styles.tierStatList}>
                {group.rows.map((row) => (
                  <TierStatBar
                    key={row.field}
                    label={row.label}
                    team={subject.per_game[row.field] ?? 0}
                    tier={tierAvg[row.field] ?? 0}
                    percent={row.percent}
                    inverted={row.inverted}
                  />
                ))}
              </View>
            </View>
          }
        />
      ))}
    </>
  );
}

/**
 * Tier-comparison Insights read — the fixture pane's category engine
 * with the tier average standing in as the away side, then sentence
 * starts re-capitalised (the "away" name is a phrase, not a code).
 */
function buildTierRead(
  group: (typeof TIER_STAT_GROUPS)[number],
  perGame: Record<string, number>,
  tierAvg: Record<string, number>,
  teamCode: string,
): string | null {
  const read = buildCategoryRead(
    {
      title: group.label,
      stats: group.rows.map((r) => ({
        label: r.label,
        home: Math.round((perGame[r.field] ?? 0) * 10) / 10,
        away: Math.round((tierAvg[r.field] ?? 0) * 10) / 10,
        inverted: r.inverted,
      })),
    },
    teamCode,
    'the rest of the tier',
    false,
  );
  return read ? read.replace(/(^|\. )([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase()) : read;
}

/** Fixture-StatBar anatomy, team vs tier average, inverted-aware. */
function TierStatBar({
  label,
  team,
  tier,
  percent,
  inverted,
}: {
  label: string;
  team: number;
  tier: number;
  percent?: boolean;
  inverted?: boolean;
}) {
  // Sweep-in driver (shared arrival grammar) — bars sweep out from the
  // centre gap and the tiles count up in sync, fixture-StatBar style.
  const ink = useChartInk();
  // Standard headroom rule (fixture Stats): the longest bar tops out
  // at 85% of its half, so grey track stays visible past both maxes
  // and bars read against a scale instead of slamming the ends.
  const MAX_FILL = 0.85;
  const maxValue = Math.max(team, tier, 1);
  const teamSegFlex = Math.max(0.001, MAX_FILL * (team / maxValue));
  const teamSpacerFlex = Math.max(0.001, 1 - MAX_FILL * (team / maxValue));
  const tierSegFlex = Math.max(0.001, MAX_FILL * (tier / maxValue));
  const tierSpacerFlex = Math.max(0.001, 1 - MAX_FILL * (tier / maxValue));

  // Better-side colouring: higher wins unless the metric is inverted.
  const variance = team - tier;
  const favourable = inverted ? variance < 0 : variance > 0;
  const isTie = Math.abs(variance) < 0.05;
  // Fixture-Stats convention: leader green, trailer red, BOTH grey
  // only when even.
  const teamColor = isTie ? TIE_COLOR : favourable ? LEADING_COLOR : LAGGING_COLOR;
  const tierColor = isTie ? TIE_COLOR : favourable ? LAGGING_COLOR : LEADING_COLOR;

  return (
    <View style={styles.tierStatBlock}>
      <View style={styles.tierStatLabelRow}>
        <Text style={styles.tierStatLabel}>{label}</Text>
      </View>
      <View style={styles.tierStatBarRow}>
        {/* Team value in the match-score tile convention: beating the
            tier average (inverted-aware) takes the winner pairing. */}
        <View style={[styles.tierValueBox, !isTie && favourable ? styles.tierValueBoxWin : null]}>
          <Text
            style={[styles.tierValueText, !isTie && favourable ? styles.tierValueTextWin : null]}>
            <CountUpValue value={formatStat(team, percent).replace('%', '')} ink={ink} />
          </Text>
        </View>
        <View style={styles.tierBarTrack}>
          <View style={styles.tierBarHalfLeft}>
            <Animated.View
              style={[
                styles.tierBarSeg,
                {
                  flex: teamSegFlex,
                  backgroundColor: teamColor,
                  // Anchored on the centre gap; sweeps outward.
                  transformOrigin: 'right',
                  transform: [{ scaleX: ink }],
                },
              ]}
            />
            <View style={{ flex: teamSpacerFlex }} />
          </View>
          <View style={styles.tierBarCentreGap} />
          <View style={styles.tierBarHalfRight}>
            <Animated.View
              style={[
                styles.tierBarSeg,
                {
                  flex: tierSegFlex,
                  backgroundColor: tierColor,
                  transformOrigin: 'left',
                  transform: [{ scaleX: ink }],
                },
              ]}
            />
            <View style={{ flex: tierSpacerFlex }} />
          </View>
        </View>
        <View style={styles.tierValueBox}>
          <Text style={styles.tierValueText}>
            <CountUpValue value={formatStat(tier, percent).replace('%', '')} ink={ink} />
          </Text>
        </View>
      </View>
    </View>
  );
}

function formatStat(v: number, percent?: boolean): string {
  const r = Math.round(v * 10) / 10;
  const s = Number.isInteger(r) ? String(r) : r.toFixed(1);
  return percent ? `${s}%` : s;
}

function PlayerRow({
  player,
  teamId,
  flagCode,
  teamCode,
  onPress,
}: {
  player: Player;
  teamId: string;
  flagCode: string;
  teamCode: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.playerRow, pressed && styles.playerRowPressed]}>
      {/* Fixture-row geometry (owner call 2026-07-10): centred
          matchup cluster + meta line beneath, chevron absolute at the
          edge. Identity = caps-on-jersey badge + two-line nameplate;
          middle = the YRS/CM/KG boxes in the row score register. */}
      <View style={styles.playerMatchupRow}>
        {/* EDGE-ANCHORED wings (owner catch 2026-07-10): equal flexes
            put every jersey on one left edge and every shield on one
            right edge, with the box pair dead-centre — a centred
            cluster drifted with name length. */}
        <View style={styles.playerLeftWing}>
          {/* Row-shield-height rule: badge = FlagSize.row ÷ 0.9045. */}
          <CapsJerseyBadge
            teamId={teamId}
            caps={player.cap_count}
            size={FlagSize.row / 0.9045}
          />
          <View style={styles.playerNameStack}>
            <Text style={styles.playerName} numberOfLines={1}>
              {givenNames(player.name)}
            </Text>
            <Text style={styles.playerName} numberOfLines={1}>
              {surname(player.name)}
            </Text>
          </View>
        </View>
        {/* Away anchor — CODE then shield, right-edge flush. */}
        <View style={styles.playerRightWing}>
          <Text style={styles.playerTeamCode}>{teamCode}</Text>
          <View style={styles.playerFlagWrap}>
            <TeamFlagShield flagCode={flagCode} width={FlagSize.row} />
          </View>
        </View>
        <View style={styles.playerMiddle}>
          {/* Two boxes, not three — age lives on the meta line
              (player-hero parity; the YRS box duplicated it). */}
          <View style={styles.playerScoreBox}>
            <Text style={styles.playerScoreText}>
              {player.height_cm}
              <Text style={styles.playerUnitText}> CM</Text>
            </Text>
          </View>
          <View style={styles.playerScoreBox}>
            <Text style={styles.playerScoreText}>
              {player.weight_kg}
              <Text style={styles.playerUnitText}> KG</Text>
            </Text>
          </View>
        </View>
        <View style={styles.playerRowChevron}>
          <Ionicons name="chevron-forward" size={16} color="#C7CBD1" />
        </View>
      </View>
      <Text style={styles.playerMetaLine}>
        {POSITION_LABELS[player.primary_position]} · {ageFrom(player.date_of_birth)}
      </Text>
    </Pressable>
  );
}

function givenNames(full: string): string {
  const i = full.lastIndexOf(' ');
  return i === -1 ? full : full.slice(0, i);
}

function surname(full: string): string {
  const i = full.lastIndexOf(' ');
  return i === -1 ? '' : full.slice(i + 1);
}

function ageFrom(dobIso: string): number {
  const dob = new Date(dobIso);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (beforeBirthday) age--;
  return age;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: {
    paddingHorizontal: Spacing.four,
    // 16pt drop from the pill strip into the pane — matches the fixture
    // drill's pane paddingTop so all three drills share one rhythm.
    paddingTop: Spacing.three,
    paddingBottom: PAGE_BOTTOM_INSET,
    gap: Spacing.three,
  },
  // Carousel pages are full screen width — bleed out of the pane's
  // 24pt padding; pages re-apply the card column internally.
  // Preview-block bleed: unwraps the pane padding AND carries the
  // 16pt inter-card rhythm the block's children expect from Home.
  previewBleed: { marginHorizontal: -Spacing.four, gap: Spacing.three },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.three,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  // Pinned white surface above the pill strip — same chrome as the
  // fixture drill's matchup hero: 24/16/16 padding and its own hairline
  // separating the hero from the pill strip.
  identityHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
    // Shared drill-hero box — three centred bands fill the fixture
    // hero's height so all drills measure identically.
    minHeight: DRILL_HERO_MIN_HEIGHT,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  // Single hero row: identity group left, meta stack filling the right.
  // Match-hero symmetry (owner call 2026-07-10): identity slots at
  // the wings, wider centre for the meta ledger — same slot recipe as
  // the player heroes and matchupTopRow.
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
    gap: Spacing.two,
  },
  // FIXED equal wings (owner symmetry call): flex shares let the
  // wider shield+code side starve the centre — fixed 100pt wings keep
  // the anchors symmetric AND the rank ledger on one line.
  heroIdentityGroup: {
    width: 88,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  heroName: {
    // 40pt-shield rule: nation codes beside a medium shield use the
    // sport-display face at xl.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.xl,
    letterSpacing: TextTracking.wide,
    color: Colors.light.text,
  },
  // Meta stack — the two quiet lines (head coach; rank · points ·
  // trophies) left-aligned one above the other in the right-hand space.
  // Meta block sits in the match hero's score slot: the BLOCK is
  // centred between the two identity anchors, but its lines LEFT-ALIGN
  // to each other (owner call 2026-07-10) so Rank/Last 5/WC read as
  // one ledger.
  heroMetaStack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  heroBadgeSlot: {
    width: 88,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  heroTrophyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  heroRecordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroRecordDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  heroPositionLine: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  heroVenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  // Match hero's card score-box register — W/L record pair.
  heroScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  heroScoreBox: {
    // Hug the numerals broadcast-bug style — the match score box /
    // player CM-KG anatomy (owner call 2026-07-10, superseding the
    // fixed-width trial).
    minWidth: ScoreBoxSize.card.width,
    height: ScoreBoxSize.card.height,
    borderRadius: ScoreBoxSize.card.borderRadius,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  heroScoreText: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.xl,
    color: Colors.light.textSecondary,
  },
  heroScoreBoxWinner: { backgroundColor: Colors.light.textSecondary },
  heroScoreTextWinner: { color: Colors.light.textInverse },
  heroScoreUnit: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 8,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  heroMetaText: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  sectionLabel: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  // Card-header row: section label left, xs team flag right — same
  // anchor treatment as the Form / Trajectory / KPI cards.
  // Under the unit header, full content width — the card's padding
  // provides the inset (unlike Line-Up's unpadded list cards).
  squadHeaderDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C7CBD1',
  },
  squadHeaderRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  squadTitleCentreFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  // Tappable group header — label left, count + chevron right. Hairline
  // beneath separates the header from the rows when expanded and from
  // the next header when collapsed.
  squadTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  // Icon + value meta pairs (shirt = caps, people = players).
  squadMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playerRow: {
    // Fixture-row geometry: 16pt vertical padding, 4pt band gap.
    paddingVertical: Spacing.three,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  playerRowPressed: { opacity: 0.6 },
  // Wings intrinsic at the edges, box pair ABSOLUTE-CENTRED over the
  // row (owner catch 2026-07-10: unequal wings shoved a flexed middle
  // off-centre) — jerseys flush left, shields flush right of a
  // reserved chevron lane, boxes dead-centre on the card.
  playerMatchupRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Chevron lane — the shield stops here, the chevron owns the edge.
    paddingRight: 18,
  },
  playerLeftWing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  playerRightWing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // Budgeted so the longest surnames clear the centred box pair.
  playerNameStack: {
    maxWidth: 66,
  },
  playerName: {
    // Identity register — the condensed face in black, same as the
    // nation codes; names ARE identity data.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    // Hero proportion law: name = code × (md 14 / xl 22) ≈ 0.64.
    // Row code is lg 16 → name 16 × 0.64 ≈ 10 (xs).
    fontSize: TextSize.xs,
    textTransform: 'uppercase',
    letterSpacing: TextTracking.wide,
    color: Colors.light.text,
  },
  playerMeta: {
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
  },
  // Measurables lines — icon+value pairs WITH units (owner call
  // 2026-07-09: icons alone aren't self-describing); caps sit on
  // their own third line.
  playerScoreBox: {
    ...ScoreBoxSize.row,
    minWidth: ScoreBoxSize.row.width + 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  playerScoreText: {
    fontSize: TextSize.lg,
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    color: Colors.light.textSecondary,
  },
  playerUnitText: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 7,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  playerTeamCode: {
    // 24pt-shield rule: sport-display face at lg beside row shields.
    width: 40,
    textAlign: 'center',
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.text,
  },
  playerFlagWrap: {
    width: FlagSize.row,
    height: FlagSize.row,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerRowChevron: {
    position: 'absolute',
    right: -4,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerMetaLine: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  // Header totals hug the card's RIGHT edge (owner call 2026-07-09)
  // — the card padding gives the same inset the title has on the left.
  groupMetaColumn: {
    marginLeft: Spacing.two,
    alignItems: 'flex-end',
  },
  // Fixed-width middle slot — the fixture row's score column, three
  // boxes wide.
  playerMiddle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },

  // Stats pane — fixture Stats anatomy: legend row, category cards,
  // centred labels with variance, diverging team-vs-tier bars.
  statLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
  statLegendLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLegendText: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.xs,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  tierHeaderRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  tierStatList: {
    gap: Spacing.two + 4,
    marginTop: Spacing.one,
  },
  // One tier group inside a (possibly two-group) card.
  tierStatGroupBlock: { gap: Spacing.one },
  // Second group in a paired card gets extra air above its header so
  // the category boundary reads clearly.
  tierStatGroupFollowing: { marginTop: Spacing.three },
  tierStatBlock: { gap: 6 },
  tierStatLabelRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
  },
  tierStatLabel: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  tierStatBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Score tiles for team vs tier values — winner pairing only when the
  // team beats the tier average (the average itself stays quiet).
  tierValueBox: {
    width: 44,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierValueBoxWin: { backgroundColor: Colors.light.textSecondary },
  tierValueText: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.textSecondary,
  },
  tierValueTextWin: { color: Colors.light.textInverse },
  tierBarTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tierBarHalfLeft: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    height: 4,
  },
  tierBarHalfRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 4,
  },
  tierBarSeg: {
    height: 4,
    borderRadius: 2,
  },
  tierBarCentreGap: { width: 4 },

});
