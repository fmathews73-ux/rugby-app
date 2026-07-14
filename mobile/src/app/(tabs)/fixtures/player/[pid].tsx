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
import { FlagSize, PAGE_BOTTOM_INSET, PAGE_CARD_MIN_HEIGHT, Colors, DRILL_HERO_MIN_HEIGHT, ScoreBug, Spacing, StatusColor, TextSize, TextTracking, TextWeight, ScoreBoxSize } from '@/constants/theme';
import { usePlayerAggregate, type PlayerStatField } from '@/hooks/use-player-aggregate';
import { useFixturePlayerStats, usePlayerMatchStats } from '@/hooks/use-player-match-stats';
import {
  BACK_CATEGORY_ORDER,
  FORWARD_CATEGORY_ORDER,
  FORWARD_POSITIONS,
  POSITION_GROUP_MEMBERS,
  POSITION_LABELS,
  RADAR_DIMENSIONS,
  SCOUT_CATEGORIES,
  positionGroupOf,
  type ScoutMetric,
} from '@/lib/player-roles';
import { teamDotColor } from '@/lib/team-colors';
import { INSUFFICIENT_INSIGHT, fitNarrative, insufficientData } from '@/lib/fit-narrative';

const BASELINE_LOOKBACK = 10;
const GOOD_COLOR = '#5CB04E';
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

const NORM_DECODE =
  'The right tile is the per-game norm he carried into this match — his previous ten appearances, frozen at kickoff. Tonight beats the norm in green, falls short in red, grey when level; on giveaway rows the lower number wins the green.';

// The stats deck is the SAME four cards as the team-squad player page
// (owner call 2026-07-14): SCOUT_CATEGORIES metrics verbatim — same
// cards, same rows, same order, no rows hidden — only the comparison
// frame changes (tonight vs his norm instead of per-game vs the
// positional average). The old fixture-only grouping (Attack/Kicking/
// Discipline) and its hideWhenZero rows are retired.
const SHEET_PURPOSES: Record<string, string> = {
  scoring: `His scoring tonight — tries, the passes that made them, and the goal kicks landed. ${NORM_DECODE}`,
  attack: `His with-ball engine tonight — volume, metres and what the carries broke. ${NORM_DECODE}`,
  contest: `His contact contest tonight — tackle volume and the ones that slipped, plus the ball won at ruck and lineout. ${NORM_DECODE}`,
  management: `The boot and the whistle tonight — kicks from hand and the metres they bought, against the penalties and cards given away. ${NORM_DECODE}`,
};

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
              // Role-led deck order, same as the squad player page:
              // forwards read contact-first, backs strike-first.
              (FORWARD_POSITIONS.includes(p.primary_position)
                ? FORWARD_CATEGORY_ORDER
                : BACK_CATEGORY_ORDER
              ).map((key) => {
                const cat = SCOUT_CATEGORIES[key]!;
                return (
                  <NormCard
                    key={key}
                    section={{
                      label: cat.title,
                      purpose: SHEET_PURPOSES[key]!,
                      metrics: cat.metrics,
                    }}
                    sheet={sheet.data!}
                    norm={
                      baseline.data && baseline.data.appearances > 0
                        ? baseline.data.perGame
                        : null
                    }
                  />
                );
              })}

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

  const read = useMemo(() => {
    if (axes.length === 0) return INSUFFICIENT_INSIGHT;
    const standings = axes.map((a) => Math.round(a.value * 100));
    if (insufficientData(standings)) return INSUFFICIENT_INSIGHT;
    const best = axes.reduce((a, b) => (b.value > a.value ? b : a));
    const worst = axes.reduce((a, b) => (b.value < a.value ? b : a));
    const parts = [
      `His strongest department tonight was ${best.label.toLowerCase()} — a ${Math.round(best.value * 100)} standing among the positional peers on this pitch.`,
      `${worst.label} trailed the group at ${Math.round(worst.value * 100)}.`,
    ];
    const led = axes.filter((a) => Math.round(a.value * 100) >= 75).length;
    if (led > 1) {
      parts.push(`He sat in the group's top quarter in ${led} of the six departments.`);
    }
    return fitNarrative(parts) ?? INSUFFICIENT_INSIGHT;
  }, [axes]);

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

  const read = useMemo(() => {
    if (points.length < 4) return INSUFFICIENT_INSIGHT;
    const subjectPt = points.find((pt) => pt.code !== '');
    if (!subjectPt) return INSUFFICIENT_INSIGHT;
    const xs = points.map((pt) => pt.x);
    const ys = points.map((pt) => pt.y);
    if (insufficientData(xs) && insufficientData(ys)) return INSUFFICIENT_INSIGHT;
    const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const right = subjectPt.x >= midX;
    // y feeds negated for higher-is-better axes — smaller plots higher.
    const upper = subjectPt.y <= midY;
    const quad = upper
      ? right
        ? cfg.quadrants.tr
        : cfg.quadrants.tl
      : right
        ? cfg.quadrants.br
        : cfg.quadrants.bl;
    return (
      fitNarrative([
        `Tonight he plots in ${quad} — the ${right ? 'high' : 'low'} end of the group on ${cfg.xCaption.toLowerCase()}, ${upper ? 'strong' : 'soft'} on ${cfg.yCaption.toLowerCase()}.`,
        `That is against ${points.length - 1} positional peers who took the field in this match.`,
      ]) ?? INSUFFICIENT_INSIGHT
    );
  }, [points, cfg]);

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title={cfg.title}
          onClose={() => setInfoOpen(false)}
          read={read}
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

