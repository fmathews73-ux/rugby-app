import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Player, Position } from '@rugby-app/shared';

import { useLatestRanking, useTeamPlayers, useTeams } from '@/api/hooks';
import { FormCircles } from '@/components/form-circles';
import { InsightsCanvas } from '@/components/insights/insights-canvas';
import { EfficiencyKpis } from '@/components/insights/efficiency-kpis';
import { ExtendedMomentum } from '@/components/insights/extended-momentum';
import { RankingTrajectory } from '@/components/insights/ranking-trajectory';
import { PointsPattern } from '@/components/insights/points-pattern';
import { PageGradient } from '@/components/page-gradient';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, DRILL_HERO_MIN_HEIGHT, FlagSize, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamAggregate } from '@/hooks/use-team-aggregate';
import { useTeamAnalysis } from '@/hooks/use-team-analysis';
import { useTeamRecentForm } from '@/hooks/use-team-recent-form';
import { initialsOf } from '@/lib/initials';
import { worldCupTitles } from '@/lib/world-cup-titles';

const FORM_LOOKBACK = 5;

type TeamTab = 'preview' | 'squad' | 'stats' | 'insights' | 'analysis';

const TEAM_TABS: readonly { id: TeamTab; label: string }[] = [
  // Same arc as the fixture drill, team-scoped, with context-aware
  // pane contents: Preview = team performance to date (the SAME card
  // set as the fixture drill's Preview, single-team scoped), Squad =
  // the cast, Stats = the numeric record (per-game averages), Insights
  // = TEAM-specific analytics (profile radar + scoring patterns),
  // Analysis = the written synthesis.
  { id: 'preview', label: 'Preview' },
  { id: 'squad', label: 'Squad' },
  { id: 'stats', label: 'Stats' },
  { id: 'insights', label: 'Insights' },
  { id: 'analysis', label: 'Analysis' },
];

// Stats window: last-10 completed matches, not calendar months — the
// international calendar is lumpy (a 3-month window can hold 0 or 7
// Tests), so a match-count window keeps the sample stable and matches
// the "prev. 10" convention used by Form / Scouting / percentiles.
const STATS_LOOKBACK = 10;

