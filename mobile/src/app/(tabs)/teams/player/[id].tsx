import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { usePlayer, usePlayerPercentiles, useTeam, useTeams } from '@/api/hooks';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { CapsJerseyBadge, SquadBarbell, SquadMan } from '@/components/squad-jersey';
import { fitNarrative } from '@/lib/fit-narrative';
import { PageGradient } from '@/components/page-gradient';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { ErrorState, LoadingState } from '@/components/state-views';
import { FlipTrigger } from '@/components/flip-trigger';
import { CountUpTSpan, CountUpValue } from '@/components/insights/count-up-value';
import { RadarChart } from '@/components/insights/radar-chart';
import { teamDotColor } from '@/lib/team-colors';
import { useChartInk } from '@/components/insights/use-chart-ink';
import { PAGE_BOTTOM_INSET, Colors, DRILL_HERO_MIN_HEIGHT, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { usePlayerAggregate, type PlayerStatField } from '@/hooks/use-player-aggregate';
import { usePlayerAnalysis } from '@/hooks/use-player-analysis';
import { FadingScrollView } from '@/components/fading-scroll-view';
import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { usePlayerMatchHistory } from '@/hooks/use-player-match-stats';
import {
  BACK_CATEGORY_ORDER,
  FORWARD_CATEGORY_ORDER,
  FORWARD_POSITIONS,
  PLAYER_LOOKBACK,
  POSITION_LABELS,
  SCOUT_CATEGORIES,
  type ScoutMetric,
} from '@/lib/player-roles';
import { CHART_LINE_COLOR } from '@/lib/smooth-path';

// Trend dot colours — same trio as the form circles / Form chart.

const LOOKBACK = PLAYER_LOOKBACK;
const GOOD_COLOR = '#059669';
const BAD_COLOR = StatusColor.live;

type PlayerTab = 'season' | 'preview' | 'stats';

const PLAYER_TABS: readonly { id: PlayerTab; label: string }[] = [
  // Season leads (owner call 2026-07-10): the totals ledger is the
  // landing read; Profile is the scouting deck (radar + six peer-bar
  // category cards); Stats stays as the dense reference table.
  // Insights and Analysis pills retired 2026-07-07.
  { id: 'season', label: 'Season' },
  { id: 'preview', label: 'Profile' },
  { id: 'stats', label: 'Stats' },
];

/**
 * Player card — the deepest level of the Teams drill, structured like
 * the fixture drill: pinned identity header + segmented sub-tabs, with
 * the pane content scrolling beneath. Identity carries a portrait photo
 * placeholder (player photos are a Phase 6 image-rights licence tier —
 * the glyph placeholder is deliberate, not a gap).
 */
export default function PlayerCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const playerId = id ?? '';
  const [tab, setTab] = useState<PlayerTab>('season');
  const scrollRef = useRef<ScrollView>(null);

  const player = usePlayer(playerId);
  // Same resolve-to-top gesture as the fixture drill's sub-tabs.
  const handleTabSelect = (next: PlayerTab) => {
    setTab(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  if (player.isLoading) {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safe}>
        <PageGradient />
        <LoadingState />
      </SafeAreaView>
    );
  }
  if (player.isError || !player.data) {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safe}>
        <PageGradient />
        <ErrorState error={player.error ?? new Error(`player ${playerId} not found`)} />
      </SafeAreaView>
    );
  }

  const p = player.data;
  const isForward = FORWARD_POSITIONS.includes(p.primary_position);

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      <PageGradient />
      {/* Identity + pills pinned OUTSIDE the ScrollView, mirroring the
          fixture drill's hero + sub-tab strip. */}
      <View style={styles.identityHeader}>
        {/* Identity text column left (name + meta rows), the squad
            list's jersey avatar right — one identity mark from list to
            hero. Real headshots remain a Phase 6 image-rights item
            (register #5/#28); the jersey swaps out for them then. */}
        <View style={styles.heroRow}>
          {/* Team-hero composition: identity group left (40pt jersey
              mark + nameplate), meta stack centred in the remaining
              right-hand space — NOT under the name. */}
          <View style={styles.heroIdentityGroup}>
            <CapsJerseyBadge teamId={p.team_id} caps={p.cap_count} />
            {/* First name over surname — the squad list's two-line
                stack at hero scale. */}
            <View style={styles.heroNameStack}>
              <Text style={styles.heroName} numberOfLines={1}>
                {givenNames(p.name)}
              </Text>
              <Text style={styles.heroName} numberOfLines={1}>
                {surname(p.name)}
              </Text>
            </View>
          </View>
          <View style={styles.heroMetaStack}>
            <Text style={styles.heroMetaText}>
              {POSITION_LABELS[p.primary_position]} · {ageFrom(p.date_of_birth)}
            </Text>
            {/* Measurables then career (owner call 2026-07-09): body
                line first, caps on its own line beneath. Units stay —
                icons alone aren't self-describing. */}
            <View style={styles.heroCapsRow}>
              <SquadMan teamId={p.team_id} />
              <Text style={styles.heroMetaText}> {p.height_cm} cm · </Text>
              <SquadBarbell teamId={p.team_id} />
              <Text style={styles.heroMetaText}> {p.weight_kg} kg</Text>
            </View>
          </View>
        </View>
      </View>
      <SegmentedTabs tabs={PLAYER_TABS} active={tab} onSelect={handleTabSelect} />

      <FadingScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        {tab === 'season' && <SeasonPane playerId={playerId} />}
        {tab === 'preview' && (
          <PlayerPreviewBlock
            playerId={playerId}
            teamId={p.team_id}
            isForward={isForward}
          />
        )}
        {tab === 'stats' && <PlayerStatsTable playerId={playerId} />}
      </FadingScrollView>
    </SafeAreaView>
  );
}

