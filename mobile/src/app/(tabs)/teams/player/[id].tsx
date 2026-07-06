import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { usePlayer, usePlayerPercentiles } from '@/api/hooks';
import { PageGradient } from '@/components/page-gradient';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { ErrorState, LoadingState } from '@/components/state-views';
import { Colors, DRILL_HERO_MIN_HEIGHT, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { usePlayerAggregate, type PlayerStatField } from '@/hooks/use-player-aggregate';
import { usePlayerAnalysis } from '@/hooks/use-player-analysis';
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
import { PLAYER_SECTION_INFO, type SectionInfo } from '@/lib/analysis-section-info';
import { CHART_LINE_COLOR, smoothLinePath } from '@/lib/smooth-path';

// Trend dot colours — same trio as the form circles / Form chart.
const TREND_UP_COLOR = '#059669';
const TREND_DOWN_COLOR = '#DC2626';
const TREND_FLAT_COLOR = '#9CA3AF';

const LOOKBACK = PLAYER_LOOKBACK;
const GOOD_COLOR = '#059669';
const BAD_COLOR = StatusColor.live;

type PlayerTab = 'preview' | 'stats' | 'insights' | 'analysis';

const PLAYER_TABS: readonly { id: PlayerTab; label: string }[] = [
  // Mirrors the fixture drill's arc, player-scoped: Preview is the
  // backdrop (form trends + season summary), Stats the numeric record,
  // Insights the visual BI read (scouting percentiles), Analysis the
  // written synthesis.
  { id: 'preview', label: 'Preview' },
  { id: 'stats', label: 'Stats' },
  { id: 'insights', label: 'Insights' },
  { id: 'analysis', label: 'Analysis' },
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
      <SafeAreaView edges={['bottom']} style={styles.safe}>
        <PageGradient />
        <LoadingState />
      </SafeAreaView>
    );
  }
  if (player.isError || !player.data) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.safe}>
        <PageGradient />
        <ErrorState error={player.error ?? new Error(`player ${playerId} not found`)} />
      </SafeAreaView>
    );
  }

  const p = player.data;
  const isForward = FORWARD_POSITIONS.includes(p.primary_position);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
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

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        {tab === 'preview' && (
          <>
            <TrendCard
              playerId={playerId}
              metrics={isForward ? FORWARD_TREND : BACK_TREND}
            />
            <SeasonCard playerId={playerId} />
          </>
        )}
        {tab === 'stats' && <PlayerStatsTable playerId={playerId} />}
        {tab === 'insights' && (
          <ScoutingCard
            playerId={playerId}
            metrics={isForward ? FORWARD_SCOUT : BACK_SCOUT}
          />
        )}
        {tab === 'analysis' && <PlayerAnalysisCard playerId={playerId} />}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Scouting (percentile bars) ─────────────────────────────────────────────

