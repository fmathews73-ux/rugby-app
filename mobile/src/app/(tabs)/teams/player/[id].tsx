import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { usePlayer, usePlayerPercentiles } from '@/api/hooks';
import { CardCarousel, type CardCarouselHandle } from '@/components/card-carousel';
import { PageGradient } from '@/components/page-gradient';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { ErrorState, LoadingState } from '@/components/state-views';
import { FlipTrigger } from '@/components/flip-trigger';
import { CountUpValue } from '@/components/insights/count-up-value';
import { useChartInk } from '@/components/insights/use-chart-ink';
import { PAGE_BOTTOM_INSET, Colors, DRILL_HERO_MIN_HEIGHT, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { usePlayerAggregate, type PlayerStatField } from '@/hooks/use-player-aggregate';
import { usePlayerAnalysis } from '@/hooks/use-player-analysis';
import { FadingScrollView } from '@/components/fading-scroll-view';
import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { usePlayerMatchHistory } from '@/hooks/use-player-match-stats';
import { LineFadeRibbon } from '@/components/insights/line-fade-ribbon';
import {
  BACK_SCOUT,
  BACK_TREND,
  FORWARD_POSITIONS,
  FORWARD_SCOUT,
  FORWARD_TREND,
  GROUP_LABELS,
  PLAYER_LOOKBACK,
  POSITION_LABELS,
  type ScoutMetric,
} from '@/lib/player-roles';
import { CHART_LINE_COLOR, smoothLinePath } from '@/lib/smooth-path';

// Trend dot colours — same trio as the form circles / Form chart.
const TREND_UP_COLOR = '#059669';
const TREND_DOWN_COLOR = '#DC2626';
const TREND_FLAT_COLOR = '#9CA3AF';

const LOOKBACK = PLAYER_LOOKBACK;
const GOOD_COLOR = '#059669';
const BAD_COLOR = StatusColor.live;

type PlayerTab = 'preview' | 'stats';

const PLAYER_TABS: readonly { id: PlayerTab; label: string }[] = [
  // Preview IS the player read — the strict-1:1 chart carousel +
  // Player Analysis accordion (same grammar as every other surface);
  // Insights and Analysis pills retired 2026-07-07. Stats stays as the
  // dense reference table.
  { id: 'preview', label: 'Preview' },
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
  const [tab, setTab] = useState<PlayerTab>('preview');
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
        {/* Identity text column left (name + meta rows), generous
            player-photo placeholder right. The placeholder is the
            future image slot — real headshots are a Phase 6
            image-rights item (register #5/#28), so a large person
            glyph holds the space until then. */}
        <View style={styles.heroRow}>
          <View style={styles.heroTextStack}>
            <Text style={styles.heroName} numberOfLines={2}>
              {p.name}
            </Text>
            <Text style={styles.heroMetaText}>
              {POSITION_LABELS[p.primary_position]} · {ageFrom(p.date_of_birth)}
            </Text>
            <Text style={styles.heroMetaText}>
              {p.height_cm} cm · {p.weight_kg} kg
            </Text>
            <Text style={styles.heroMetaText}>{p.cap_count} caps</Text>
          </View>
          <View style={styles.heroPhotoPlaceholder}>
            <Ionicons name="person-outline" size={44} color={Colors.light.textSecondary} />
          </View>
        </View>
      </View>
      <SegmentedTabs tabs={PLAYER_TABS} active={tab} onSelect={handleTabSelect} />

      <FadingScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        {tab === 'preview' && (
          <View style={styles.previewBleed}>
            <PlayerPreviewBlock
              playerId={playerId}
              isForward={isForward}
            />
          </View>
        )}
        {tab === 'stats' && <PlayerStatsTable playerId={playerId} />}
      </FadingScrollView>
    </SafeAreaView>
  );
}

// ─── Preview block (strict 1:1 carousel + synced accordion) ────────────────

// One narrative per card, labels identical to card titles. The Player
// Profile percentile card pairs with the accordion's title row (the
// resting scouting report), same convention as every other surface.
function PlayerPreviewBlock({
  playerId,
  isForward,
}: {
  playerId: string;
  isForward: boolean;
}) {
  const carouselRef = useRef<CardCarouselHandle>(null);
  // Flip-card grammar (Teams alignment pass, 2026-07-08): each card
  // carries its narrative on its back — Profile gets the full scouting
  // report (summary + profile read + development close), Form and
  // Season their engine fields. The accordion + two-way sync is gone.
  const analysis = usePlayerAnalysis(playerId);
  const profileRead = analysis.data
    ? `${analysis.data.summary}\n\n${analysis.data.scouting}\n\n${analysis.data.outlook}`
    : null;

  return (
    <CardCarousel
      ref={carouselRef}
      pages={[
        <ScoutingCard
          key="profile"
          playerId={playerId}
          metrics={isForward ? FORWARD_SCOUT : BACK_SCOUT}
          style={styles.pageCard}
          read={profileRead}
        />,
        <TrendCard
          key="form"
          playerId={playerId}
          metrics={isForward ? FORWARD_TREND : BACK_TREND}
          style={styles.pageCard}
          read={analysis.data?.form ?? null}
        />,
        <SeasonCard
          key="season"
          playerId={playerId}
          style={styles.pageCard}
          read={analysis.data?.season ?? null}
        />,
      ]}
    />
  );
}

