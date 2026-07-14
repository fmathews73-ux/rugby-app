import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { usePlayer, usePlayerPercentiles, useTeam, useTeams } from '@/api/hooks';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { CapsJerseyBadge } from '@/components/squad-jersey';
import { CardCarousel } from '@/components/card-carousel';
import { PlayerMatrixCard } from '@/components/insights/player-matrix-card';
import { LegendChip } from '@/components/insights/legend-chip';
import { fitNarrative } from '@/lib/fit-narrative';
import { PageGradient } from '@/components/page-gradient';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { ErrorState, LoadingState } from '@/components/state-views';
import { FlipTrigger } from '@/components/flip-trigger';
import { CountUpTSpan, CountUpValue } from '@/components/insights/count-up-value';
import { RadarChart } from '@/components/insights/radar-chart';
import { teamDotColor } from '@/lib/team-colors';
import { useChartInk } from '@/components/insights/use-chart-ink';
import { FlagSize, PAGE_BOTTOM_INSET, PAGE_CARD_MIN_HEIGHT, Colors, DRILL_HERO_MIN_HEIGHT, ScoreBug, Spacing, StatusColor, TextSize, TextTracking, TextWeight, ScoreBoxSize } from '@/constants/theme';
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
  RADAR_DIMENSIONS,
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
  // Profile leads (owner call 2026-07-10, reversing Season-first from
  // the day before): scouting deck lands, Season totals close the bar.
  // Insights and Analysis pills retired 2026-07-07.
  { id: 'preview', label: 'Profile' },
  { id: 'stats', label: 'Stats' },
  { id: 'season', label: 'Season KPIs' },
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
  const team = useTeam(player.data?.team_id ?? '');
  // Season workload for the hero's venue-line slot — starts appear
  // nowhere else in the app.
  const heroAgg = usePlayerAggregate(playerId);
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
        <Text style={styles.heroPositionLine}>
          {POSITION_LABELS[p.primary_position]} · {ageFrom(p.date_of_birth)}
        </Text>
        <View style={styles.heroRow}>
          {/* Team-hero composition: identity group left (40pt jersey
              mark + nameplate), meta stack centred in the remaining
              right-hand space — NOT under the name. */}
          {/* Player anchors the HOME side (owner flip 2026-07-10 pm):
              caps jersey then nameplate — the home anatomy. */}
          <View style={styles.heroIdentityGroup}>
            {/* Sized to the shield's true rendered height (width 40 ÷
                0.9045 aspect ≈ 44pt) so the two anchors stand level. */}
            <CapsJerseyBadge teamId={p.team_id} caps={p.cap_count} size={FlagSize.medium / 0.9045} />
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
            {/* Measurables as the match hero's score pair — centred
                with the anchors; the position line rides above the
                row like the date line (owner call 2026-07-10). */}
            <View style={styles.heroScoreRow}>
              <View style={[styles.heroScoreBox, ScoreBug.cutLeft]}>
                <Text style={styles.heroScoreText}>{p.height_cm}</Text>
                <View style={styles.heroUnitStack}>
                  <Text style={styles.heroScoreUnit}>C</Text>
                  <Text style={styles.heroScoreUnit}>M</Text>
                </View>
              </View>
              <View style={[styles.heroScoreBox, ScoreBug.cutRight]}>
                <Text style={styles.heroScoreText}>{p.weight_kg}</Text>
                <View style={styles.heroUnitStack}>
                  <Text style={styles.heroScoreUnit}>K</Text>
                  <Text style={styles.heroScoreUnit}>G</Text>
                </View>
              </View>
            </View>
          </View>
          {/* Nation anchors the AWAY side: code then shield — the
              match hero's away mirror. */}
          <View style={styles.heroNationGroup}>
            <Text style={styles.heroCode}>
              {team.data?.short_name ?? p.team_id.toUpperCase()}
            </Text>
            {team.data ? (
              <TeamFlagShield flagCode={team.data.flag_code} width={FlagSize.medium} />
            ) : null}
          </View>
        </View>
        {/* Venue-line slot of the match hero — DUMMY copy until the
            owner picks this line's content. */}
        <Text style={styles.heroPositionLine}>
          {heroAgg.data
            ? `${heroAgg.data.starts} starts · ${heroAgg.data.appearances - heroAgg.data.starts} from bench · ${heroAgg.data.minutesTotal} mins`
            : '—'}
        </Text>
      </View>
      <SegmentedTabs tabs={PLAYER_TABS} active={tab} onSelect={handleTabSelect} />

      <FadingScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        {tab === 'season' && (
          <SeasonPane playerId={playerId} teamId={p.team_id} isForward={isForward} />
        )}
        {tab === 'preview' && (
          <PlayerPreviewBlock
            playerId={playerId}
            teamId={p.team_id}
            isForward={isForward}
          />
        )}
        {tab === 'stats' && (
          <PlayerStatsPane playerId={playerId} isForward={isForward} />
        )}
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
      {/* ONE carousel (owner call 2026-07-10): radar leads at its
          anchored size, the six category cards follow as pages —
          the same deck grammar as every other chart pane. */}
      <View style={styles.carouselBleed}>
        <CardCarousel
          pages={[
            <PlayerRadarCard
              key="radar"
              playerId={playerId}
              teamId={teamId}
              isForward={isForward}
              style={styles.pageCard}
              read={profileRead}
            />,
            // Style-of-player matrices (owner calls 2026-07-10): the
            // tier-matrix grammar at player scale vs the ten most-used
            // players in his position group. SHARED duo first (work
            // rate and ball security read the same in any shirt
            // number), then the role set — backs aren't measured in
            // pack currency.
            <PlayerMatrixCard
              key="engine"
              playerId={playerId}
              teamId={teamId}
              title="Engine"
              purpose="The two-way work-rate map: the ten most-used players in his position plotted by carries against tackles per game, him in his squad colour — top-right does both jobs, bottom-left is along for the ride. Dot size is minutes played."
              accessibilityLabel="Explain the engine matrix"
              xAxis={{ field: 'carries' }}
              yAxis={{ field: 'tackles_made' }}
              quadrants={{ tr: 'WORKHORSES', tl: 'STOPPERS', br: 'CARRIERS', bl: 'PASSENGERS' }}
              xCaption="CARRIES /GAME →"
              yCaption="TACKLES /GAME →"
              style={styles.pageCard}
            />,
            <PlayerMatrixCard
              key="hands"
              playerId={playerId}
              teamId={teamId}
              title="Hands"
              purpose="Ball security under volume: touches per game (carries plus passes) against handling errors, vs the ten most-used players in his position — safe hands are busy AND tidy; butterfingers pay for their volume. Fewer errors plots higher. Dot size is minutes played."
              accessibilityLabel="Explain the hands matrix"
              xAxis={{ sum: ['carries', 'passes'] }}
              yAxis={{ field: 'handling_errors' }}
              yLowerIsBetter
              quadrants={{ tr: 'SAFE HANDS', tl: 'TIDY', br: 'BUTTERFINGERS', bl: 'LIABILITIES' }}
              xCaption="TOUCHES /GAME →"
              yCaption="FEWER ERRORS →"
              style={styles.pageCard}
            />,
            ...(isForward
              ? [
                  <PlayerMatrixCard
                    key="punch"
                    playerId={playerId}
                    teamId={teamId}
                    title="Carries"
                    purpose="Volume against yield among the ten most-used players in his position: carries per game against the metres each carry buys — the wrecking ball carries often AND far; hard yards is honest graft that gains little. Dot size is minutes played."
                    accessibilityLabel="Explain the carries matrix"
                    xAxis={{ field: 'carries' }}
                    yAxis={{ ratio: ['metres_carried', 'carries'] }}
                    quadrants={{ tr: 'WRECKING BALLS', tl: 'EXPLOSIVE', br: 'HARD YARDS', bl: 'ON THE FRINGES' }}
                    xCaption="CARRIES /GAME →"
                    yCaption="METRES PER CARRY →"
                    style={styles.pageCard}
                  />,
                  <PlayerMatrixCard
                    key="jackal"
                    playerId={playerId}
                    teamId={teamId}
                    title="Jackal"
                    purpose="The breakdown trade among the ten most-used players in his position: ruck arrivals per game against turnovers won — the pickpocket attends AND steals; body work hits every ruck for little return. Dot size is minutes played."
                    accessibilityLabel="Explain the jackal matrix"
                    xAxis={{ field: 'rucks_hit' }}
                    yAxis={{ field: 'turnovers_won' }}
                    quadrants={{ tr: 'PICKPOCKETS', tl: 'POACHERS', br: 'BODY WORK', bl: 'BYSTANDERS' }}
                    xCaption="RUCK ARRIVALS /GAME →"
                    yCaption="TURNOVERS WON /GAME →"
                    style={styles.pageCard}
                  />,
                ]
              : [
                  <PlayerMatrixCard
                    key="strike"
                    playerId={playerId}
                    teamId={teamId}
                    title="Strike"
                    purpose="The line-breaking threat among the ten most-used players in his position: defenders beaten per game against clean breaks — top-right beats his man AND finds the hole; the ghost slips through without contact. Dot size is minutes played."
                    accessibilityLabel="Explain the strike matrix"
                    xAxis={{ field: 'defenders_beaten' }}
                    yAxis={{ field: 'clean_breaks' }}
                    quadrants={{ tr: 'LINE BREAKERS', tl: 'GHOSTS', br: 'HARD TO HANDLE', bl: 'CONTAINED' }}
                    xCaption="DEFENDERS BEATEN /GAME →"
                    yCaption="CLEAN BREAKS /GAME →"
                    style={styles.pageCard}
                  />,
                  <PlayerMatrixCard
                    key="playmaker"
                    playerId={playerId}
                    teamId={teamId}
                    title="Playmaker"
                    purpose="Distribution against creation among the ten most-used players in his position: passes per game against try assists — the puppet master moves the ball AND makes tries; the link man keeps it moving without the final touch. Dot size is minutes played."
                    accessibilityLabel="Explain the playmaker matrix"
                    xAxis={{ field: 'passes' }}
                    yAxis={{ field: 'try_assists' }}
                    quadrants={{ tr: 'PUPPET MASTERS', tl: 'KILLER PASS', br: 'LINK MEN', bl: 'BIT PART' }}
                    xCaption="PASSES /GAME →"
                    yCaption="TRY ASSISTS /GAME →"
                    style={styles.pageCard}
                  />,
                  <PlayerMatrixCard
                    key="boot"
                    playerId={playerId}
                    teamId={teamId}
                    title="Boot"
                    purpose="Kicking volume against yield among the ten most-used players in his position: kicks from hand per game against the metres each kick buys — the launcher kicks often AND long; the short game trades distance for contestables. Dot size is minutes played."
                    accessibilityLabel="Explain the boot matrix"
                    xAxis={{ field: 'kicks_from_hand' }}
                    yAxis={{ ratio: ['kick_metres', 'kicks_from_hand'] }}
                    quadrants={{ tr: 'LAUNCHERS', tl: 'LONG RANGE', br: 'SHORT GAME', bl: 'BALL IN HAND' }}
                    xCaption="KICKS FROM HAND /GAME →"
                    yCaption="METRES PER KICK →"
                    style={styles.pageCard}
                  />,
                ]),
          ]}
        />
      </View>
    </View>
  );
}