/** Position → squad-section grouping, in traditional team-sheet order. */
const POSITION_GROUPS: readonly { label: string; positions: readonly Position[] }[] = [
  { label: 'Front Row', positions: ['loose-head-prop', 'hooker', 'tight-head-prop'] },
  { label: 'Locks', positions: ['lock'] },
  { label: 'Back Row', positions: ['blindside-flanker', 'openside-flanker', 'number-8'] },
  { label: 'Half-Backs', positions: ['scrum-half', 'fly-half'] },
  { label: 'Centres', positions: ['inside-centre', 'outside-centre'] },
  { label: 'Back Three', positions: ['left-wing', 'right-wing', 'fullback'] },
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
  // Position groups the user has expanded. Collapsed by default — a
  // 45-player pool rolled up into six group headers keeps the card
  // compact; users open only the units they're interested in.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const teams = useTeams();
  const team = useMemo(
    () => teams.data?.find((t) => t.id === teamId),
    [teams.data, teamId],
  );

  const players = useTeamPlayers(teamId);
  const { outcomes } = useTeamRecentForm(teamId, FORM_LOOKBACK);

  const rankings = useLatestRanking();
  const rank = useMemo(
    () => rankings.data?.rows.find((r) => r.team_id === teamId)?.rank ?? null,
    [rankings.data, teamId],
  );

  const squadSections = useMemo(() => {
    if (!players.data) return [];
    return POSITION_GROUPS.map((group) => ({
      label: group.label,
      players: players.data
        .filter((p) => group.positions.includes(p.primary_position))
        .sort(
          (a, b) =>
            group.positions.indexOf(a.primary_position) -
              group.positions.indexOf(b.primary_position) ||
            a.name.localeCompare(b.name),
        ),
    })).filter((s) => s.players.length > 0);
  }, [players.data]);

  if (teams.isLoading) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.safe}>
        <PageGradient />
        <LoadingState />
      </SafeAreaView>
    );
  }
  if (teams.isError || !team) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.safe}>
        <PageGradient />
        <ErrorState error={teams.error ?? new Error(`team ${teamId} not found`)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <PageGradient />
      {/* Identity + pills pinned OUTSIDE the ScrollView, mirroring the
          fixture and player drill anatomy. Same grammar as the Home
          Team Selector card: flag + CODE / #rank stack on the left,
          form circles + trophy badge on the right. */}
      <View style={styles.identityHeader}>
        <View style={styles.headerRow}>
          <View style={styles.teamGroup}>
            <TeamFlagBall2D flagCode={team.flag_code} size={FlagSize.header} />
            <View style={styles.teamTextStack}>
              <Text style={styles.teamCode}>{team.short_name}</Text>
              {rank !== null ? <Text style={styles.teamRank}>#{rank}</Text> : null}
            </View>
          </View>
          <View style={styles.headerRight}>
            <FormCircles outcomes={outcomes} lookback={FORM_LOOKBACK} />
            {worldCupTitles(team.id) > 0 ? (
              <View style={styles.trophyBadge}>
                <Ionicons name="trophy" size={12} color={Colors.light.textSecondary} />
                <Text style={styles.trophyCount}>X{worldCupTitles(team.id)}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
      <SegmentedTabs tabs={TEAM_TABS} active={tab} onSelect={handleTabSelect} />

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        {tab === 'preview' && (
          <>
            {/* Same backdrop card set as the fixture drill's Preview
                (Form → Trajectory → KPIs), single-team scoped. */}
            <ExtendedMomentum teamId={teamId} />
            <RankingTrajectory teamId={teamId} />
            <EfficiencyKpis teamId={teamId} />
          </>
        )}

        {tab === 'squad' && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionLabel}>Squad</Text>
              <TeamFlagBall2D flagCode={team.flag_code} size={FlagSize.xs} />
            </View>
            {players.isLoading ? (
              <Text style={styles.empty}>Loading…</Text>
            ) : squadSections.length === 0 ? (
              <Text style={styles.empty}>No squad on file.</Text>
            ) : (
              squadSections.map((section) => {
                const expanded = expandedGroups.has(section.label);
                return (
                  <View key={section.label} style={styles.squadSection}>
                    {/* Group header — tap to roll the unit open / closed.
                        Count keeps the collapsed state informative. */}
                    <Pressable
                      onPress={() => toggleGroup(section.label)}
                      style={({ pressed }) => [
                        styles.squadGroupHeader,
                        pressed && { opacity: 0.6 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${section.label}`}>
                      <Text style={styles.squadSectionLabel}>{section.label}</Text>
                      <View style={styles.squadGroupHeaderRight}>
                        <Text style={styles.squadGroupCount}>{section.players.length}</Text>
                        <Ionicons
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={14}
                          color={Colors.light.textSecondary}
                        />
                      </View>
                    </Pressable>
                    {expanded
                      ? section.players.map((p) => (
                          <PlayerRow
                            key={p.id}
                            player={p}
                            onPress={() => router.push(`/teams/player/${p.id}`)}
                          />
                        ))
                      : null}
                  </View>
                );
              })
            )}
          </View>
        )}

        {tab === 'stats' && <TeamStatsTable teamId={teamId} />}

        {tab === 'insights' && (
          <>
            {/* TEAM-specific analytics — the team-scoped counterpart of
                the fixture drill's match-specific Insights: profile
                radar, then when-do-they-score / when-do-they-leak
                patterns averaged over completed matches. */}
            <InsightsCanvas primaryTeamId={teamId} />
            <PointsPattern teamId={teamId} mode="scored" />
            <PointsPattern teamId={teamId} mode="conceded" />
          </>
        )}

        {tab === 'analysis' && <TeamAnalysisCard teamId={teamId} />}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Stats table ────────────────────────────────────────────────────────────

const STAT_COL_WIDTH = 64;

type TeamStatField = keyof ReturnType<typeof useTeamAggregate> extends never
  ? never
  : keyof NonNullable<ReturnType<typeof useTeamAggregate>['data']>['perGame'];

const TEAM_STAT_GROUPS: readonly {
  label: string;
  rows: readonly { field: TeamStatField; label: string; percent?: boolean }[];
}[] = [
  {
    label: 'Attack',
    rows: [
      { field: 'pointsScored', label: 'Points scored' },
      { field: 'tries', label: 'Tries' },
      { field: 'metersMade', label: 'Metres made' },
      { field: 'lineBreaks', label: 'Line breaks' },
      { field: 'possessionPercent', label: 'Possession', percent: true },
      { field: 'territoryPercent', label: 'Territory', percent: true },
    ],
  },
  {
    label: 'Kicking',
    rows: [
      { field: 'kicksInPlay', label: 'Kicks in play' },
      { field: 'kickMeters', label: 'Kick metres' },
    ],
  },
  {
    label: 'Defence',
    rows: [
      { field: 'pointsConceded', label: 'Points conceded' },
      { field: 'triesConceded', label: 'Tries conceded' },
      { field: 'tackleSuccessPercent', label: 'Tackle success', percent: true },
      { field: 'turnoversWon', label: 'Turnovers won' },
    ],
  },
  {
    label: 'Set piece',
    rows: [
      { field: 'scrumSuccessPercent', label: 'Scrum success', percent: true },
      { field: 'lineoutSuccessPercent', label: 'Lineout success', percent: true },
    ],
  },
  {
    label: 'Discipline',
    rows: [
      { field: 'penaltiesConceded', label: 'Penalties conceded' },
      { field: 'handlingErrors', label: 'Handling errors' },
      { field: 'turnoversConceded', label: 'Turnovers conceded' },
      { field: 'yellowCards', label: 'Yellow cards' },
      { field: 'redCards', label: 'Red cards' },
    ],
  },
];

/**
 * Team Stats pane — per-game AVERAGES over the last-10 window alongside
 * the full-season baseline, grouped by category. Match-count window
 * (not months): the international calendar is too lumpy for calendar
 * windows to hold a stable sample.
 */
function TeamStatsTable({ teamId }: { teamId: string }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const recent = useTeamAggregate(teamId, undefined, STATS_LOOKBACK);
  const season = useTeamAggregate(teamId);

  const loading = (recent.isLoading || season.isLoading) && !recent.data;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderTitleGroup}>
          <Text style={styles.sectionLabel}>Team Averages</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the team averages">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : !recent.data || recent.data.gamesPlayed === 0 ? (
        <Text style={styles.empty}>No completed matches yet.</Text>
      ) : (
        <>
          <Text style={styles.statSubMeta}>
            per game · {recent.data.gamesPlayed} recent / {season.data?.gamesPlayed ?? 0} season matches
          </Text>
          <View style={styles.statColHeadRow}>
            <View style={styles.statLabelSpacer} />
            <Text style={styles.statColHead}>Prev {STATS_LOOKBACK}</Text>
            <Text style={styles.statColHead}>Season</Text>
          </View>
          {TEAM_STAT_GROUPS.map((group) => (
            <View key={group.label} style={styles.statGroup}>
              <Text style={styles.statGroupLabel}>{group.label}</Text>
              {group.rows.map((row) => (
                <View key={row.field} style={styles.statRow}>
                  <Text style={styles.statRowLabel}>{row.label}</Text>
                  <Text style={styles.statCell}>
                    {formatStat(recent.data!.perGame[row.field], row.percent)}
                  </Text>
                  <Text style={styles.statCell}>
                    {season.data ? formatStat(season.data.perGame[row.field], row.percent) : '—'}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </>
      )}

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Team Averages</Text>
              <Pressable onPress={() => setInfoOpen(false)} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={Colors.light.text} />
              </Pressable>
            </View>
            <Text style={styles.modalBody}>
              Per-game averages across the team&apos;s completed matches. The first column
              covers the last {STATS_LOOKBACK} matches played (the same window Form and
              Scouting use); the second is the full-season baseline, so a gap between the
              columns shows where current form is running above or below the team&apos;s
              established level.
            </Text>
            <Text style={styles.modalBody}>
              The window counts matches rather than months because the international
              calendar is uneven: a calendar window can hold anything from zero to seven
              Tests, while a match-count window always compares like with like.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function formatStat(v: number, percent?: boolean): string {
  const r = Math.round(v * 10) / 10;
  const s = Number.isInteger(r) ? String(r) : r.toFixed(1);
  return percent ? `${Math.round(v)}%` : s;
}

// ─── Analysis narrative ─────────────────────────────────────────────────────

/**
 * Templated team narrative — same visual grammar as the match and player
 * analysis cards (small-caps mini-label + glyph above prose). Structure
 * and thresholds are defined by the "Team analysis" section of
 * `docs/analysis-narrative-spec.md`; `useTeamAnalysis` is the client-side
 * template implementation pending the Phase 6 LLM cutover.
 */
function TeamAnalysisCard({ teamId }: { teamId: string }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const { data, isLoading } = useTeamAnalysis(teamId);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderTitleGroup}>
          <Text style={styles.sectionLabel}>Analysis</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the team analysis">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
      </View>

      {isLoading && !data ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : !data ? (
        <Text style={styles.empty}>Analysis populates once the team has completed a match.</Text>
      ) : (
        <View style={styles.narrativeStack}>
          {/* Cold-open summary — no label, mirroring the other cards. */}
          <Text style={styles.narrativeBody}>{data.summary}</Text>

          <TeamNarrativeSection label="Form read" icon="time-outline">
            {data.form}
          </TeamNarrativeSection>
          <TeamNarrativeSection label="Ranking read" icon="podium-outline">
            {data.ranking}
          </TeamNarrativeSection>
          <TeamNarrativeSection label="Season read" icon="analytics-outline">
            {data.season}
          </TeamNarrativeSection>
          <TeamNarrativeSection label="Going forward" icon="compass-outline">
            {data.outlook}
          </TeamNarrativeSection>
        </View>
      )}

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Analysis</Text>
              <Pressable onPress={() => setInfoOpen(false)} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={Colors.light.text} />
              </Pressable>
            </View>
            <Text style={styles.modalBody}>
              A written synthesis of the team&apos;s recent window: results and margins from the
              last 10 completed matches, the world-ranking trajectory across the monthly
              snapshots, and the per-game season profile behind the Insights charts.
            </Text>
            <Text style={styles.modalBody}>
              Reads are threshold-gated so the card only makes claims the numbers support: a
              streak needs 3 or more matches, dominance means a 7-point average margin, a
              set piece below 85% is flagged, and 12 or more penalties conceded per game is
              called out as a discipline problem.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function TeamNarrativeSection({
  label,
  icon,
  children,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: string;
}) {
  return (
    <View style={styles.narrativeSection}>
      <View style={styles.narrativeMiniLabelRow}>
        <Ionicons name={icon} size={12} color={Colors.light.textSecondary} />
        <Text style={styles.narrativeMiniLabel}>{label}</Text>
      </View>
      <Text style={styles.narrativeBody}>{children}</Text>
    </View>
  );
}

function PlayerRow({ player, onPress }: { player: Player; onPress: () => void }) {
  const age = ageFrom(player.date_of_birth);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.playerRow, pressed && styles.playerRowPressed]}>
      {/* Row-scale monogram avatar — same treatment as the player card's
          56pt identity monogram, sized down for list rows. */}
      <View style={styles.playerMonogram}>
        <Text style={styles.playerMonogramText}>{initialsOf(player.name)}</Text>
      </View>
      <View style={styles.playerText}>
        <Text style={styles.playerName}>{player.name}</Text>
        <Text style={styles.playerMeta}>
          {POSITION_LABELS[player.primary_position]} · {age} · {player.cap_count} caps
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.light.textSecondary} />
    </Pressable>
  );
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
    paddingBottom: 60,
    gap: Spacing.three,
  },

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
    // Shared drill-hero box — identity row centres in the fixture
    // hero's height so all three drills measure identically. The extra
    // whitespace is a known trade; hero content gets revisited later.
    minHeight: DRILL_HERO_MIN_HEIGHT,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  teamTextStack: { gap: 2 },
  teamCode: {
    fontSize: TextSize.lg,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.text,
  },
  teamRank: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  trophyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  trophyCount: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  sectionLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  // Card-header row: section label left, xs team flag right — same
  // anchor treatment as the Form / Trajectory / KPI cards.
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
  squadSection: {
    gap: 0,
    marginTop: Spacing.one,
  },
  // Tappable group header — label left, count + chevron right. Hairline
  // beneath separates the header from the rows when expanded and from
  // the next header when collapsed.
  squadGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  squadGroupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  squadGroupCount: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.semibold,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  squadSectionLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.semibold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  playerRowPressed: { opacity: 0.6 },
  playerMonogram: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerMonogramText: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  playerText: { flex: 1, gap: 2 },
  playerName: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.semibold,
    color: Colors.light.text,
  },
  playerMeta: {
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
  },
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },

  // Stats table — same grammar as the player card's stats pane.
  statSubMeta: {
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  statColHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: Spacing.one,
  },
  statLabelSpacer: { flex: 1 },
  statColHead: {
    width: STAT_COL_WIDTH,
    textAlign: 'right',
    fontSize: 10,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  statGroup: {
    gap: 6,
    marginTop: Spacing.two,
  },
  statGroupLabel: {
    fontSize: 10,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statRowLabel: {
    flex: 1,
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  statCell: {
    width: STAT_COL_WIDTH,
    textAlign: 'right',
    fontSize: TextSize.sm,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },

  // Analysis narrative — same grammar as the match / player analysis
  // cards: fixed-gap stack, small-caps centred mini-labels, prose beneath.
  narrativeStack: {
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  narrativeSection: {
    gap: 4,
  },
  narrativeMiniLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  narrativeMiniLabel: {
    fontSize: 10,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  narrativeBody: {
    fontSize: TextSize.sm,
    color: Colors.light.text,
    lineHeight: 22,
  },

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
    fontSize: TextSize.lg,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
  },
  modalBody: {
    fontSize: TextSize.sm,
    color: Colors.light.text,
    lineHeight: 20,
  },
});
