import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Player, Position } from '@rugby-app/shared';

import { useLatestRanking, useTeamCoachingStaff, useTeamPlayers, useTeams, useTeamsFormSummary } from '@/api/hooks';
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
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { PAGE_BOTTOM_INSET, Colors, DRILL_HERO_MIN_HEIGHT, FlagSize, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamRecentForm } from '@/hooks/use-team-recent-form';
import { JerseyAvatar } from '@/components/jersey-avatar';
import { WORLD_CUP_WINS, TROPHY_COLOR } from '@/lib/honours';
import { TEAM_JERSEY } from '@/lib/team-colors';
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

// ONE flat pill bar (owner call 2026-07-07): Preview and Stats, then
// Squad and its six positional units as SIBLING pills — a unit pill
// is simply the squad view filtered to that unit; Squad shows all.
// Declared after POSITION_GROUPS, which it spreads.
const TEAM_TABS: readonly { id: TeamTab; label: string }[] = [
  { id: 'preview', label: 'Preview' },
  { id: 'stats', label: 'Stats' },
  { id: 'squad', label: 'Squad' },
  ...POSITION_GROUPS.map((g) => ({ id: g.label, label: g.label })),
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const teamId = id ?? '';
  const [tab, setTab] = useState<TeamTab>('preview');
  const scrollRef = useRef<ScrollView>(null);

  // Same resolve-to-top gesture as the fixture drill's sub-tabs.
  const handleTabSelect = (next: TeamTab) => {
    setTab(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };
  const [squadInfoOpen, setSquadInfoOpen] = useState(false);
  // Squad view when the Squad pill OR any unit pill is active; a unit
  // pill filters to that unit, Squad shows all.
  const isSquadView = tab === 'squad' || POSITION_GROUPS.some((g) => g.label === tab);
  const isStatsView = tab === 'stats';

  const teams = useTeams();
  const team = useMemo(
    () => teams.data?.find((t) => t.id === teamId),
    [teams.data, teamId],
  );

  const players = useTeamPlayers(teamId);

  const staff = useTeamCoachingStaff(teamId);
  const headCoach = useMemo(
    () => staff.data?.find((c) => c.role === 'head-coach') ?? null,
    [staff.data],
  );

  const rankings = useLatestRanking();
  const rankRow = useMemo(
    () => rankings.data?.rows.find((r) => r.team_id === teamId) ?? null,
    [rankings.data, teamId],
  );

  // Last-5 form-guide dots (newest first) — same window and grammar as
  // the TeamHeroRow surfaces.
  const { outcomes } = useTeamRecentForm(teamId, 5);

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

  const visibleSections =
    tab === 'squad'
      ? squadSections
      : squadSections.filter((sec) => sec.label === tab);

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
      <View style={styles.identityHeader}>
        {/* Left-anchored identity: flag + nation CODE (name or code,
            never both). The two meta text rows stack centred in the
            remaining right-hand space. */}
        <View style={styles.heroRow}>
          <View style={styles.heroIdentityGroup}>
            <TeamFlagShield flagCode={team.flag_code} width={FlagSize.medium} />
            <Text style={styles.heroName}>{team.short_name}</Text>
          </View>
          <View style={styles.heroMetaStack}>
            {headCoach ? (
              <Text style={styles.heroMetaText}>Head Coach · {headCoach.name}</Text>
            ) : null}
            <Text style={styles.heroMetaText}>
              {rankRow ? `World Rank #${rankRow.rank} · ${rankRow.points.toFixed(1)} pts` : 'Unranked'}
            </Text>
            {WORLD_CUP_WINS[teamId] ? (
              <View style={styles.heroTrophyRow}>
                <Text style={styles.heroMetaText}>World Champions · </Text>
                {Array.from({ length: WORLD_CUP_WINS[teamId]! }).map((_, i) => (
                  <Ionicons key={i} name="trophy" size={12} color={TROPHY_COLOR} />
                ))}
              </View>
            ) : null}
            {squadTotals.players > 0 ? (
              <View style={styles.heroRecordRow}>
                <Text style={styles.heroMetaText}>
                  {squadTotals.caps.toLocaleString('en-GB')} Caps · {squadTotals.players} Players
                </Text>
              </View>
            ) : null}
            {outcomes.length > 0 ? (
              <View style={styles.heroRecordRow}>
                <Text style={styles.heroMetaText}>Last {outcomes.length} · </Text>
                {outcomes.map((o, i) => (
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
              </View>
            ) : null}
          </View>
        </View>
      </View>
      <SegmentedTabs tabs={TEAM_TABS} active={tab} onSelect={handleTabSelect} />
      <FadingScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        {tab === 'preview' && (
          <>
            {/* THE team read, identical to Home's My Team experience,
                hub-scoped: next/last match, then the synced chart
                carousel + Team Analysis accordion. The bleed unwraps
                the pane's 24pt padding; the block re-applies the card
                column internally (carousel full-width, analysis
                padded). */}
            <TeamMatchesCard teamId={teamId} />
            <View style={styles.previewBleed}>
              <TeamPreviewBlock teamId={teamId} />
            </View>
          </>
        )}

        {isSquadView && (
          <>
            <Modal
              visible={squadInfoOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setSquadInfoOpen(false)}>
              <Pressable style={styles.modalBackdrop} onPress={() => setSquadInfoOpen(false)}>
                <Pressable style={styles.modalCard} onPress={() => {}}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Squad</Text>
                    <Pressable
                      onPress={() => setSquadInfoOpen(false)}
                      hitSlop={10}
                      accessibilityLabel="Close">
                      <Ionicons name="close" size={20} color={Colors.light.text} />
                    </Pressable>
                  </View>
                  <Text style={styles.modalBody}>
                    The full player pool grouped into positional units in
                    team-sheet order — front row through to the back three. The{' '}
                    <Ionicons name="shirt-outline" size={12} color={Colors.light.text} />{' '}
                    figure is the unit&apos;s combined <Text style={styles.modalStrong}>caps</Text>{' '}
                    (international appearances) and the{' '}
                    <Ionicons name="people-outline" size={12} color={Colors.light.text} />{' '}
                    figure its player count.
                  </Text>
                  <Text style={styles.modalBody}>
                    Compare the units&apos; caps to see where the experience is
                    concentrated: a pack carrying most of the caps points to a
                    forward-led, set-piece side; caps loaded in the back line
                    suggest the attacking know-how lives out wide. Units light on
                    caps are where a coach is blooding the next generation.
                  </Text>
                </Pressable>
              </Pressable>
            </Modal>
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
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.squadTitleGroup}>
                      <Text style={styles.sectionLabel}>{section.label}</Text>
                    </View>
                  <View style={styles.insetDivider} />
                    {/* Same fixed column as the player-row meta below,
                        so the unit totals left-align with every meta
                        line in the card. */}
                    <View style={styles.groupMetaColumn}>
                      <View style={styles.squadMetaRow}>
                        <Ionicons name="shirt-outline" size={12} color={Colors.light.textSecondary} />
                        <Text style={styles.sectionLabel}>
                          {section.caps.toLocaleString('en-GB')}
                        </Text>
                        <Ionicons name="people-outline" size={12} color={Colors.light.textSecondary} style={styles.squadMetaSecondIcon} />
                        <Text style={styles.sectionLabel}>{section.players.length}</Text>
                      </View>
                    </View>
                  </View>
                  {section.players.map((p) => (
                    <PlayerRow
                      key={p.id}
                      player={p}
                      teamId={teamId}
                      onPress={() => router.push(`/teams/player/${p.id}`)}
                    />
                  ))}
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

const TIER_STAT_GROUPS: readonly {
  label: string;
  description: string;
  rows: readonly { field: string; label: string; percent?: boolean; inverted?: boolean }[];
}[] = [
  {
    label: 'Attack',
    description: 'The with-ball production line over the last 10: points, tries and metres a game, red-zone visits and their yield, plus possession and territory share. Every bar runs against the tier average.',
    rows: [
      { field: 'pointsScored', label: 'Points scored' },
      { field: 'tries', label: 'Tries' },
      { field: 'metersMade', label: 'Metres made' },
      { field: 'lineBreaks', label: 'Line breaks' },
      { field: 'twentyTwoEntries', label: '22 entries' },
      { field: 'pointsPerTwentyTwoEntry', label: 'Points per 22 entry' },
      { field: 'possessionPercent', label: 'Possession', percent: true },
      { field: 'territoryPercent', label: 'Territory', percent: true },
    ],
  },
  {
    label: 'Kicking',
    description: 'The boot per game over the last 10: kicks in play, kick metres and the goal-kicking return, each against the tier average.',
    rows: [
      { field: 'kicksInPlay', label: 'Kicks in play' },
      { field: 'kickMeters', label: 'Kick metres' },
      { field: 'goalKickingPercent', label: 'Goal kicking', percent: true },
    ],
  },
  {
    label: 'Defence',
    description: 'The denying numbers over the last 10: points and tries conceded, tackle completion and turnovers won, against the tier average.',
    rows: [
      { field: 'pointsConceded', label: 'Points conceded', inverted: true },
      { field: 'triesConceded', label: 'Tries conceded', inverted: true },
      { field: 'tackleSuccessPercent', label: 'Tackle success', percent: true },
      { field: 'turnoversWon', label: 'Turnovers won' },
    ],
  },
  {
    label: 'Set piece',
    description: 'Scrum and lineout success rates over the last 10 against the tier average: the platform the rest of the game is built on.',
    rows: [
      { field: 'scrumSuccessPercent', label: 'Scrum success', percent: true },
      { field: 'lineoutSuccessPercent', label: 'Lineout success', percent: true },
    ],
  },
  {
    label: 'Discipline',
    description: 'The giveaway ledger over the last 10: penalties, handling errors, turnovers conceded and cards, against the tier average. Lower is the win on every row.',
    rows: [
      { field: 'penaltiesConceded', label: 'Penalties conceded', inverted: true },
      { field: 'handlingErrors', label: 'Handling errors', inverted: true },
      { field: 'turnoversConceded', label: 'Turnovers conceded', inverted: true },
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
  const maxValue = Math.max(team, tier, 1);
  const teamSegFlex = Math.max(0.001, team / maxValue);
  const teamSpacerFlex = Math.max(0.001, 1 - team / maxValue);
  const tierSegFlex = Math.max(0.001, tier / maxValue);
  const tierSpacerFlex = Math.max(0.001, 1 - tier / maxValue);

  // Better-side colouring: higher wins unless the metric is inverted.
  const variance = team - tier;
  const favourable = inverted ? variance < 0 : variance > 0;
  const isTie = Math.abs(variance) < 0.05;
  const teamColor = isTie ? TIE_COLOR : favourable ? LEADING_COLOR : LAGGING_COLOR;
  const tierColor = TIE_COLOR;

  const varText = `${variance >= 0 ? '+' : ''}${formatStat(variance, percent)}`;

  return (
    <View style={styles.tierStatBlock}>
      <View style={styles.tierStatLabelRow}>
        <Text style={styles.tierStatLabel}>{label}</Text>
        <Text
          style={[
            styles.tierStatVariance,
            { color: isTie ? TIE_COLOR : favourable ? LEADING_COLOR : LAGGING_COLOR },
          ]}>
          {' '}{varText}
        </Text>
      </View>
      <View style={styles.tierStatBarRow}>
        {/* Team value in the match-score tile convention: beating the
            tier average (inverted-aware) takes the winner pairing. */}
        <View style={[styles.tierValueBox, !isTie && favourable ? styles.tierValueBoxWin : null]}>
          <Text
            style={[styles.tierValueText, !isTie && favourable ? styles.tierValueTextWin : null]}>
            <CountUpValue value={formatStat(team, percent).replace('%', '')} ink={ink} />
            {percent ? '%' : ''}
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
            {percent ? '%' : ''}
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
  onPress,
}: {
  player: Player;
  teamId: string;
  onPress: () => void;
}) {
  const age = ageFrom(player.date_of_birth);
  const jersey = TEAM_JERSEY[teamId];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.playerRow, pressed && styles.playerRowPressed]}>
      {/* Teams-landing row grammar: 40pt avatar where the flag ball
          sits. Teams with a jersey-colour entry get the coloured shirt
          badge (colours are factual — no crests, register #28);
          everyone else keeps the anonymous grey glyph. */}
      <JerseyAvatar jersey={jersey} size={40} />
      {/* First name over surname — two short lines instead of one
          truncated one now the chevron shares the row. */}
      <View style={styles.playerNameStack}>
        <Text style={styles.playerName} numberOfLines={1}>
          {givenNames(player.name)}
        </Text>
        <Text style={styles.playerName} numberOfLines={1}>
          {surname(player.name)}
        </Text>
      </View>
      <View style={styles.playerMetaStack}>
        <Text style={styles.playerMeta}>
          {POSITION_LABELS[player.primary_position]} · {age}
        </Text>
        <Text style={styles.playerMeta}>{player.cap_count} caps</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#C7CBD1" />
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
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: Spacing.three,
  },
  heroIdentityGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
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
  heroMetaStack: {
    flex: 1,
    alignItems: 'flex-start',
    gap: Spacing.one,
    paddingLeft: Spacing.four,
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
  // Standalone inset divider — chevron-chrome grey, list-card grammar.
  insetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C7CBD1',
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
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
  squadMetaSecondIcon: { marginLeft: 6 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  playerRowPressed: { opacity: 0.6 },
  playerNameStack: {
    // Flexible column so the fixed-width meta stack beside it always
    // starts at the same x — meta text forms one left-aligned column
    // down the card regardless of name length.
    flex: 1,
  },
  playerName: {
    // Identity register — the condensed face in black, same as the
    // nation codes; names ARE identity data.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    textTransform: 'uppercase',
    letterSpacing: TextTracking.wide,
    color: Colors.light.text,
  },
  playerMeta: {
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
  },
  // Mirrors playerMetaStack's column so header totals and row meta
  // share one left edge.
  groupMetaColumn: {
    width: 120,
    marginLeft: Spacing.two,
    alignItems: 'flex-start',
  },
  playerMetaStack: {
    // Narrow meta column pushed toward the card's right edge —
    // maximum room for full surnames, meta still one aligned column.
    width: 120,
    marginLeft: Spacing.two,
    alignItems: 'flex-start',
    gap: 2,
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
    gap: Spacing.two,
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
  tierStatVariance: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.xs,
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

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.four,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: TextSize.lg,
    color: Colors.light.text,
  },
  modalBody: {
    fontSize: TextSize.sm,
    color: Colors.light.text,
    lineHeight: 20,
  },
  modalStrong: {
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
  },
});