// ─── Stats pane (peer bars + reference table) ──────────────────────────────

/** Stats = the numbers pane (owner call 2026-07-10): the four
 *  category peer-bar cards, STACKED (stats are never carousels) —
 *  the original three-column table is deleted; the bars ARE the
 *  record now. Profile keeps shape and style (radar + matrices). */
function PlayerStatsPane({
  playerId,
  isForward,
}: {
  playerId: string;
  isForward: boolean;
}) {
  return (
    <View style={styles.profileStack}>
      {(isForward ? FORWARD_CATEGORY_ORDER : BACK_CATEGORY_ORDER).map((key) => {
        const cat = SCOUT_CATEGORIES[key]!;
        return (
          <ScoutingCard
            key={key}
            title={cat.title}
            purpose={cat.purpose}
            playerId={playerId}
            metrics={cat.metrics}
            style={styles.stackCard}
          />
        );
      })}
    </View>
  );
}

// ─── Season pane ────────────────────────────────────────────────────────────

function SeasonPane({
  playerId,
  teamId,
  isForward,
}: {
  playerId: string;
  teamId: string;
  isForward: boolean;
}) {
  const analysis = usePlayerAnalysis(playerId);
  return (
    <View style={styles.profileStack}>
      <SeasonCard
        playerId={playerId}
        teamId={teamId}
        isForward={isForward}
        style={styles.stackCard}
        read={analysis.data?.season ?? null}
      />
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
        <View style={[styles.valueBox, ScoreBug.cutLeft, !isTie && favourable ? styles.valueBoxWin : null]}>
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
        <View style={[styles.valueBox, ScoreBug.cutRight]}>
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
  return String(Math.round(r));
}

// ─── Player radar (shape lead card) ─────────────────────────────────────────

function PlayerRadarCard({
  playerId,
  teamId,
  isForward,
  style,
  read,
}: {
  playerId: string;
  teamId: string;
  isForward: boolean;
  style?: StyleProp<ViewStyle>;
  /** Full scouting narrative for the flip back. */
  read?: string | null;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const percentiles = usePlayerPercentiles(playerId, LOOKBACK);
  const player = usePlayer(playerId);

  // Six lobes = the six DEPARTMENTS (RADAR_DIMENSIONS) — composite
  // display percentiles, lower-is-better rows pre-flipped, so more
  // area is always more standing vs the positional peer pool.
  const axes = useMemo(() => {
    const byField = new Map(
      (percentiles.data?.metrics ?? []).map((m) => [m.field, m.percentile]),
    );
    return RADAR_DIMENSIONS.map((dim) => {
      const displays = dim.metrics.map((m) => {
        const pct = byField.get(m.field) ?? 0;
        return m.inverted ? 100 - pct : pct;
      });
      const mean =
        displays.length > 0 ? displays.reduce((a, b) => a + b, 0) / displays.length : 0;
      return {
        key: dim.key,
        label: dim.label,
        value: mean / 100,
        raw: `${Math.round(mean)} pctile`,
      };
    });
  }, [percentiles.data]);

  const ready = Boolean(percentiles.data && percentiles.data.appearances > 0);

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Profile"
          onClose={() => setInfoOpen(false)}
          read={read}
          purpose={<>The player's shape in one glance — six departments, each his overall standing against every positional peer. A full lobe leads that department; a shallow one trails it; the cards behind carry the numbers.</>}
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
              accessibilityLabel="Explain the player profile radar">
              <FlipTrigger />
            </Pressable>
          </View>
          {percentiles.isLoading ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : !ready ? (
            <Text style={styles.empty}>No appearances yet to profile.</Text>
          ) : (
            <>
              <RadarChart
                axes={axes}
                strokeColor="transparent"
                fillColor={teamDotColor(teamId)}
                dotColor={teamDotColor(teamId)}
                flatFillOpacity={0.25}
              />
              {/* Bottom-centred legend — team-Profile grammar, the
                  player's SURNAME as the label (owner call 2026-07-10). */}
              <View style={styles.radarLegend}>
                <LegendChip
                  label={player.data ? surname(player.data.name) : ''}
                  color={teamDotColor(teamId) ?? Colors.light.textSecondary}
                />
              </View>
            </>
          )}
        </View>
      }
    />
  );
}

// ─── Season totals ──────────────────────────────────────────────────────────

/**
 * Season — the fan's ledger (owner call 2026-07-10): the season so
 * far in plain COUNTING numbers, broadcast-bug tiles, no bars and no
 * comparison anywhere. Averages live on Stats; standing lives on
 * Profile. Values count up on arrival like every score tile.
 */
function SeasonCard({
  playerId,
  teamId,
  isForward,
  style,
  read,
}: {
  playerId: string;
  teamId: string;
  isForward: boolean;
  style?: StyleProp<ViewStyle>;
  /** Season narrative for the flip back. */
  read?: string | null;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const { data, isLoading } = usePlayerAggregate(playerId);
  const ink = useChartInk();

  const tiles = useMemo(() => {
    if (!data) return [];
    const t = data.totals;
    // Row 1 is the selection funnel (owner call 2026-07-10):
    // picked in the 23 → took the field → time on the pitch.
    // 3×4 grid, ROLE-FLAVOURED below the universal funnel row
    // (owner call 2026-07-10): forwards ledger in contact/set-piece
    // currency, backs in strike/boot currency.
    const funnel = [
      { label: 'SELECTED', value: data.selections },
      { label: 'APPS', value: data.appearances },
      { label: 'MINUTES', value: data.minutesTotal },
    ];
    return isForward
      ? [
          ...funnel,
          { label: 'POINTS', value: t.points },
          { label: 'TRIES', value: t.tries },
          { label: 'CARRIES', value: t.carries },
          { label: 'METRES', value: t.metres_carried },
          { label: 'TACKLES', value: t.tackles_made },
          { label: 'TURNOVERS WON', value: t.turnovers_won },
          { label: 'RUCKS HIT', value: t.rucks_hit },
          { label: 'LINEOUT TAKES', value: t.lineout_takes },
          { label: 'OFFLOADS', value: t.offloads },
        ]
      : [
          ...funnel,
          { label: 'POINTS', value: t.points },
          { label: 'TRIES', value: t.tries },
          { label: 'ASSISTS', value: t.try_assists },
          { label: 'METRES', value: t.metres_carried },
          { label: 'BREAKS', value: t.clean_breaks },
          { label: 'DEF. BEATEN', value: t.defenders_beaten },
          { label: 'KICK METRES', value: t.kick_metres },
          { label: 'PASSES', value: t.passes },
          { label: 'OFFLOADS', value: t.offloads },
        ];
  }, [data, isForward]);

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
              The season so far in counting numbers — appearances, minutes
              and the milestones as they stand today. Averages live on
              Stats; where he ranks lives on Profile.
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
              accessibilityLabel="Explain the season ledger">
              <FlipTrigger />
            </Pressable>
          </View>

          {isLoading ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : !data || data.appearances === 0 ? (
            <Text style={styles.empty}>No appearances yet this season.</Text>
          ) : (
            <View style={styles.ledgerGrid}>
              {tiles.map((tile) => (
                <View key={tile.label} style={styles.ledgerTile}>
                  {/* Bare squad-colour number — tile backgrounds
                      trialled and reverted (owner call 2026-07-10). */}
                  <Text style={[styles.ledgerValue, { color: teamDotColor(teamId) ?? Colors.light.text }]}>
                    <CountUpValue value={String(Math.round(tile.value))} ink={ink} />
                  </Text>
                  <Text style={styles.ledgerLabel} numberOfLines={1}>
                    {tile.label}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      }
    />
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
  // Mini score tiles — match-score convention (winner dark/white when
  // above the reference, quiet light/grey otherwise).
  valueBox: {
    width: 44,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    ...ScoreBug.skew,
  },
  valueBoxWin: { backgroundColor: Colors.light.textSecondary },
  valueBoxText: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.textSecondary,
    ...ScoreBug.counterSkew,
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
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  // Single hero row: identity group left, meta stack filling the right
  // — the same treatment as the team drill hero.
  // Match-hero symmetry (owner call 2026-07-10): three EQUAL slots —
  // identity · meta · nation — each centred in its third, same row
  // gap and inner padding as matchupTopRow.
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    // Match hero's symmetric breathing above/below the anchor row.
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
    gap: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  // Form bar canvas fills the card's remaining height (measured in
  // real pixels — no viewBox stretch).
  formBarsFill: { flex: 1, minHeight: 190 },
  heroNameStack: {
    gap: 0,
  },
  heroIdentityGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  // Meta CENTRES between the two identity anchors — the score-slot
  // position of the match hero.
  heroMetaStack: {
    // Wider centre slot — the outer identity slots stay EQUAL so the
    // hero keeps its symmetry, but the meta column gets the room long
    // position names need on one line.
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  // Preview-block bleed: unwraps the pane padding (carousel pages
  // re-apply the card column internally) and carries the 16pt rhythm.
  // Vertical card stack (owner call 2026-07-09, fixture-Stats
  // grammar): one card per scouting category, Form and Season beneath
  // — carousel retired on this pane.
  profileStack: { gap: Spacing.three },
  // Uniform card height (PAGE_CARD_MIN_HEIGHT anchor) — the stack has
  // no carousel equalization, so every card carries it explicitly.
  stackCard: { minHeight: PAGE_CARD_MIN_HEIGHT },
  // Full-screen-width carousel escapes the pane's 24pt padding; pages
  // re-apply the card column internally (fixture-pane pattern).
  carouselBleed: { marginHorizontal: -Spacing.four },
  pageCard: { flex: 1 },
  // Portrait photo slot — sized to carry visual weight in the 140pt
  // hero rather than reading as an afterthought chip.
  heroName: {
    // Squad-row nameplate register (owner call 2026-07-10) — the same
    // face and size as the player rows in the team squad table.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
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
  // Right identity anchor — the match hero's away-side anatomy
  // (code then shield), owner call 2026-07-10: player heroes read
  // like the matchup hero with the player as the home side.
  heroNationGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  heroCode: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.xl,
    letterSpacing: TextTracking.wide,
    color: Colors.light.text,
  },
  // Match-score tile pair for the measurables — with the match
  // hero's symmetric 16pt breathing room above and below the tiles.
  heroScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // Match hero's card score-box register (ScoreBoxSize.card + xl
  // digits) — one score anatomy across every hero.
  heroScoreBox: {
    minWidth: ScoreBoxSize.card.width,
    height: ScoreBoxSize.card.height,
    borderRadius: ScoreBoxSize.card.borderRadius,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 5,
    ...ScoreBug.skew,
  },
  heroScoreText: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.xl,
    color: Colors.light.textSecondary,
    ...ScoreBug.counterSkew,
  },
  // Unit letters stacked VERTICALLY beside the digits (owner call
  // 2026-07-10: the inline " CM" suffix overlapped on device and
  // widened the tile). Counter-skewed like the digits.
  heroUnitStack: {
    justifyContent: 'center',
    ...ScoreBug.counterSkew,
  },
  heroScoreUnit: {
    fontFamily: 'WorkSans_500Medium_Italic',
    fontSize: 7,
    lineHeight: 8,
    color: Colors.light.textSecondary,
  },
  // Date-line slot of the match hero — the position rides above the
  // anchor row, centred.
  heroPositionLine: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  heroMetaText: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  // Scouting
  // Broadcast-bug season tiles — 3-up grid filling the anchored card.
  ledgerGrid: {
    flexGrow: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'space-evenly',
  },
  ledgerTile: {
    width: '33.33%',
    alignItems: 'center',
    gap: 2,
  },
  ledgerValue: {
    // Match-score face at hero scale — the number IS the story.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: 28,
    color: Colors.light.text,
  },
  ledgerLabel: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.xs,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  // Rows distribute across the anchored card height (ladder grammar)
  // instead of pooling whitespace at the bottom.
  scoutList: {
    flexGrow: 1,
    justifyContent: 'space-evenly',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
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
    // CardHeaderActions hard rule: fixed 16pt gap before the trigger.
    gap: Spacing.three,
  },
  peerTag: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.xs,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  radarLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
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
    fontFamily: 'WorkSans_500Medium',
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
