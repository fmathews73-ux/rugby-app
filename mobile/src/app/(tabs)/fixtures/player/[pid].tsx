import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PlayerMatchStats } from '@rugby-app/shared';

import { useFixture, useFixturePlayers, usePlayer, useTeam } from '@/api/hooks';
import { CardCarousel } from '@/components/card-carousel';
import { FadingScrollView } from '@/components/fading-scroll-view';
import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { FlipTrigger } from '@/components/flip-trigger';
import { LegendChip } from '@/components/insights/legend-chip';
import { MatrixChart, type MatrixPoint } from '@/components/insights/matrix-chart';
import { RadarChart } from '@/components/insights/radar-chart';
import { CountUpValue } from '@/components/insights/count-up-value';
import { useChartInk } from '@/components/insights/use-chart-ink';
import { PageGradient } from '@/components/page-gradient';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { CapsJerseyBadge } from '@/components/squad-jersey';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { ErrorState, LoadingState } from '@/components/state-views';
import { FlagSize, PAGE_BOTTOM_INSET, PAGE_CARD_MIN_HEIGHT, Colors, DRILL_HERO_MIN_HEIGHT, Spacing, StatusColor, TextSize, TextTracking, TextWeight, ScoreBoxSize } from '@/constants/theme';
import { usePlayerAggregate, type PlayerStatField } from '@/hooks/use-player-aggregate';
import { useFixturePlayerStats, usePlayerMatchStats } from '@/hooks/use-player-match-stats';
import {
  FORWARD_POSITIONS,
  POSITION_GROUP_MEMBERS,
  POSITION_LABELS,
  RADAR_DIMENSIONS,
  positionGroupOf,
} from '@/lib/player-roles';
import { teamDotColor } from '@/lib/team-colors';

const BASELINE_LOOKBACK = 10;
const GOOD_COLOR = '#059669';
const BAD_COLOR = StatusColor.live;
const TIE_COLOR = Colors.light.textSecondary;

type MatchTab = 'profile' | 'stats' | 'match';

const MATCH_TABS: readonly { id: MatchTab; label: string }[] = [
  // The Teams player card's anatomy, match-scoped (owner call
  // 2026-07-10): Profile = shape and style TONIGHT, Stats = tonight's
  // numbers vs the norm he carried in, Match = the counting ledger.
  { id: 'profile', label: 'Profile' },
  { id: 'stats', label: 'Stats' },
  { id: 'match', label: 'Match KPIs' },
];

interface SheetMetric {
  field: PlayerStatField;
  label: string;
  /** Lower is better — flips the bar colouring. */
  inverted?: boolean;
  /** Hide the row when this match's value AND the norm are both zero —
   *  keeps non-kickers' sheets free of empty goal-kicking rows without
   *  ever hiding a real datapoint. */
  hideWhenZero?: boolean;
}

const NORM_DECODE =
  'The right tile is the per-game norm he carried into this match — his previous ten appearances, frozen at kickoff. Tonight beats the norm in green, falls short in red, grey when level; on giveaway rows the lower number wins the green.';