// ─── Profile block (stacked category cards, fixture-Stats grammar) ─────────

// One narrative per card, labels identical to card titles. The Player
// Profile percentile card pairs with the accordion's title row (the
// resting scouting report), same convention as every other surface.
function PlayerPreviewBlock({
  playerId,
  teamId,
  isForward,
}: {
  playerId: string;
  teamId: string;
  isForward: boolean;
}) {
  // Flip-card grammar (Teams alignment pass, 2026-07-08): each card
  // carries its narrative on its back — Profile gets the full scouting
  // report (summary + profile read + development close), Form and
  // Season their engine fields. The accordion + two-way sync is gone.
  const analysis = usePlayerAnalysis(playerId);
  const profileRead = analysis.data
    ? fitNarrative([analysis.data.summary, analysis.data.scouting, analysis.data.outlook], 900)
    : null;

  return (
    <View style={styles.profileStack}>
      {[
        // The player's SHAPE at a glance (owner call 2026-07-09):
        // six lobes = the six category cards below, each the player's
        // composite standing vs positional peers. The full scouting
        // narrative rides this lead card's back.
        <PlayerRadarCard
          key="radar"
          playerId={playerId}
          teamId={teamId}
          isForward={isForward}
          read={profileRead}
        />,
        // Comprehensive scouting deck (owner call 2026-07-09): six
        // category cards covering EVERY feed-backed stat, ordered by
        // the role's bread and butter; the full scouting narrative
        // rides the lead card's back.
        ...(isForward ? FORWARD_CATEGORY_ORDER : BACK_CATEGORY_ORDER).map(
          (key) => {
            const cat = SCOUT_CATEGORIES[key]!;
            return (
              <ScoutingCard
                key={key}
                title={cat.title}
                purpose={cat.purpose}
                playerId={playerId}
                metrics={cat.metrics}

              />
            );
          },
        ),
      ]}
    </View>
  );
}

// ─── Season pane ────────────────────────────────────────────────────────────

function SeasonPane({ playerId }: { playerId: string }) {
  const analysis = usePlayerAnalysis(playerId);
  return (
    <View style={styles.profileStack}>
      <SeasonCard playerId={playerId} read={analysis.data?.season ?? null} />
    </View>
  );
}

// ─── Scouting (percentile bars) ─────────────────────────────────────────────