// ─── Scouting (percentile bars) ─────────────────────────────────────────────

function ScoutingCard({
  playerId,
  metrics,
  style,
  read,
}: {
  playerId: string;
  metrics: readonly ScoutMetric[];
  style?: StyleProp<ViewStyle>;
  /** Full scouting report for the flip back. */
  read?: string | null;
}) {
  const [infoOpen, setInfoOpen] = useState(false);

  const percentiles = usePlayerPercentiles(playerId, LOOKBACK);

  const byField = useMemo(() => {
    const m = new Map<string, { per80: number; percentile: number }>();
    for (const row of percentiles.data?.metrics ?? []) {
      m.set(row.field, { per80: row.per80, percentile: row.percentile });
    }
    return m;
  }, [percentiles.data]);

  const groupLabel =
    GROUP_LABELS[percentiles.data?.position_group ?? ''] ?? 'positional peers';

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Profile"
          onClose={() => setInfoOpen(false)}
          read={read}
          purpose={
            <>
              Percentile bars against every positional peer in the pool, on
              per-80-minute rates over the last {LOOKBACK} appearances — the
              tick is the peer median, and lower-is-better rows are already
              flipped so a longer bar is always the better read.
            </>
          }
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Profile</Text>
        <Pressable
          onPress={() => setInfoOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Read the player profile analysis">
          <FlipTrigger />
        </Pressable>
      </View>

      {percentiles.isLoading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : !percentiles.data || percentiles.data.appearances === 0 ? (
        <Text style={styles.empty}>No appearances yet to profile.</Text>
      ) : (
        <>
          <Text style={styles.subMeta}>
            vs {percentiles.data.peers} {groupLabel} ·{' '}
            {percentiles.data.appearances} apps
          </Text>
          <View style={styles.scoutList}>
            {metrics.map((m) => {
              const row = byField.get(m.field);
              if (!row) return null;
              const display = m.inverted ? 100 - row.percentile : row.percentile;
              return (
                <ScoutRow
                  key={m.field}
                  label={m.label}
                  per80={row.per80}
                  percentile={display}
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

function ScoutRow({
  label,
  per80,
  percentile,
}: {
  label: string;
  per80: number;
  percentile: number;
}) {
  // Sweep-in driver (shared arrival grammar).
  const ink = useChartInk();
  return (
    <View style={styles.scoutRow}>
      <View style={styles.scoutRowHead}>
        <Text style={styles.scoutLabel}>{label}</Text>
        <View style={styles.scoutValueGroup}>
          <Text style={styles.scoutValue}>
            {formatPer80(per80)}
            <Text style={styles.scoutSuffix}> /80</Text>
          </Text>
          {/* Percentile in the match-score tile convention: above the
              peer median = winner pairing, below = loser pairing. */}
          <View style={[styles.valueBox, percentile >= 50 ? styles.valueBoxWin : null]}>
            <Text style={[styles.valueBoxText, percentile >= 50 ? styles.valueBoxTextWin : null]}>
              <CountUpValue value={String(percentile)} ink={ink} />
            </Text>
          </View>
        </View>
      </View>
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
        {/* Peer-median tick at the 50th percentile — same treatment as
            the Efficiency KPI T1-average marker. */}
        <View style={styles.scoutMedianMarker} />
      </View>
    </View>
  );
}

// ─── Trend sparklines ───────────────────────────────────────────────────────

function TrendCard({
  playerId,
  metrics,
  style,
  read,
}: {
  playerId: string;
  metrics: readonly { field: PlayerStatField; label: string }[];
  style?: StyleProp<ViewStyle>;
  /** Form narrative for the flip back. */
  read?: string | null;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const history = usePlayerMatchHistory(playerId);

  // Newest-first from the server → oldest-first for left-to-right time.
  const appearances = useMemo(
    () =>
      (history.data ?? [])
        .filter((s) => s.minutes_played > 0)
        .slice(0, LOOKBACK)
        .reverse(),
    [history.data],
  );

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Form"
          onClose={() => setInfoOpen(false)}
          read={read}
          purpose={
            <>
              Per-appearance trends across the last {LOOKBACK} matches
              played, oldest to newest — raw per-match values, so a quiet
              cameo shows as a dip, which is part of the story.
            </>
          }
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Form</Text>
        <Pressable
          onPress={() => setInfoOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Read the form analysis">
          <FlipTrigger />
        </Pressable>
      </View>

      {history.isLoading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : appearances.length < 2 ? (
        <Text style={styles.empty}>Not enough appearances yet.</Text>
      ) : (
        <View style={styles.trendList}>
          {metrics.map((m, i) => (
            <TrendRow
              key={m.field}
              label={m.label}
              gradientId={`player-trend-${i}`}
              values={appearances.map((s) => s[m.field])}
            />
          ))}
        </View>
      )}

        </View>
      }
    />
  );
}

function TrendRow({
  label,
  values,
  gradientId,
}: {
  label: string;
  values: readonly number[];
  gradientId: string;
}) {
  const latest = values[values.length - 1] ?? 0;
  return (
    <View style={styles.trendRow}>
      <View style={styles.trendRowHead}>
        <Text style={styles.trendLabel}>{label}</Text>
        <View style={styles.valueBox}>
        <Text style={styles.valueBoxText}>{latest}</Text>
      </View>
      </View>
      <TrendSparkline values={values} gradientId={gradientId} />
    </View>
  );
}

function TrendSparkline({
  values,
  gradientId,
}: {
  values: readonly number[];
  gradientId: string;
}) {
  // Measured canvas width — geometry in real pixels, no viewBox
  // stretching, so dots and strokes render true at any card width.
  const [width, setWidth] = useState(0);
  const height = 44;
  const padX = 4;
  const padY = 6;
  const max = Math.max(1, ...values);

  const points = values.map((v, i) => ({
    x: padX + (values.length === 1 ? 0.5 : i / (values.length - 1)) * (width - 2 * padX),
    y: height - padY - (v / max) * (height - 2 * padY),
  }));
  const linePath = smoothLinePath(points).path;

  if (width === 0) {
    return <View onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))} style={{ height }} />;
  }
  return (
    <View onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <ClipPath id={`${gradientId}-clip`}>
          <Rect x={0} y={0} width={width} height={height - padY} />
        </ClipPath>
      </Defs>
      {/* Contour-hugging fade — short band beneath the line following
          its shape, matching the Form / Trajectory treatment. Tighter
          steps on this 44px-tall canvas. */}
      <G clipPath={`url(#${gradientId}-clip)`}>
        <LineFadeRibbon
          path={linePath}
          stroke={CHART_LINE_COLOR}
          steps={5}
          stepPx={2}
          strokeWidth={2.2}
        />
      </G>
      <Path d={linePath} stroke={CHART_LINE_COLOR} strokeWidth={1} fill="none" strokeLinecap="round" />
      {/* Dots coloured by move vs the previous appearance (trend
          metrics are all higher-is-better); first / unchanged points
          take the neutral grey. */}
      {points.map((pt, i) => {
        const prev = i > 0 ? values[i - 1]! : null;
        const v = values[i]!;
        const fill =
          prev === null || v === prev ? TREND_FLAT_COLOR : v > prev ? TREND_UP_COLOR : TREND_DOWN_COLOR;
        return <Circle key={i} cx={pt.x} cy={pt.y} r={1.5} fill={fill} />;
      })}
      </Svg>
    </View>
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

  const tiles = useMemo(() => {
    if (!data) return [];
    return [
      { label: 'Apps', value: String(data.appearances) },
      { label: 'Starts', value: String(data.starts) },
      { label: 'Minutes', value: String(data.minutesTotal) },
      { label: 'Points', value: String(data.totals.points) },
      { label: 'Tries', value: String(data.totals.tries) },
      {
        label: 'Cards',
        value: `${data.totals.yellow_cards}Y ${data.totals.red_cards}R`,
      },
    ];
  }, [data]);

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
        <View style={styles.tileGrid}>
          {tiles.map((t) => (
            <View key={t.label} style={styles.tile}>
              <Text style={styles.tileValue}>{t.value}</Text>
              <Text style={styles.tileLabel}>{t.label}</Text>
            </View>
          ))}
        </View>
      )}
        </View>
      }
    />
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
  scoutValueGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
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
    gap: Spacing.three,
  },
  heroTextStack: {
    flex: 1,
    gap: 2,
  },
  // Preview-block bleed: unwraps the pane padding (carousel pages
  // re-apply the card column internally) and carries the 16pt rhythm.
  previewBleed: { marginHorizontal: -Spacing.four, gap: Spacing.three },
  pageCard: { flex: 1 },
  // Portrait photo slot — sized to carry visual weight in the 140pt
  // hero rather than reading as an afterthought chip.
  heroPhotoPlaceholder: {
    width: 88,
    height: 104,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: {
    // Player identity in the nation-code face — the jersey nameplate.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.xl,
    letterSpacing: TextTracking.wide,
    color: Colors.light.text,
    textTransform: 'uppercase',
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
  scoutTrack: {
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
  trendList: { gap: Spacing.three, marginTop: Spacing.one },
  trendRow: { gap: 4 },
  trendRowHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  trendLabel: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },

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
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.one,
  },
  tile: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    gap: 2,
  },
  tileValue: {
    // Score face on the season tiles.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.textSecondary,
  },
  tileLabel: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.xs,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
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