/** Tonight-vs-norm read: biggest beat, biggest shortfall, and the
 *  card's overall score — verdicts on the displayed whole numbers. */
function buildNormRead(
  metrics: readonly ScoutMetric[],
  sheet: PlayerMatchStats,
  norm: Record<PlayerStatField, number> | null,
): string {
  const rows = metrics.map((m) => ({
    label: m.label,
    mine: Math.round(sheet[m.field]),
    avg: norm ? Math.round(Math.round(norm[m.field] * 10) / 10) : null,
    inverted: m.inverted,
  }));
  if (
    insufficientData(rows.map((r) => r.mine)) &&
    (norm === null || insufficientData(rows.map((r) => r.avg)))
  ) {
    return INSUFFICIENT_INSIGHT;
  }
  if (norm === null) {
    return 'No previous appearances tracked — tonight sets the norm these rows will read against.';
  }
  const beats = rows.filter(
    (r) => r.avg !== null && (r.inverted ? r.mine < r.avg : r.mine > r.avg),
  );
  const shorts = rows.filter(
    (r) => r.avg !== null && (r.inverted ? r.mine > r.avg : r.mine < r.avg),
  );
  const biggest = (list: typeof rows) =>
    list.reduce((a, b) =>
      Math.abs(b.mine - (b.avg ?? 0)) > Math.abs(a.mine - (a.avg ?? 0)) ? b : a,
    );
  const parts: string[] = [];
  if (beats.length > 0) {
    const b = biggest(beats);
    parts.push(
      `His biggest beat of the norm came on ${b.label.toLowerCase()} — ${b.mine} against the ${b.avg} he carried in.`,
    );
  }
  if (shorts.length > 0) {
    const s = biggest(shorts);
    parts.push(`${s.label} fell short: ${s.mine} against a norm of ${s.avg}.`);
  }
  parts.push(
    beats.length === 0 && shorts.length === 0
      ? 'Level with his norm across the card — a carbon-copy shift.'
      : `Across the card he beat his norm on ${beats.length} of the ${rows.length} rows.`,
  );
  return fitNarrative(parts) ?? INSUFFICIENT_INSIGHT;
}