function ScoutingCard({
  playerId,
  title,
  purpose,
  metrics,
  style,
  read,
}: {
  playerId: string;
  title: string;
  /** About copy for the flip back. */
  purpose: string;
  metrics: readonly ScoutMetric[];
  style?: StyleProp<ViewStyle>;
  /** Scouting narrative for the flip back (lead card only). */
  read?: string | null;
}) {
  const [infoOpen, setInfoOpen] = useState(false);

  const percentiles = usePlayerPercentiles(playerId, LOOKBACK);

  const byField = useMemo(() => {
    const m = new Map<string, { per_game: number; peer_avg: number }>();
    for (const row of percentiles.data?.metrics ?? []) {
      m.set(row.field, { per_game: row.per_game, peer_avg: row.peer_avg });
    }
    return m;
  }, [percentiles.data]);

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title={title}
          onClose={() => setInfoOpen(false)}
          read={read}
          purpose={<>{purpose}</>}
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>{title}</Text>
        {/* Reference caption + trigger right — the team Stats card's
            TIER 1 AVG anatomy with the positional pool as the frame. */}
        <View style={styles.headerRightGroup}>
          <Text style={styles.peerTag}>PEER AVG</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Explain the ${title} scouting card`}>
            <FlipTrigger />
          </Pressable>
        </View>
      </View>

      {percentiles.isLoading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : !percentiles.data || percentiles.data.appearances === 0 ? (
        <Text style={styles.empty}>No appearances yet to profile.</Text>
      ) : (
        <>
          <View style={styles.scoutList}>
            {metrics.map((m) => {
              const row = byField.get(m.field);
              if (!row) return null;
              return (
                <PeerRow
                  key={m.field}
                  label={m.label}
                  mine={row.per_game}
                  avg={row.peer_avg}
                  inverted={m.inverted}
                />
              );
            })}
          </View>
        </>
      )}

        </View>
      }
    />
  );
}

/** Per-game vs the average positional peer — the team Stats row
 *  grammar verbatim: value tile, centre-out diverging bars, avg tile;
 *  leader green, trailer red, grey when even (inverted-aware). */
function PeerRow({
  label,
  mine,
  avg,
  inverted,
}: {
  label: string;
  mine: number;
  avg: number;
  inverted?: boolean;
}) {
  const ink = useChartInk();
  // Standard headroom rule: the longest bar tops out at 85%.
  const MAX_FILL = 0.85;
  const maxValue = Math.max(mine, avg, 0.001);
  const mineSeg = Math.max(0.001, MAX_FILL * (mine / maxValue));
  const mineSpacer = Math.max(0.001, 1 - MAX_FILL * (mine / maxValue));
  const avgSeg = Math.max(0.001, MAX_FILL * (avg / maxValue));
  const avgSpacer = Math.max(0.001, 1 - MAX_FILL * (avg / maxValue));
  const variance = mine - avg;
  const favourable = inverted ? variance < 0 : variance > 0;
  const isTie = Math.abs(variance) < 0.05;
  const mineColor = isTie ? Colors.light.textSecondary : favourable ? GOOD_COLOR : BAD_COLOR;
  const avgColor = isTie ? Colors.light.textSecondary : favourable ? BAD_COLOR : GOOD_COLOR;

  return (
    <View style={styles.scoutRow}>
      <View style={styles.peerLabelRow}>
        <Text style={styles.scoutLabel}>{label}</Text>
      </View>
      <View style={styles.peerBarRow}>
        <View style={[styles.valueBox, !isTie && favourable ? styles.valueBoxWin : null]}>
          <Text style={[styles.valueBoxText, !isTie && favourable ? styles.valueBoxTextWin : null]}>
            <CountUpValue value={formatPeer(mine)} ink={ink} />
          </Text>
        </View>
        <View style={styles.peerBarTrack}>
          <View style={styles.peerBarHalfLeft}>
            <Animated.View
              style={[
                styles.peerBarSeg,
                {
                  flex: mineSeg,
                  backgroundColor: mineColor,
                  transformOrigin: 'right',
                  transform: [{ scaleX: ink }],
                },
              ]}
            />
            <View style={{ flex: mineSpacer }} />
          </View>
          <View style={styles.peerBarCentreGap} />
          <View style={styles.peerBarHalfRight}>
            <Animated.View
              style={[
                styles.peerBarSeg,
                {
                  flex: avgSeg,
                  backgroundColor: avgColor,
                  transformOrigin: 'left',
                  transform: [{ scaleX: ink }],
                },
              ]}
            />
            <View style={{ flex: avgSpacer }} />
          </View>
        </View>
        <View style={styles.valueBox}>
          <Text style={styles.valueBoxText}>
            <CountUpValue value={formatPeer(avg)} ink={ink} />
          </Text>
        </View>
      </View>
    </View>
  );
}

function formatPeer(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

// ─── Player radar (shape lead card) ─────────────────────────────────────────

/** Six lobes = the six category cards beneath — each the mean of the
 *  category's DISPLAY percentiles (lower-is-better rows pre-flipped),
 *  so more area is always more standing vs the positional peer pool.
 *  Fixed axis order for shape comparability across players. */
const RADAR_CATEGORY_ORDER = [
  'scoring',
  'attack',
  'kicking',
  'defence',
  'contest',
  'discipline',
] as const;
const RADAR_LABELS: Record<string, string> = {
  scoring: 'Scoring',
  attack: 'Attack',
  kicking: 'Kicking',
  defence: 'Defence',
  contest: 'Breakdown',
  discipline: 'Discipline',
};

function PlayerRadarCard({
  playerId,
  teamId,
  isForward,
  read,
}: {
  playerId: string;
  teamId: string;
  isForward: boolean;
  /** Full scouting narrative for the flip back. */
  read?: string | null;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const percentiles = usePlayerPercentiles(playerId, LOOKBACK);

  const axes = useMemo(() => {
    const byField = new Map(
      (percentiles.data?.metrics ?? []).map((m) => [m.field, m.percentile]),
    );
    return RADAR_CATEGORY_ORDER.map((key) => {
      const cat = SCOUT_CATEGORIES[key]!;
      const displays = cat.metrics.map((m) => {
        const pct = byField.get(m.field) ?? 0;
        return m.inverted ? 100 - pct : pct;
      });
      const mean =
        displays.length > 0 ? displays.reduce((a, b) => a + b, 0) / displays.length : 0;
      return {
        key,
        label: RADAR_LABELS[key]!,
        value: mean / 100,
        raw: `${Math.round(mean)} pctile`,
      };
    });
  }, [percentiles.data]);

  const ready = Boolean(percentiles.data && percentiles.data.appearances > 0);

  return (
    <FadeCard
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Profile"
          onClose={() => setInfoOpen(false)}
          read={read}
          purpose={<>The player's shape in one glance — six lobes, one per card below, each his overall standing against every positional peer. A full lobe leads that department; a shallow one trails it.</>}
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
          <View style={styles.radarHeaderRow}>
            {/* Radar rule: title centred on the chart's vertical axis. */}
            <View style={styles.radarTitleCentreFill} pointerEvents="none">
              <Text style={styles.sectionLabel}>Profile</Text>
            </View>
            <Pressable
              onPress={() => setInfoOpen(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Read the player scouting report">
              <FlipTrigger />
            </Pressable>
          </View>
          {percentiles.isLoading ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : !ready ? (
            <Text style={styles.empty}>No appearances yet to profile.</Text>
          ) : (
            <RadarChart
              axes={axes}
              strokeColor="transparent"
              fillColor={teamDotColor(teamId)}
              dotColor={teamDotColor(teamId)}
              flatFillOpacity={0.25}
            />
          )}
        </View>
      }
    />
  );
}

// ─── Season totals ──────────────────────────────────────────────────────────

function SeasonCard({
  playerId,
  style,
  read,
}: {
  playerId: string;
  style?: StyleProp<ViewStyle>;
  /** Season narrative for the flip back. */
  read?: string | null;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const { data, isLoading } = usePlayerAggregate(playerId);
  const percentiles = usePlayerPercentiles(playerId, LOOKBACK);

  // Season = the TOTALS ledger with peer standing behind each number:
  // tile carries the season total, the bar its percentile among the
  // position group (median tick at 50) — Profile reads rates, Season
  // reads volume, one bar grammar across both.
  const rows = useMemo(() => {
    if (!data) return [];
    const labelByField = new Map<string, string>();
    for (const group of STAT_GROUPS) {
      for (const r of group.rows) labelByField.set(r.field, r.label);
    }
    return (percentiles.data?.metrics ?? [])
      .filter((m) => labelByField.has(m.field))
      .slice(0, 7)
      .map((m) => ({
        field: m.field,
        label: labelByField.get(m.field)!,
        total: (data.totals as Record<string, number>)[m.field] ?? 0,
        percentile: Math.round(m.percentile),
      }));
  }, [data, percentiles.data]);

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Season"
          onClose={() => setInfoOpen(false)}
          read={read}
          purpose={
            <>
              The season record at a glance — appearances, starts, minutes
              and the scoring ledger, summed across every match the player
              took the field in.
            </>
          }
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Season</Text>
        <Pressable
          onPress={() => setInfoOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Read the season analysis">
          <FlipTrigger />
        </Pressable>
      </View>
      {isLoading && !data ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : !data || data.appearances === 0 ? (
        <Text style={styles.empty}>No appearances yet.</Text>
      ) : (
        <>
          {/* Participation as the meta line — the ledger below is the
              story; apps/starts/minutes are its context. */}
          <Text style={styles.subMeta}>
            {data.appearances} apps · {data.starts} starts · {data.minutesTotal} mins ·{' '}
            {data.totals.yellow_cards}Y {data.totals.red_cards}R
          </Text>
          <View style={styles.scoutList}>
            {rows.map((r) => (
              <SeasonRow
                key={r.field}
                label={r.label}
                total={r.total}
                percentile={r.percentile}
              />
            ))}
          </View>
        </>
      )}
        </View>
      }
    />
  );
}

/** Season ledger row — season TOTAL in the tile, peer percentile as
 *  the bar (ScoutRow's line grammar: track flexes, tile in the fixed
 *  right rail, median tick at 50). */
function SeasonRow({
  label,
  total,
  percentile,
}: {
  label: string;
  total: number;
  percentile: number;
}) {
  // Sweep-in driver (shared arrival grammar).
  const ink = useChartInk();
  return (
    <View style={styles.scoutRow}>
      <View style={styles.scoutRowHead}>
        <Text style={styles.scoutLabel}>{label}</Text>
      </View>
      <View style={styles.scoutLine}>
        <View style={styles.scoutTrack}>
          <Animated.View
            style={[
              styles.scoutFill,
              {
                width: `${percentile}%`,
                backgroundColor: percentile >= 50 ? GOOD_COLOR : BAD_COLOR,
                transformOrigin: 'left',
                transform: [{ scaleX: ink }],
              },
            ]}
          />
          <View style={styles.scoutMedianMarker} />
        </View>
        <View style={[styles.valueBox, percentile >= 50 ? styles.valueBoxWin : null]}>
          <Text style={[styles.valueBoxText, percentile >= 50 ? styles.valueBoxTextWin : null]}>
            <CountUpValue value={String(total)} ink={ink} />
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Stats table ────────────────────────────────────────────────────────────

const NUM_COL_WIDTH = 52;

const STAT_GROUPS: readonly {
  label: string;
  rows: readonly { field: PlayerStatField; label: string }[];
}[] = [
  {
    label: 'Attack',
    rows: [
      { field: 'tries', label: 'Tries' },
      { field: 'try_assists', label: 'Try assists' },
      { field: 'points', label: 'Points' },
      { field: 'carries', label: 'Carries' },
      { field: 'metres_carried', label: 'Metres carried' },
      { field: 'clean_breaks', label: 'Clean breaks' },
      { field: 'defenders_beaten', label: 'Defenders beaten' },
      { field: 'offloads', label: 'Offloads' },
      { field: 'passes', label: 'Passes' },
      { field: 'handling_errors', label: 'Handling errors' },
    ],
  },
  {
    label: 'Kicking',
    rows: [
      { field: 'conversions', label: 'Conversions' },
      { field: 'penalty_goals', label: 'Penalty goals' },
      { field: 'drop_goals', label: 'Drop goals' },
      { field: 'kicks_from_hand', label: 'Kicks from hand' },
      { field: 'kick_metres', label: 'Kick metres' },
    ],
  },
  {
    label: 'Defence',
    rows: [
      { field: 'tackles_made', label: 'Tackles made' },
      { field: 'missed_tackles', label: 'Missed tackles' },
      { field: 'turnovers_won', label: 'Turnovers won' },
    ],
  },
  {
    label: 'Breakdown & set piece',
    rows: [
      { field: 'rucks_hit', label: 'Rucks hit' },
      { field: 'lineout_takes', label: 'Lineout takes' },
      { field: 'lineout_steals', label: 'Lineout steals' },
    ],
  },
  {
    label: 'Discipline',
    rows: [
      { field: 'penalties_conceded', label: 'Penalties conceded' },
      { field: 'yellow_cards', label: 'Yellow cards' },
      { field: 'red_cards', label: 'Red cards' },
    ],
  },
];

/**
 * Full numeric record for the Stats pane — every sheet field grouped by
 * category with total, per-game, and per-80 columns. The numbers-first
 * counterpart to the Insights pane's percentile read.
 */
function PlayerStatsTable({ playerId }: { playerId: string }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const { data, isLoading } = usePlayerAggregate(playerId);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Statistics</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the statistics columns">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
      </View>

      {isLoading && !data ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : !data || data.appearances === 0 ? (
        <Text style={styles.empty}>No appearances yet.</Text>
      ) : (
        <>
          <Text style={styles.subMeta}>
            {data.appearances} apps · {data.starts} starts · {data.minutesTotal} minutes
          </Text>
          <View style={styles.statColHeadRow}>
            <View style={styles.statLabelSpacer} />
            <Text style={styles.statColHead}>Total</Text>
            <Text style={styles.statColHead}>/game</Text>
            <Text style={styles.statColHead}>/80</Text>
          </View>
          {STAT_GROUPS.map((group) => (
            <View key={group.label} style={styles.statGroup}>
              <Text style={styles.statGroupLabel}>{group.label}</Text>
              {group.rows.map((row) => (
                <View key={row.field} style={styles.statRow}>
                  <Text style={styles.statRowLabel}>{row.label}</Text>
                  <Text style={styles.statCell}>{data.totals[row.field]}</Text>
                  <Text style={styles.statCell}>{formatPer80(round1(data.perGame[row.field]))}</Text>
                  <Text style={styles.statCell}>{formatPer80(round1(data.per80[row.field]))}</Text>
                </View>
              ))}
            </View>
          ))}
        </>
      )}

      <InfoModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="Statistics"
        paragraphs={[
          'Season record across every match the player has taken the field in. Total is the raw sum; /game divides by appearances; /80 scales to a full-match rate.',
          'The /80 column is the fairest basis for comparing players: a bench player logging 25-minute shifts is not punished for shorter time on the pitch. It is the same rate the scouting percentiles are built on.',
        ]}
      />
    </View>
  );
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function InfoModal({
  visible,
  onClose,
  title,
  paragraphs,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  paragraphs: readonly string[];
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          {paragraphs.map((body, i) => (
            <Text key={i} style={styles.modalBody}>
              {body}
            </Text>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
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

function formatPer80(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

const styles = StyleSheet.create({
  // Mini score tiles — match-score convention (winner dark/white when
  // above the reference, quiet light/grey otherwise).
  valueBox: {
    width: 36,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueBoxWin: { backgroundColor: Colors.light.textSecondary },
  valueBoxText: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.textSecondary,
  },
  valueBoxTextWin: { color: Colors.light.textInverse },
  // Front face fills the flip container (grow-only).
  cardFill: { flexGrow: 1 },
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: {
    paddingHorizontal: Spacing.four,
    // 16pt drop from the pill strip into the pane — matches the fixture
    // drill's pane paddingTop so all three drills share one rhythm.
    paddingTop: Spacing.three,
    paddingBottom: PAGE_BOTTOM_INSET,
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionLabel: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  subMeta: {
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },

  // Identity — pinned white surface above the pill strip. Same chrome
  // as the fixture drill's matchup hero: 24/16/16 padding and its own
  // hairline separating the hero from the pill strip.
  identityHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    // Shared drill-hero box — content centres in the fixture hero's
    // height so all three drills measure identically.
    minHeight: DRILL_HERO_MIN_HEIGHT,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  // Single hero row: identity group left, meta stack filling the right
  // — the same treatment as the team drill hero.
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: Spacing.three,
  },
  // Form bar canvas fills the card's remaining height (measured in
  // real pixels — no viewBox stretch).
  formBarsFill: { flex: 1, minHeight: 190 },
  heroNameStack: {
    gap: 0,
  },
  heroIdentityGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    // Nameplates run long ("FELIX ORMSBY" two-line) — cap the identity
    // group so the meta stack keeps its column, mirroring the team
    // hero's balance.
    maxWidth: '55%',
  },
  heroMetaStack: {
    flex: 1,
    alignItems: 'flex-start',
    gap: Spacing.one,
    paddingLeft: Spacing.four,
  },
  // Preview-block bleed: unwraps the pane padding (carousel pages
  // re-apply the card column internally) and carries the 16pt rhythm.
  // Vertical card stack (owner call 2026-07-09, fixture-Stats
  // grammar): one card per scouting category, Form and Season beneath
  // — carousel retired on this pane.
  profileStack: { gap: Spacing.three },
  // Portrait photo slot — sized to carry visual weight in the 140pt
  // hero rather than reading as an afterthought chip.
  heroName: {
    // Player identity in the nation-code face — the jersey nameplate.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.xl,
    letterSpacing: TextTracking.wide,
    color: Colors.light.text,
    textTransform: 'uppercase',
  },
  // Jersey-and-caps pair — same icon+value grammar as the team hero.
  heroCapsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Meta stack — quiet lines (position · age, measurables · caps,
  // team) left-aligned in the right-hand space.
  heroMetaText: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  // Scouting
  scoutList: { gap: Spacing.two, marginTop: Spacing.one },
  peerLabelRow: { alignItems: 'center' },
  peerBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  peerBarTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  peerBarHalfLeft: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    height: 4,
  },
  peerBarHalfRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 4,
  },
  peerBarSeg: {
    height: 4,
    borderRadius: 2,
  },
  peerBarCentreGap: { width: 4 },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  peerTag: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.xs,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  radarHeaderRow: {
    position: 'relative',
    justifyContent: 'flex-end',
    marginBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
  },
  radarTitleCentreFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoutRow: { gap: 4 },
  scoutRowHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  scoutLabel: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  scoutValue: {
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  scoutSuffix: {
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
  },
  scoutLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  scoutTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    position: 'relative',
    overflow: 'visible',
  },
  scoutFill: {
    height: '100%',
    borderRadius: 2,
  },
  scoutMedianMarker: {
    position: 'absolute',
    left: '50%',
    top: -3,
    bottom: -3,
    width: 1.5,
    marginLeft: -0.75,
    backgroundColor: CHART_LINE_COLOR,
  },

  // Trend

  // Stats table
  statColHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: Spacing.one,
  },
  statLabelSpacer: { flex: 1 },
  statColHead: {
    width: NUM_COL_WIDTH,
    textAlign: 'right',
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.xs,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  statGroup: {
    gap: 6,
    marginTop: Spacing.two,
  },
  statGroupLabel: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
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
    width: NUM_COL_WIDTH,
    textAlign: 'right',
    fontSize: TextSize.sm,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },

  // Analysis narrative — same grammar as the match analysis card:
  // fixed-gap stack, small-caps centred mini-labels, prose beneath.

  // Season tiles

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