/** Full feed sheet, grouped in the app's category order. */
const SHEET_SECTIONS: readonly {
  label: string;
  purpose: string;
  metrics: readonly SheetMetric[];
}[] = [
  {
    label: 'Attack',
    purpose: `His with-ball shift tonight — points, carries and what they broke. ${NORM_DECODE}`,
    metrics: [
      { field: 'points', label: 'Points' },
      { field: 'tries', label: 'Tries' },
      { field: 'try_assists', label: 'Try assists' },
      { field: 'carries', label: 'Carries' },
      { field: 'metres_carried', label: 'Metres carried' },
      { field: 'clean_breaks', label: 'Clean breaks' },
      { field: 'defenders_beaten', label: 'Defenders beaten' },
      { field: 'offloads', label: 'Offloads' },
      { field: 'passes', label: 'Passes' },
    ],
  },
  {
    label: 'Kicking',
    purpose: `His boot tonight — kicks from hand, the metres they bought and any goal kicks (goal-kicking rows hide when they carry nothing). ${NORM_DECODE}`,
    metrics: [
      { field: 'kicks_from_hand', label: 'Kicks from hand' },
      { field: 'kick_metres', label: 'Kick metres' },
      { field: 'conversions', label: 'Conversions', hideWhenZero: true },
      { field: 'penalty_goals', label: 'Penalty goals', hideWhenZero: true },
      { field: 'drop_goals', label: 'Drop goals', hideWhenZero: true },
    ],
  },
  {
    label: 'Defence & Breakdown',
    purpose: `His contact-area shift tonight — tackles, the ones that slipped, and the ball won at ruck and lineout. ${NORM_DECODE}`,
    metrics: [
      { field: 'tackles_made', label: 'Tackles' },
      { field: 'missed_tackles', label: 'Missed tackles', inverted: true },
      { field: 'turnovers_won', label: 'Turnovers won' },
      { field: 'rucks_hit', label: 'Rucks hit' },
      { field: 'lineout_takes', label: 'Lineout takes', hideWhenZero: true },
      { field: 'lineout_steals', label: 'Lineout steals', hideWhenZero: true },
    ],
  },
  {
    label: 'Discipline',
    purpose: `His giveaway ledger tonight — errors, penalties and cards (card rows hide when clean). ${NORM_DECODE}`,
    metrics: [
      { field: 'handling_errors', label: 'Handling errors', inverted: true },
      { field: 'penalties_conceded', label: 'Penalties conceded', inverted: true },
      { field: 'yellow_cards', label: 'Yellow cards', inverted: true, hideWhenZero: true },
      { field: 'red_cards', label: 'Red cards', inverted: true, hideWhenZero: true },
    ],
  },
];

/** One tonight-peer with his sheet — the pool behind the match radar
 *  and matrices. */
interface TonightPeer {
  playerId: string;
  name: string;
  sheet: PlayerMatchStats;
}

type AxisSpec = { field: PlayerStatField } | { ratio: [PlayerStatField, PlayerStatField] } | { sum: [PlayerStatField, PlayerStatField] };

function axisValue(sheet: PlayerMatchStats, spec: AxisSpec): number {
  if ('field' in spec) return sheet[spec.field];
  if ('sum' in spec) return sheet[spec.sum[0]] + sheet[spec.sum[1]];
  const den = sheet[spec.ratio[1]];
  return den > 0 ? sheet[spec.ratio[0]] / den : 0;
}

const PEER_FRAME =
  'The comparison pool is every player in his position group who took the field in THIS match, both squads — tonight’s direct rivals for the same job, not the wider Test population the Teams profile ranks him against.';

/**
 * Fixture player drill — the Teams player card's three-pane anatomy,
 * match-scoped (owner call 2026-07-10). Every number on every pane is
 * THIS match: Profile ranks his shape and style against tonight's
 * positional peers; Stats bars his numbers against the norm he
 * carried in; Match is the counting ledger. Back returns to Line-Up.
 */