function NormCard({
  section,
  sheet,
  norm,
}: {
  section: { label: string; purpose: string; metrics: readonly ScoutMetric[] };
  sheet: PlayerMatchStats;
  norm: Record<PlayerStatField, number> | null;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const rows = section.metrics;
  return (
    <FadeCard
      style={styles.stackCard}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title={section.label}
          onClose={() => setInfoOpen(false)}
          read={buildNormRead(section.metrics, sheet, norm)}
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
  // Verdict on the DISPLAYED whole numbers (owner rule 2026-07-14,
  // mirrors formatValue's rounding): even-to-the-nearest-whole = tie,
  // both boxes quiet.
  const mineR = Math.round(Math.round(mine * 10) / 10);
  const normR = Math.round(Math.round(norm * 10) / 10);
  const isTie = mineR === normR;
  const favourable = inverted ? mineR < normR : mineR > normR;
  const mineColor = isTie ? TIE_COLOR : favourable ? GOOD_COLOR : BAD_COLOR;
  const avgColor = isTie ? TIE_COLOR : favourable ? BAD_COLOR : GOOD_COLOR;

  return (
    <View style={styles.normRowBlock}>
      <View style={styles.normLabelRow}>
        <Text style={styles.normLabel}>{label}</Text>
      </View>
      <View style={styles.normBarRow}>
        <View style={[styles.valueBox, ScoreBug.cutLeft, !isTie && favourable ? styles.valueBoxWin : null]}>
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
        <View
          style={[
            styles.valueBox,
            ScoreBug.cutRight,
            avg !== null && !isTie && !favourable ? styles.valueBoxWin : null,
          ]}>
          <Text
            style={[
              styles.valueBoxText,
              avg !== null && !isTie && !favourable ? styles.valueBoxTextWin : null,
            ]}>
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
          read={buildLedgerRead(tiles)}
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

/** Ledger read: the shift length and the two loudest counting
 *  numbers — pure milestones, no comparison (that lives on Stats). */
function buildLedgerRead(tiles: readonly { label: string; value: number }[]): string {
  const rounded = tiles.map((t) => ({ label: t.label, value: Math.round(t.value) }));
  if (insufficientData(rounded.map((t) => t.value))) return INSUFFICIENT_INSIGHT;
  const minutes = rounded.find((t) => t.label === 'MINUTES');
  const rest = rounded
    .filter((t) => t.label !== 'MINUTES' && t.label !== 'PENALTIES' && t.value > 0)
    .sort((a, b) => b.value - a.value);
  const parts: string[] = [];
  if (minutes) {
    parts.push(
      minutes.value >= 80
        ? 'A full eighty-minute shift.'
        : `${minutes.value} minutes on the pitch.`,
    );
  }
  if (rest.length > 0) {
    const [first, second] = rest;
    parts.push(
      second
        ? `The ledger's loudest lines: ${first!.value} ${first!.label.toLowerCase()} and ${second.value} ${second.label.toLowerCase()}.`
        : `The ledger's loudest line: ${first!.value} ${first!.label.toLowerCase()}.`,
    );
  }
  const pens = rounded.find((t) => t.label === 'PENALTIES');
  if (pens) {
    parts.push(
      pens.value === 0
        ? 'He kept the whistle silent — no penalties conceded.'
        : `${pens.value} penalt${pens.value === 1 ? 'y' : 'ies'} conceded against his name.`,
    );
  }
  return fitNarrative(parts) ?? INSUFFICIENT_INSIGHT;
}

function formatValue(v: number): string {
  const r = Math.round(v * 10) / 10;
  return String(Math.round(r));
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
    borderBottomColor: '#E3E8EF',
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
    backgroundColor: '#E9EDF2',
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
    borderColor: '#E3E8EF',
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
    fontFamily: 'WorkSans_500Medium',
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
    backgroundColor: '#EFF2F6',
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
    backgroundColor: '#E9EDF2',
    alignItems: 'center',
    justifyContent: 'center',
    ...ScoreBug.skew,
  },
  valueBoxWin: { backgroundColor: Colors.light.textSecondary },
  valueBoxTextWin: { color: Colors.light.textInverse },
  valueBoxText: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.textSecondary,
    ...ScoreBug.counterSkew,
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
    fontFamily: 'WorkSans_500Medium',
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