function ScoutingCard({
  playerId,
  metrics,
}: {
  playerId: string;
  metrics: readonly ScoutMetric[];
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
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Scouting</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the scouting percentiles">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
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

      <InfoModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        title={`Scouting (prev. ${LOOKBACK})`}
        paragraphs={[
          `Each bar ranks the player against every ${groupLabel.replace('players', 'player')} across the international pool, using per-80-minute rates over their last ${LOOKBACK} appearances — so bench shifts and full games compare fairly.`,
          'The 80th percentile means better than 80% of positional peers. The tick at the halfway mark is the peer median. Lower-is-better rows (penalties, errors) are already flipped, so a longer green bar is always the better read.',
          'Peers need at least 3 appearances in the window to enter the pool, keeping one-cameo outliers from distorting the distribution.',
        ]}
      />
    </View>
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
  return (
    <View style={styles.scoutRow}>
      <View style={styles.scoutRowHead}>
        <Text style={styles.scoutLabel}>{label}</Text>
        <Text style={styles.scoutValue}>
          {formatPer80(per80)}
          <Text style={styles.scoutSuffix}> /80</Text>
          {'   '}
          <Text style={styles.scoutPct}>{percentile}</Text>
        </Text>
      </View>
      <View style={styles.scoutTrack}>
        <View
          style={[
            styles.scoutFill,
            {
              width: `${percentile}%`,
              backgroundColor: percentile >= 50 ? GOOD_COLOR : BAD_COLOR,
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
}: {
  playerId: string;
  metrics: readonly { field: PlayerStatField; label: string }[];
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
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Form</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the form trends">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
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

      <InfoModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        title={`Form (prev. ${LOOKBACK})`}
        paragraphs={[
          `Per-appearance trend across the player's last ${LOOKBACK} matches played, oldest (left) to most recent (right). The number on the right is the most recent appearance's value.`,
          'Raw per-match values, not per-80 rates — a quiet 20-minute cameo shows as a dip, which is part of the story.',
        ]}
      />
    </View>
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
        <Text style={styles.trendValue}>{latest}</Text>
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

function SeasonCard({ playerId }: { playerId: string }) {
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
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>Season</Text>
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

// ─── Analysis narrative ─────────────────────────────────────────────────────

/**
 * Templated player narrative for the Analysis pane — same visual grammar
 * as the match analysis card (small-caps mini-label + glyph above prose).
 * Structure and thresholds are defined by the "Player analysis" section
 * of `docs/analysis-narrative-spec.md`; `usePlayerAnalysis` is the
 * client-side template implementation pending the Phase 6 LLM cutover.
 */
function PlayerAnalysisCard({ playerId }: { playerId: string }) {
  const [infoOpen, setInfoOpen] = useState(false);
  // Accordion: exactly one section open at all times. The title row's
  // summary is the resting state — it starts open, closes when a
  // category dropdown opens, and reopens whenever the open dropdown is
  // closed (closing never leaves the card empty).
  const [openSection, setOpenSection] = useState<string>('__summary__');
  const [sectionInfo, setSectionInfo] = useState<SectionInfo | null>(null);
  const accordion = (label: string) => ({
    open: openSection === label,
    onToggle: () => setOpenSection((p) => (p === label ? '__summary__' : label)),
  });
  const { data, isLoading } = usePlayerAnalysis(playerId);

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.headerRow}
        onPress={accordion('__summary__').onToggle}
        accessibilityRole="button"
        accessibilityLabel="Toggle the player analysis summary">
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Player Analysis</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the player analysis">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
        <Ionicons
          name={openSection === '__summary__' ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={Colors.light.textSecondary}
        />
      </Pressable>

      {isLoading && !data ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : !data ? (
        <Text style={styles.empty}>Analysis populates once the player has made an appearance.</Text>
      ) : (
        <View style={styles.narrativeStack}>
          {/* Cold-open summary — body of the title section above. */}
          {openSection === '__summary__' ? (
            <Text style={styles.narrativeSummary}>{data.summary}</Text>
          ) : null}

          <PlayerNarrativeSection label="Scouting" onInfo={() => setSectionInfo(PLAYER_SECTION_INFO['Scouting']!)} {...accordion("Scouting")}>
            {data.scouting}
          </PlayerNarrativeSection>
          <PlayerNarrativeSection label="Form" onInfo={() => setSectionInfo(PLAYER_SECTION_INFO['Form']!)} {...accordion("Form")}>
            {data.form}
          </PlayerNarrativeSection>
          <PlayerNarrativeSection label="Outlook" onInfo={() => setSectionInfo(PLAYER_SECTION_INFO['Outlook']!)} {...accordion("Outlook")}>
            {data.outlook}
          </PlayerNarrativeSection>
        </View>
      )}

      <InfoModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="Player Analysis"
        paragraphs={[
          'A written synthesis of everything the other tabs show: the percentile profile from Insights, the trend lines from Preview, and the season record from Stats, pulled together into an analyst read.',
          'The scouting read names genuine strengths (70th percentile or better against positional peers) and soft spots (30th or below). The form read compares the recent half of the appearance window against the earlier half; moves under 15% are reported as steady.',
        ]}
      />
      <InfoModal
        visible={sectionInfo !== null}
        onClose={() => setSectionInfo(null)}
        title={sectionInfo?.title ?? ''}
        paragraphs={sectionInfo?.paragraphs ?? []}
      />
    </View>
  );
}

function PlayerNarrativeSection({
  label,
  onInfo,
  children,
  open,
  onToggle,
}: {
  label: string;
  onInfo: () => void;
  children: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.narrativeSection}>
      <Pressable
        onPress={onToggle}
        style={styles.narrativeMiniLabelRow}
        accessibilityRole="button"
        accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${label}`}>
        <View style={styles.narrativeMiniLabelGroup}>
          <Text style={styles.narrativeMiniLabel}>{label}</Text>
          <Pressable
            onPress={onInfo}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Explain ${label}`}>
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={Colors.light.textSecondary}
        />
      </Pressable>
      {open ? <Text style={styles.narrativeBody}>{children}</Text> : null}
    </View>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────

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
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
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
    // Same scale as the nation code on the team hero.
    fontSize: TextSize.xl,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
    flexShrink: 1,
  },
  // Meta stack — quiet lines (position · age, measurables · caps,
  // team) left-aligned in the right-hand space.
  heroMetaText: {
    fontSize: TextSize.xs,
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
    fontSize: TextSize.sm,
    fontWeight: TextWeight.regular,
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
  scoutPct: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
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
    fontSize: TextSize.sm,
    fontWeight: TextWeight.regular,
    color: Colors.light.textSecondary,
  },
  trendValue: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
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
    width: NUM_COL_WIDTH,
    textAlign: 'right',
    fontSize: TextSize.sm,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },

  // Analysis narrative — same grammar as the match analysis card:
  // fixed-gap stack, small-caps centred mini-labels, prose beneath.
  narrativeStack: {
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  narrativeSummary: {
    fontSize: TextSize.sm,
    color: Colors.light.text,
    lineHeight: 22,
  },
  narrativeSection: {
    gap: 4,
  },
  narrativeMiniLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // Label + icon left, expand chevron right — the squad card's
    // dropdown-header grammar. Symmetric vertical padding keeps the
    // text dead-centre in the row height.
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  narrativeMiniLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: TextSize.lg,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },
  tileLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.semibold,
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