export default function PlayerMatchScreen() {
  const { pid, fixtureId } = useLocalSearchParams<{ pid: string; fixtureId: string }>();
  const playerId = pid ?? '';
  const [tab, setTab] = useState<MatchTab>('profile');

  const fixture = useFixture(fixtureId ?? '');
  const player = usePlayer(playerId);
  const team = useTeam(player.data?.team_id ?? '');
  const sheet = usePlayerMatchStats(fixtureId ?? '', playerId);
  const allSheets = useFixturePlayerStats(fixtureId ?? '');
  const fixturePlayers = useFixturePlayers(fixtureId ?? '');
  // Norm frozen at THIS fixture's kickoff — the baseline the player
  // carried into the match, not one polluted by the match itself.
  const baseline = usePlayerAggregate(playerId, fixture.data?.kickoff_utc, BASELINE_LOOKBACK);
  // Season workload for the hero's venue-line slot (identical
  // heroes rule — same line as the Teams player card).
  const heroAgg = usePlayerAggregate(playerId);

  // Tonight's positional peer pool: same position GROUP (front row,
  // half-backs, …), took the field in this match, either squad.
  const peers: TonightPeer[] = useMemo(() => {
    if (!player.data || !allSheets.data || !fixturePlayers.data) return [];
    const group = positionGroupOf(player.data.primary_position);
    const members = POSITION_GROUP_MEMBERS[group] ?? [];
    const byId = new Map(fixturePlayers.data.map((p) => [p.id, p]));
    return allSheets.data
      .filter((s) => s.minutes_played > 0)
      .map((s) => ({ s, p: byId.get(s.player_id) }))
      .filter(({ p }) => p && members.includes(p.primary_position))
      .map(({ s, p }) => ({ playerId: s.player_id, name: p!.name, sheet: s }));
  }, [player.data, allSheets.data, fixturePlayers.data]);

  if (player.isLoading || fixture.isLoading) {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safe}>
        <PageGradient />
        <LoadingState />
      </SafeAreaView>
    );
  }
  if (player.isError || !player.data || fixture.isError || !fixture.data) {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safe}>
        <PageGradient />
        <ErrorState error={player.error ?? fixture.error ?? new Error('sheet not found')} />
      </SafeAreaView>
    );
  }

  const p = player.data;
  const noSheet = !sheet.isLoading && !sheet.data;

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      <PageGradient />
      {/* Hero IDENTICAL to the Teams player card (owner call
          2026-07-10) — one identity mark from squad list to any drill. */}
      <View style={styles.identityHeader}>
        <Text style={styles.heroPositionLine}>
          {POSITION_LABELS[p.primary_position]} · {ageFrom(p.date_of_birth)}
        </Text>
        <View style={styles.heroRow}>
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
              <View style={styles.heroScoreBox}>
                <Text style={styles.heroScoreText}>
                  {p.height_cm}
                  <Text style={styles.heroScoreUnit}> CM</Text>
                </Text>
              </View>
              <View style={styles.heroScoreBox}>
                <Text style={styles.heroScoreText}>
                  {p.weight_kg}
                  <Text style={styles.heroScoreUnit}> KG</Text>
                </Text>
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
      <SegmentedTabs tabs={MATCH_TABS} active={tab} onSelect={setTab} />

      <FadingScrollView contentContainerStyle={styles.scroll}>
        {noSheet ? (
          <Text style={styles.empty}>Match stat line populates at full-time.</Text>
        ) : !sheet.data ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : (
          <>
            {tab === 'profile' && (
              <View style={styles.carouselBleed}>
                <CardCarousel
                  pages={[
                    <MatchRadarCard
                      key="radar"
                      subject={p}
                      subjectSheet={sheet.data}
                      peers={peers}
                      style={styles.pageCard}
                    />,
                    ...buildMatrixPages(p, peers, styles.pageCard),
                  ]}
                />
              </View>
            )}

            {tab === 'stats' &&
              SHEET_SECTIONS.map((section) => (
                <NormCard
                  key={section.label}
                  section={section}
                  sheet={sheet.data!}
                  norm={
                    baseline.data && baseline.data.appearances > 0
                      ? baseline.data.perGame
                      : null
                  }
                />
              ))}

            {tab === 'match' && (
              <MatchLedgerCard
                sheet={sheet.data}
                teamId={p.team_id}
                isForward={FORWARD_POSITIONS.includes(p.primary_position)}
              />
            )}

          </>
        )}
      </FadingScrollView>
    </SafeAreaView>
  );
}

// ─── Profile pane: match radar + match matrices ─────────────────────────────

function MatchRadarCard({
  subject,
  subjectSheet,
  peers,
  style,
}: {
  subject: { id: string; team_id: string; name: string };
  subjectSheet: PlayerMatchStats;
  peers: readonly TonightPeer[];
  style?: object;
}) {
  const [infoOpen, setInfoOpen] = useState(false);

  // Six lobes = the six departments; each lobe is his STANDING among
  // tonight's positional peers on that department's metrics (share of
  // the pool at or below him, lower-is-better rows pre-flipped).
  const axes = useMemo(() => {
    if (peers.length === 0) return [];
    return RADAR_DIMENSIONS.map((dim) => {
      const displays = dim.metrics.map((m) => {
        const mine = subjectSheet[m.field as PlayerStatField];
        const atOrBelow = peers.filter(
          (peer) => peer.sheet[m.field as PlayerStatField] <= mine,
        ).length;
        const pct = (atOrBelow / peers.length) * 100;
        return m.inverted ? 100 - pct : pct;
      });
      const mean = displays.reduce((a, b) => a + b, 0) / displays.length;
      return {
        key: dim.key,
        label: dim.label,
        value: mean / 100,
        raw: `${Math.round(mean)} standing`,
      };
    });
  }, [subjectSheet, peers]);

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Profile"
          onClose={() => setInfoOpen(false)}
          purpose={
            <>
              His shape TONIGHT — six departments, each lobe his standing
              among the players in his position group who took the field in
              this match, both squads. A full lobe led tonight&apos;s peers in
              that department; a shallow one trailed them. {PEER_FRAME}
            </>
          }
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
          <View style={styles.radarHeaderRow}>
            <View style={styles.radarTitleCentreFill} pointerEvents="none">
              <Text style={styles.sectionLabel}>Profile</Text>
            </View>
            <Pressable
              onPress={() => setInfoOpen(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Explain the match profile radar">
              <FlipTrigger />
            </Pressable>
          </View>
          {peers.length < 4 ? (
            <Text style={styles.empty}>Not enough positional peers in this match.</Text>
          ) : (
            <>
              <RadarChart
                axes={axes}
                strokeColor="transparent"
                fillColor={teamDotColor(subject.team_id)}
                dotColor={teamDotColor(subject.team_id)}
                flatFillOpacity={0.25}
              />
              <View style={styles.radarLegend}>
                <LegendChip
                  label={surname(subject.name)}
                  color={teamDotColor(subject.team_id) ?? Colors.light.textSecondary}
                />
              </View>
            </>
          )}
        </View>
      }
    />
  );
}

/** The player matrices, tonight-scoped: same titles, quadrants and
 *  captions as the Teams profile, but every dot is a positional peer
 *  who played THIS match and every value is his match count. */
function buildMatrixPages(
  p: { id: string; team_id: string; primary_position: import('@rugby-app/shared').Position },
  peers: readonly TonightPeer[],
  pageStyle: object,
) {
  const isForward = FORWARD_POSITIONS.includes(p.primary_position);
  const shared = [
    {
      key: 'engine',
      title: 'Engine',
      purpose: `The two-way work-rate map of this match: carries against tackles, him in his squad colour. Top-right did both jobs tonight; bottom-left was along for the ride. Dot size is minutes played. ${PEER_FRAME}`,
      xAxis: { field: 'carries' } as AxisSpec,
      yAxis: { field: 'tackles_made' } as AxisSpec,
      quadrants: { tr: 'WORKHORSES', tl: 'STOPPERS', br: 'CARRIERS', bl: 'PASSENGERS' },
      xCaption: 'CARRIES →',
      yCaption: 'TACKLES →',
    },
    {
      key: 'hands',
      title: 'Hands',
      purpose: `Ball security under tonight's volume: touches (carries plus passes) against handling errors — fewer errors plots higher. Dot size is minutes played. ${PEER_FRAME}`,
      xAxis: { sum: ['carries', 'passes'] } as AxisSpec,
      yAxis: { field: 'handling_errors' } as AxisSpec,
      yLowerIsBetter: true,
      quadrants: { tr: 'SAFE HANDS', tl: 'TIDY', br: 'BUTTERFINGERS', bl: 'LIABILITIES' },
      xCaption: 'TOUCHES →',
      yCaption: 'FEWER ERRORS →',
    },
  ];
  const role = isForward
    ? [
        {
          key: 'carries',
          title: 'Carries',
          purpose: `Volume against yield in this match: carries against the metres each one bought. Dot size is minutes played. ${PEER_FRAME}`,
          xAxis: { field: 'carries' } as AxisSpec,
          yAxis: { ratio: ['metres_carried', 'carries'] } as AxisSpec,
          quadrants: { tr: 'WRECKING BALLS', tl: 'EXPLOSIVE', br: 'HARD YARDS', bl: 'ON THE FRINGES' },
          xCaption: 'CARRIES →',
          yCaption: 'METRES PER CARRY →',
        },
        {
          key: 'jackal',
          title: 'Jackal',
          purpose: `The breakdown trade in this match: ruck arrivals against turnovers won. Dot size is minutes played. ${PEER_FRAME}`,
          xAxis: { field: 'rucks_hit' } as AxisSpec,
          yAxis: { field: 'turnovers_won' } as AxisSpec,
          quadrants: { tr: 'PICKPOCKETS', tl: 'POACHERS', br: 'BODY WORK', bl: 'BYSTANDERS' },
          xCaption: 'RUCK ARRIVALS →',
          yCaption: 'TURNOVERS WON →',
        },
      ]
    : [
        {
          key: 'strike',
          title: 'Strike',
          purpose: `The line-breaking threat in this match: defenders beaten against clean breaks. Dot size is minutes played. ${PEER_FRAME}`,
          xAxis: { field: 'defenders_beaten' } as AxisSpec,
          yAxis: { field: 'clean_breaks' } as AxisSpec,
          quadrants: { tr: 'LINE BREAKERS', tl: 'GHOSTS', br: 'HARD TO HANDLE', bl: 'CONTAINED' },
          xCaption: 'DEFENDERS BEATEN →',
          yCaption: 'CLEAN BREAKS →',
        },
        {
          key: 'playmaker',
          title: 'Playmaker',
          purpose: `Distribution against creation in this match: passes against try assists. Dot size is minutes played. ${PEER_FRAME}`,
          xAxis: { field: 'passes' } as AxisSpec,
          yAxis: { field: 'try_assists' } as AxisSpec,
          quadrants: { tr: 'PUPPET MASTERS', tl: 'KILLER PASS', br: 'LINK MEN', bl: 'BIT PART' },
          xCaption: 'PASSES →',
          yCaption: 'TRY ASSISTS →',
        },
        {
          key: 'boot',
          title: 'Boot',
          purpose: `Kicking volume against yield in this match: kicks from hand against the metres each one bought. Dot size is minutes played. ${PEER_FRAME}`,
          xAxis: { field: 'kicks_from_hand' } as AxisSpec,
          yAxis: { ratio: ['kick_metres', 'kicks_from_hand'] } as AxisSpec,
          quadrants: { tr: 'LAUNCHERS', tl: 'LONG RANGE', br: 'SHORT GAME', bl: 'BALL IN HAND' },
          xCaption: 'KICKS FROM HAND →',
          yCaption: 'METRES PER KICK →',
        },
      ];
  return [...shared, ...role].map((cfg) => (
    <MatchMatrixCard key={cfg.key} cfg={cfg} subjectId={p.id} teamId={p.team_id} peers={peers} style={pageStyle} />
  ));
}

function MatchMatrixCard({
  cfg,
  subjectId,
  teamId,
  peers,
  style,
}: {
  cfg: {
    title: string;
    purpose: string;
    xAxis: AxisSpec;
    yAxis: AxisSpec;
    yLowerIsBetter?: boolean;
    quadrants: { tr: string; tl: string; br: string; bl: string };
    xCaption: string;
    yCaption: string;
  };
  subjectId: string;
  teamId: string;
  peers: readonly TonightPeer[];
  style?: object;
}) {
  const [infoOpen, setInfoOpen] = useState(false);

  const points: MatrixPoint[] = useMemo(() => {
    if (peers.length === 0) return [];
    const minutes = peers.map((peer) => peer.sheet.minutes_played);
    const minM = Math.min(...minutes);
    const maxM = Math.max(...minutes);
    const span = Math.max(maxM - minM, 1);
    return peers.map((peer) => ({
      id: peer.playerId,
      code: peer.playerId === subjectId ? surname(peer.name).toUpperCase() : '',
      x: axisValue(peer.sheet, cfg.xAxis),
      // Higher-is-better y feeds NEGATED (smaller plots higher);
      // giveaway metrics feed RAW so fewer plots higher.
      y: cfg.yLowerIsBetter
        ? axisValue(peer.sheet, cfg.yAxis)
        : -axisValue(peer.sheet, cfg.yAxis),
      weight: (peer.sheet.minutes_played - minM) / span,
    }));
  }, [peers, subjectId, cfg]);

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title={cfg.title}
          onClose={() => setInfoOpen(false)}
          purpose={<>{cfg.purpose}</>}
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
          <View style={styles.radarHeaderRow}>
            <View style={styles.radarTitleCentreFill} pointerEvents="none">
              <Text style={styles.sectionLabel}>{cfg.title}</Text>
            </View>
            <Pressable
              onPress={() => setInfoOpen(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Explain the ${cfg.title} matrix`}>
              <FlipTrigger />
            </Pressable>
          </View>
          {points.length < 4 ? (
            <Text style={styles.empty}>Not enough positional peers in this match.</Text>
          ) : (
            <MatrixChart
              points={points}
              subjectId={subjectId}
              subjectColor={teamDotColor(teamId)}
              quadrants={cfg.quadrants}
              xCaption={cfg.xCaption}
              yCaption={cfg.yCaption}
              sizeLabel="MINUTES"
            />
          )}
        </View>
      }
    />
  );
}

// ─── Stats pane: tonight vs the norm he carried in ──────────────────────────

function NormCard({
  section,
  sheet,
  norm,
}: {
  section: (typeof SHEET_SECTIONS)[number];
  sheet: PlayerMatchStats;
  norm: Record<PlayerStatField, number> | null;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const rows = section.metrics.filter((m) => {
    const value = sheet[m.field];
    const n = norm ? norm[m.field] : null;
    return !(m.hideWhenZero && value === 0 && (n === null || n < 0.05));
  });
  return (
    <FadeCard
      style={styles.stackCard}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title={section.label}
          onClose={() => setInfoOpen(false)}
          purpose={<>{section.purpose}</>}
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionLabel}>{section.label}</Text>
            <View style={styles.headerRightGroup}>
              <Text style={styles.normTag}>NORM</Text>
              <Pressable
                onPress={() => setInfoOpen(true)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Explain the ${section.label} match rows`}>
                <FlipTrigger />
              </Pressable>
            </View>
          </View>
          <View style={styles.normList}>
            {rows.map((m) => (
              <NormRow
                key={m.field}
                label={m.label}
                mine={sheet[m.field]}
                avg={norm ? norm[m.field] : null}
                inverted={m.inverted}
              />
            ))}
          </View>
        </View>
      }
    />
  );
}

/** Tonight vs his own norm — the team-Stats row grammar verbatim:
 *  value tile, centre-out diverging bars, norm tile. */
function NormRow({
  label,
  mine,
  avg,
  inverted,
}: {
  label: string;
  mine: number;
  avg: number | null;
  inverted?: boolean;
}) {
  const ink = useChartInk();
  const MAX_FILL = 0.85;
  const norm = avg ?? 0;
  const maxValue = Math.max(mine, norm, 0.001);
  const mineSeg = Math.max(0.001, MAX_FILL * (mine / maxValue));
  const mineSpacer = Math.max(0.001, 1 - MAX_FILL * (mine / maxValue));
  const avgSeg = Math.max(0.001, MAX_FILL * (norm / maxValue));
  const avgSpacer = Math.max(0.001, 1 - MAX_FILL * (norm / maxValue));
  const variance = mine - norm;
  const favourable = inverted ? variance < 0 : variance > 0;
  const isTie = Math.abs(variance) < 0.05;
  const mineColor = isTie ? TIE_COLOR : favourable ? GOOD_COLOR : BAD_COLOR;
  const avgColor = isTie ? TIE_COLOR : favourable ? BAD_COLOR : GOOD_COLOR;

  return (
    <View style={styles.normRowBlock}>
      <View style={styles.normLabelRow}>
        <Text style={styles.normLabel}>{label}</Text>
      </View>
      <View style={styles.normBarRow}>
        <View style={[styles.valueBox, !isTie && favourable ? styles.valueBoxWin : null]}>
          <Text style={[styles.valueBoxText, !isTie && favourable ? styles.valueBoxTextWin : null]}>
            <CountUpValue value={formatValue(mine)} ink={ink} />
          </Text>
        </View>
        <View style={styles.normBarTrack}>
          <View style={styles.normBarHalfLeft}>
            <Animated.View
              style={[
                styles.normBarSeg,
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
          <View style={styles.normBarCentreGap} />
          <View style={styles.normBarHalfRight}>
            <Animated.View
              style={[
                styles.normBarSeg,
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
            {avg === null ? '—' : <CountUpValue value={formatValue(norm)} ink={ink} />}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Match pane: the counting ledger ─────────────────────────────────────────

function MatchLedgerCard({
  sheet,
  teamId,
  isForward,
}: {
  sheet: PlayerMatchStats;
  teamId: string;
  isForward: boolean;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const ink = useChartInk();

  // 3×4 grid, role-flavoured like the Season ledger: participation
  // row, then the milestones in his role's currency.
  const tiles = isForward
    ? [
        { label: 'MINUTES', value: sheet.minutes_played },
        { label: 'POINTS', value: sheet.points },
        { label: 'TRIES', value: sheet.tries },
        { label: 'CARRIES', value: sheet.carries },
        { label: 'METRES', value: sheet.metres_carried },
        { label: 'TACKLES', value: sheet.tackles_made },
        { label: 'TURNOVERS WON', value: sheet.turnovers_won },
        { label: 'RUCKS HIT', value: sheet.rucks_hit },
        { label: 'LINEOUT TAKES', value: sheet.lineout_takes },
        { label: 'OFFLOADS', value: sheet.offloads },
        { label: 'DEF. BEATEN', value: sheet.defenders_beaten },
        { label: 'PENALTIES', value: sheet.penalties_conceded },
      ]
    : [
        { label: 'MINUTES', value: sheet.minutes_played },
        { label: 'POINTS', value: sheet.points },
        { label: 'TRIES', value: sheet.tries },
        { label: 'ASSISTS', value: sheet.try_assists },
        { label: 'METRES', value: sheet.metres_carried },
        { label: 'BREAKS', value: sheet.clean_breaks },
        { label: 'DEF. BEATEN', value: sheet.defenders_beaten },
        { label: 'KICK METRES', value: sheet.kick_metres },
        { label: 'PASSES', value: sheet.passes },
        { label: 'OFFLOADS', value: sheet.offloads },
        { label: 'TACKLES', value: sheet.tackles_made },
        { label: 'PENALTIES', value: sheet.penalties_conceded },
      ];

  return (
    <FadeCard
      style={styles.stackCard}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Match"
          onClose={() => setInfoOpen(false)}
          purpose={
            <>
              His match in counting numbers — minutes and the milestones as
              they stand tonight, in his role&apos;s currency. How they rank
              lives on Profile; how they compare to his norm lives on Stats.
            </>
          }
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionLabel}>Match</Text>
            <Pressable
              onPress={() => setInfoOpen(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Explain the match ledger">
              <FlipTrigger />
            </Pressable>
          </View>
          <View style={styles.ledgerGrid}>
            {tiles.map((tile) => (
              <View key={tile.label} style={styles.ledgerTile}>
                <Text style={[styles.ledgerValue, { color: teamDotColor(teamId) ?? Colors.light.text }]}>
                  <CountUpValue value={String(Math.round(tile.value))} ink={ink} />
                </Text>
                <Text style={styles.ledgerLabel} numberOfLines={1}>
                  {tile.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      }
    />
  );
}

function formatValue(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function ageFrom(dobIso: string): number {
  const dob = new Date(dobIso);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

function givenNames(full: string): string {
  const i = full.lastIndexOf(' ');
  return i === -1 ? full : full.slice(0, i);
}

function surname(full: string): string {
  const i = full.lastIndexOf(' ');
  return i === -1 ? full : full.slice(i + 1);
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  // Hero styles mirror the Teams player card VERBATIM (owner call
  // 2026-07-10: the two heroes must be identical).
  identityHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    minHeight: DRILL_HERO_MIN_HEIGHT,
    justifyContent: 'center',
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
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
  heroIdentityGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  heroNameStack: { gap: 0 },
  heroName: {
    // Squad-row nameplate register (owner call 2026-07-10) — the same
    // face and size as the player rows in the team squad table.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    color: Colors.light.text,
    textTransform: 'uppercase',
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  heroScoreText: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.xl,
    color: Colors.light.textSecondary,
  },
  heroScoreUnit: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 8,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  // Date-line slot of the match hero — the position rides above the
  // anchor row, centred.
  heroPositionLine: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  heroMetaText: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  heroStrapRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: PAGE_BOTTOM_INSET,
    gap: Spacing.three,
  },
  carouselBleed: { marginHorizontal: -Spacing.four },
  pageCard: { flex: 1 },
  stackCard: { minHeight: PAGE_CARD_MIN_HEIGHT },
  cardFill: { flexGrow: 1 },
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    // CardHeaderActions hard rule: fixed 16pt gap before the trigger.
    gap: Spacing.three,
  },
  normTag: {
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
  radarLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  sectionLabel: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  // Norm rows — team-Stats grammar.
  normList: {
    flexGrow: 1,
    justifyContent: 'space-evenly',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  normRowBlock: { gap: 4 },
  normLabelRow: { alignItems: 'center' },
  normLabel: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  normBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  normBarTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  normBarHalfLeft: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    height: 4,
  },
  normBarHalfRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 4,
  },
  normBarSeg: {
    height: 4,
    borderRadius: 2,
  },
  normBarCentreGap: { width: 4 },
  valueBox: {
    width: 44,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueBoxWin: { backgroundColor: Colors.light.textSecondary },
  valueBoxTextWin: { color: Colors.light.textInverse },
  valueBoxText: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.textSecondary,
  },
  // Match ledger — Season-grid grammar.
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
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: 28,
    color: Colors.light.text,
  },
  ledgerLabel: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.xs,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },
});
