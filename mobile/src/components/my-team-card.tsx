import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueries } from '@tanstack/react-query';

import type { Fixture, Result } from '@rugby-app/shared';

import { fetchJson } from '@/api/client';
import { useCompetitions, useTeam, useTeams } from '@/api/hooks';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { TeamPickerModal } from '@/components/team-picker-modal';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { Colors, FlagSize, ScoreBoxSize, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useMyTeamId } from '@/hooks/use-my-team-id';

const FORM_LOOKBACK = 5; // Number of recent completed fixtures to show in Form row.

const HORIZONTAL_MARGIN = 40; // Matches FixtureCarousel + HomeRankingsCarousel.

/** Convert an ISO datetime string ("2026-07-04T20:10:00Z") to dd-mm-yyyy. */
function formatDateDMY(isoDateTime: string): string {
  const [yyyy, mm, dd] = isoDateTime.slice(0, 10).split('-');
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Home-page card for the user's favourite team. Two states:
 *   - Empty: header + "Select your favorite team" + filter icon to open picker
 *   - Populated: flag + name, Next Match, Last Match, and Form (last N results)
 * Selection persists across launches via `useMyTeamId`.
 */
export function MyTeamCard() {
  const [myTeamId, setMyTeamId] = useMyTeamId();
  const [pickerOpen, setPickerOpen] = useState(false);
  const teams = useTeams();

  const selectedTeam = useMemo(
    () => (myTeamId ? teams.data?.find((t) => t.id === myTeamId) : undefined),
    [myTeamId, teams.data],
  );

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>
            My Team{selectedTeam ? `: ${selectedTeam.name}` : ''}
          </Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            hitSlop={12}
            style={({ pressed }) => [styles.filterButton, pressed && styles.filterButtonPressed]}>
            <Ionicons name="options-outline" size={20} color={Colors.light.text} />
          </Pressable>
        </View>

        {myTeamId ? <PopulatedBody teamId={myTeamId} /> : <EmptyBody />}
      </View>

      <TeamPickerModal
        visible={pickerOpen}
        teams={teams.data ?? []}
        currentTeamId={myTeamId}
        onCancel={() => setPickerOpen(false)}
        onConfirm={(id) => {
          setMyTeamId(id);
          setPickerOpen(false);
        }}
        onClear={() => {
          setMyTeamId(null);
          setPickerOpen(false);
        }}
      />
    </View>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyBody() {
  return (
    <View style={styles.emptyBody}>
      <Text style={styles.emptyText}>Select your favorite team</Text>
    </View>
  );
}

// ─── Populated state ─────────────────────────────────────────────────────────

function PopulatedBody({ teamId }: { teamId: string }) {
  const router = useRouter();
  const team = useTeam(teamId);
  const allTeams = useTeams();
  const competitions = useCompetitions();
  const [formInfoOpen, setFormInfoOpen] = useState(false);

  const teamById = useMemo(() => {
    const m = new Map<string, { flag_code: string; short_name: string }>();
    for (const t of allTeams.data ?? []) {
      m.set(t.id, { flag_code: t.flag_code, short_name: t.short_name });
    }
    return m;
  }, [allTeams.data]);

  const compById = useMemo(() => {
    const m = new Map<string, { short_name: string }>();
    for (const c of competitions.data ?? []) m.set(c.id, { short_name: c.short_name });
    return m;
  }, [competitions.data]);

  const myTeamInfo = team.data
    ? { flag_code: team.data.flag_code, short_name: team.data.short_name }
    : null;

  const nowIso = new Date().toISOString();

  const nextMatch = useMemo(() => {
    if (!team.data) return null;
    const upcoming = team.data.fixtures
      .filter((f) => f.status === 'scheduled' && f.kickoff_utc >= nowIso)
      .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));
    return upcoming[0] ?? null;
  }, [team.data, nowIso]);

  const lastMatch = useMemo(() => {
    if (!team.data) return null;
    const completed = team.data.fixtures
      .filter((f) => f.status === 'completed')
      .sort((a, b) => b.kickoff_utc.localeCompare(a.kickoff_utc));
    return completed[0] ?? null;
  }, [team.data]);

  const formFixtures = useMemo(() => {
    if (!team.data) return [];
    return team.data.fixtures
      .filter((f) => f.status === 'completed')
      .sort((a, b) => b.kickoff_utc.localeCompare(a.kickoff_utc))
      .slice(0, FORM_LOOKBACK);
  }, [team.data]);

  // Batch-fetch results for the form fixtures + the last match (for its score).
  const resultTargets = useMemo(() => {
    const ids = new Set<string>(formFixtures.map((f) => f.id));
    if (lastMatch) ids.add(lastMatch.id);
    return [...ids];
  }, [formFixtures, lastMatch]);

  const resultQueries = useQueries({
    queries: resultTargets.map((id) => ({
      queryKey: ['fixtureResult', id],
      queryFn: () => fetchJson<Result>(`/fixtures/${id}/result`),
    })),
  });

  const resultByFixture = useMemo(() => {
    const m = new Map<string, Result>();
    for (const q of resultQueries) if (q.data) m.set(q.data.fixture_id, q.data);
    return m;
  }, [resultQueries]);

  // Point-differentials per form fixture, oldest → newest so the sparkline
  // reads left-to-right = older-to-newer. Fixtures whose result hasn't
  // loaded yet drop out silently rather than blanking the chart.
  const formPoints = useMemo((): FormPoint[] => {
    const out: FormPoint[] = [];
    for (const fx of [...formFixtures].reverse()) {
      const r = resultByFixture.get(fx.id);
      if (!r) continue;
      const isHome = fx.home_team_id === teamId;
      const myScore = isHome ? r.home_score : r.away_score;
      const oppScore = isHome ? r.away_score : r.home_score;
      const diff = myScore - oppScore;
      const outcome: FormOutcome = diff > 0 ? 'W' : diff < 0 ? 'L' : 'D';
      out.push({ diff, outcome });
    }
    return out;
  }, [formFixtures, resultByFixture, teamId]);

  // Recency-weighted momentum: most recent match counts 1.0×, next 0.8×,
  // and so on. Rounded to a whole number — the header meta is scannable,
  // not precise. Positive = trending up, negative = trending down.
  const formMomentum = useMemo((): number => {
    const weights = [1.0, 0.8, 0.6, 0.4, 0.2];
    let sum = 0;
    formFixtures.forEach((fx, i) => {
      const r = resultByFixture.get(fx.id);
      const w = weights[i];
      if (!r || w === undefined) return;
      const isHome = fx.home_team_id === teamId;
      const myScore = isHome ? r.home_score : r.away_score;
      const oppScore = isHome ? r.away_score : r.home_score;
      sum += (myScore - oppScore) * w;
    });
    return Math.round(sum);
  }, [formFixtures, resultByFixture, teamId]);

  // Current streak — walk most-recent-first, count consecutive same-outcome
  // matches, break on the first result whose outcome differs. `null` means
  // no completed fixtures have loaded yet.
  const formStreak = useMemo((): { letter: FormOutcome; count: number } | null => {
    let letter: FormOutcome | null = null;
    let count = 0;
    for (const fx of formFixtures) {
      const r = resultByFixture.get(fx.id);
      if (!r) break;
      const isHome = fx.home_team_id === teamId;
      const myScore = isHome ? r.home_score : r.away_score;
      const oppScore = isHome ? r.away_score : r.home_score;
      const l: FormOutcome = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'D';
      if (letter === null) {
        letter = l;
        count = 1;
      } else if (letter === l) {
        count += 1;
      } else {
        break;
      }
    }
    return letter ? { letter, count } : null;
  }, [formFixtures, resultByFixture, teamId]);

  if (!team.data) return null;

  return (
    <View style={styles.populatedBody}>
      {/* Team identity moved into the card header (My Team: {name}). Card
          jumps straight into Next / Last / Form. Each row is tappable and
          navigates to that fixture's detail page — chevron affords it. */}
      <NavSection
        label="Next Match"
        rightHeader={nextMatch ? formatDateDMY(nextMatch.kickoff_utc) : undefined}
        onPress={nextMatch ? () => router.push(`/fixture/${nextMatch.id}`) : undefined}>
        {nextMatch && myTeamInfo ? (
          <FixtureLine
            fixture={nextMatch}
            teamId={teamId}
            myTeam={myTeamInfo}
            oppTeam={teamById.get(
              nextMatch.home_team_id === teamId ? nextMatch.away_team_id : nextMatch.home_team_id,
            )}
            competition={compById.get(nextMatch.competition_id)}
          />
        ) : (
          <Text style={styles.mutedRow}>No upcoming fixtures.</Text>
        )}
      </NavSection>

      <NavSection
        label="Last Match"
        rightHeader={lastMatch ? formatDateDMY(lastMatch.kickoff_utc) : undefined}
        onPress={lastMatch ? () => router.push(`/fixture/${lastMatch.id}`) : undefined}>
        {lastMatch && myTeamInfo ? (
          <FixtureLine
            fixture={lastMatch}
            teamId={teamId}
            myTeam={myTeamInfo}
            oppTeam={teamById.get(
              lastMatch.home_team_id === teamId ? lastMatch.away_team_id : lastMatch.home_team_id,
            )}
            competition={compById.get(lastMatch.competition_id)}
            result={resultByFixture.get(lastMatch.id)}
          />
        ) : (
          <Text style={styles.mutedRow}>No completed fixtures.</Text>
        )}
      </NavSection>

      {/* Form section — sparkline of point-differentials over the last N
          completed fixtures (recency-weighted). Header carries the current
          streak + momentum score. Replaces the previous W/L/D badge row so
          "how is my team trending" reads at a glance instead of five
          discrete outcomes. */}
      <View style={styles.section}>
        <View style={styles.formHeaderRow}>
          <View style={styles.formHeaderTitleGroup}>
            <Text style={styles.sectionLabel}>Form (last {FORM_LOOKBACK})</Text>
            <Pressable
              onPress={() => setFormInfoOpen(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Explain form metrics">
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={Colors.light.textSecondary}
              />
            </Pressable>
          </View>
          {formStreak && formPoints.length > 0 ? (
            <View style={styles.formHeaderMeta}>
              <Text style={[styles.formStreakText, outcomeColorStyle(formStreak.letter)]}>
                {formStreak.count}
                {formStreak.letter}
              </Text>
              <Text style={styles.formMomentumSeparator}> · </Text>
              <Text style={[styles.formMomentumText, momentumColorStyle(formMomentum)]}>
                {formMomentum > 0 ? '+' : ''}
                {formMomentum}
                {formMomentum > 0 ? ' ▲' : formMomentum < 0 ? ' ▼' : ''}
              </Text>
            </View>
          ) : null}
        </View>
        {formPoints.length === 0 ? (
          <Text style={styles.mutedRow}>Not enough matches yet.</Text>
        ) : (
          <MomentumSparkline points={formPoints} />
        )}
      </View>

      <FormInfoModal
        visible={formInfoOpen}
        onClose={() => setFormInfoOpen(false)}
        lookback={FORM_LOOKBACK}
      />
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * Tappable Section — the section label sits top-left, an optional
 * `rightHeader` value (used for the fixture date) sits top-right, and a
 * right-chevron affordance sits bottom-right hinting "tap to open". When
 * `onPress` is undefined (e.g. no matching fixture), the chevron is hidden
 * and the row is inert.
 */
function NavSection({
  label,
  rightHeader,
  onPress,
  children,
}: {
  label: string;
  rightHeader?: string;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  const inert = !onPress;
  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      style={({ pressed }) => [styles.section, pressed && !inert && { opacity: 0.75 }]}>
      <View style={styles.navSectionHeader}>
        <Text style={styles.sectionLabel}>{label}</Text>
        {rightHeader ? <Text style={styles.navSectionDate}>{rightHeader}</Text> : null}
      </View>
      {children}
      {!inert ? (
        <View style={styles.navSectionFooter}>
          <Ionicons name="chevron-forward" size={18} color={Colors.light.textSecondary} />
        </View>
      ) : null}
    </Pressable>
  );
}

function FixtureLine({
  fixture,
  teamId,
  myTeam,
  oppTeam,
  competition,
  result,
}: {
  fixture: Fixture;
  teamId: string;
  myTeam: { flag_code: string; short_name: string };
  oppTeam: { flag_code: string; short_name: string } | undefined;
  competition: { short_name: string } | undefined;
  result?: Result;
}) {
  const isHome = fixture.home_team_id === teamId;
  const oppId = isHome ? fixture.away_team_id : fixture.home_team_id;
  const oppShort = oppTeam?.short_name ?? oppId.toUpperCase();

  // Middle slot: for completed fixtures, a `[score] FT [score]` cluster
  // where the winner's box is filled dark with white number (matches the
  // Fixtures list + World Rugby Rankings points treatment app-wide). For
  // scheduled fixtures, the kickoff time — matches the Fixtures list
  // upcoming-row convention.
  let middle: React.ReactNode;
  if (result) {
    const teamScore = isHome ? result.home_score : result.away_score;
    const oppScore = isHome ? result.away_score : result.home_score;
    const teamWins = teamScore > oppScore;
    const oppWins = oppScore > teamScore;
    middle = (
      <View style={styles.scoreCluster}>
        <View style={[styles.scoreBoxSmall, teamWins && styles.scoreBoxSmallWinner]}>
          <Text
            style={[
              styles.scoreBoxSmallText,
              teamWins && styles.scoreBoxSmallTextWinner,
            ]}>
            {teamScore}
          </Text>
        </View>
        <Text style={styles.ftLabel}>FT</Text>
        <View style={[styles.scoreBoxSmall, oppWins && styles.scoreBoxSmallWinner]}>
          <Text
            style={[
              styles.scoreBoxSmallText,
              oppWins && styles.scoreBoxSmallTextWinner,
            ]}>
            {oppScore}
          </Text>
        </View>
      </View>
    );
  } else {
    middle = <Text style={styles.fixtureTime}>{fixture.kickoff_utc.slice(11, 16)}</Text>;
  }

  return (
    <View style={styles.fixtureBlock}>
      <View style={styles.fixtureRow}>
        <View style={styles.fixtureSide}>
          <TeamFlagBall2D flagCode={myTeam.flag_code} size={FlagSize.row} />
          <Text style={styles.fixtureCode}>{myTeam.short_name}</Text>
        </View>
        {middle}
        <View style={[styles.fixtureSide, styles.fixtureSideRight]}>
          <Text style={styles.fixtureCode}>{oppShort}</Text>
          {oppTeam ? (
            <TeamFlagBall2D flagCode={oppTeam.flag_code} size={FlagSize.row} />
          ) : null}
        </View>
      </View>
      <Text style={styles.fixtureMeta} numberOfLines={1}>
        {competition?.short_name ?? fixture.competition_id} · {fixture.venue}
      </Text>
    </View>
  );
}

// ─── Form sparkline ──────────────────────────────────────────────────────────

type FormOutcome = 'W' | 'L' | 'D';
type FormPoint = { diff: number; outcome: FormOutcome };

// Standard rugby-analytics green for wins (matches the rankings up-movement
// glyph). Loss reuses StatusColor.live (red — used for LIVE + destructive
// affordances). Draw = textSecondary. No new tokens — one-line comment so
// the choice reads as intentional.
const WIN_COLOR = '#059669';
const LOSS_COLOR = StatusColor.live;
const DRAW_COLOR = Colors.light.textSecondary;

function outcomeColor(o: FormOutcome): string {
  return o === 'W' ? WIN_COLOR : o === 'L' ? LOSS_COLOR : DRAW_COLOR;
}
function outcomeColorStyle(o: FormOutcome) {
  return { color: outcomeColor(o) };
}
function momentumColorStyle(m: number) {
  return { color: m > 0 ? WIN_COLOR : m < 0 ? LOSS_COLOR : DRAW_COLOR };
}

/**
 * Mini line-chart of point-differentials across the last N completed
 * fixtures. Oldest → newest reads left-to-right. A faint dashed baseline
 * at diff = 0 anchors the trajectory; dots on each data point are colour-
 * coded by outcome so W/L/D remain scannable inside the line.
 *
 * Sizing: full-width SVG at a fixed viewBox — the chart scales to
 * whatever card width surrounds it, with drawing coords normalised so the
 * line and dots keep proportional geometry.
 */
function MomentumSparkline({ points }: { points: readonly FormPoint[] }) {
  const width = 240;
  const height = 44;
  const padX = 6;
  const padY = 8;

  // Symmetric y-domain around 0 with a sensible floor so a series of
  // small point-differentials still reads as movement (not a flat line).
  const maxAbs = Math.max(20, ...points.map((p) => Math.abs(p.diff)));

  // Map each data point into SVG coords.
  const svgPoints = points.map((p, i) => {
    const t = points.length === 1 ? 0.5 : i / (points.length - 1);
    const x = padX + t * (width - 2 * padX);
    const yNorm = (p.diff + maxAbs) / (2 * maxAbs); // 0..1, 0 = -maxAbs, 1 = +maxAbs
    const y = height - padY - yNorm * (height - 2 * padY);
    return { x, y, outcome: p.outcome };
  });

  const zeroY = height - padY - 0.5 * (height - 2 * padY);
  const polyline = svgPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View style={styles.sparklineWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {/* Baseline at diff = 0 — faint dashed hairline. */}
        <Line
          x1={padX}
          y1={zeroY}
          x2={width - padX}
          y2={zeroY}
          stroke="#E5E7EB"
          strokeWidth={0.8}
          strokeDasharray="3 3"
        />
        {/* Trajectory line — primary text token for maximum contrast. */}
        {svgPoints.length > 1 ? (
          <Polyline
            points={polyline}
            stroke={Colors.light.text}
            strokeWidth={1}
            fill="none"
          />
        ) : null}
        {/* Outcome dots on each data point. */}
        {svgPoints.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={2} fill={outcomeColor(p.outcome)} />
        ))}
      </Svg>
    </View>
  );
}

/**
 * Info modal explaining what the Form section is measuring — how to read the
 * sparkline, streak, and momentum. Opened via the info-icon next to the
 * section label. Rugby analytics is niche enough that the choices behind
 * "+18 ▲" are worth a one-tap explainer, especially before we introduce
 * comparable BI features on the BI tab.
 */
function FormInfoModal({
  visible,
  onClose,
  lookback,
}: {
  visible: boolean;
  onClose: () => void;
  lookback: number;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>How to read Form</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>

          <Text style={styles.modalBody}>
            The <Text style={styles.modalStrong}>Form</Text> chart tracks your
            team over its last {lookback} completed matches — read left (oldest)
            to right (most recent). Each dot is one match; its height is the
            points-differential (final margin) for that game.
          </Text>

          <View style={styles.modalDivider} />

          <View style={styles.modalLegendRow}>
            <View style={[styles.modalLegendDot, { backgroundColor: WIN_COLOR }]} />
            <Text style={styles.modalLegendText}>
              <Text style={styles.modalStrong}>Win</Text> — above the dashed
              zero line.
            </Text>
          </View>
          <View style={styles.modalLegendRow}>
            <View style={[styles.modalLegendDot, { backgroundColor: LOSS_COLOR }]} />
            <Text style={styles.modalLegendText}>
              <Text style={styles.modalStrong}>Loss</Text> — below the line.
            </Text>
          </View>
          <View style={styles.modalLegendRow}>
            <View style={[styles.modalLegendDot, { backgroundColor: DRAW_COLOR }]} />
            <Text style={styles.modalLegendText}>
              <Text style={styles.modalStrong}>Draw</Text> — on the line.
            </Text>
          </View>

          <View style={styles.modalDivider} />

          <Text style={styles.modalMetric}>
            <Text style={styles.modalStrong}>Streak (e.g. 2W)</Text> — the count
            of consecutive same-outcome matches, starting from the most recent.
          </Text>
          <Text style={styles.modalMetric}>
            <Text style={styles.modalStrong}>Momentum (e.g. +18 ▲)</Text> — a
            recency-weighted sum of point-differentials. The most recent match
            counts 1.0×, the next 0.8×, 0.6×, 0.4×, 0.2×. Positive & rising
            arrow means trending up; negative & falling arrow means trending
            down. Rugby internationals are sparse (~10–13 a year), so a
            {' '}{lookback}-match window balances recency with signal.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: HORIZONTAL_MARGIN,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.four,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    gap: Spacing.three,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: TextSize.lg,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
  },
  filterButton: {
    padding: 6,
    borderRadius: 8,
  },
  filterButtonPressed: { backgroundColor: '#F3F4F6' },

  emptyBody: {
    paddingVertical: Spacing.two,
  },
  emptyText: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },

  populatedBody: { gap: Spacing.three },

  section: {
    // Breathing room between the section label and its body content
    // (fixture flags for Next / Last, form badges for Form).
    gap: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F3F4F6',
  },
  sectionLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  navSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Explicit bottom space between the section label and the flag row —
    // safer than relying on the section's `gap` which behaves inconsistently
    // on Pressable in some RN versions.
    marginBottom: Spacing.two,
  },
  navSectionDate: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  navSectionFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 2,
    // 8pt breathing room below the chevron, mirroring the 8pt above the
    // flag row so the section reads with symmetric top-and-bottom padding.
    marginBottom: Spacing.two,
  },

  fixtureBlock: { gap: 4 },
  fixtureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  fixtureSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  // Right side reverses so the flag stays on the outer edge and the code sits
  // between the flag and the middle score/vs — mirrors the left side.
  fixtureSideRight: { justifyContent: 'flex-end' },
  fixtureCode: {
    fontSize: TextSize.md,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.text,
  },
  // ─── Score cluster (completed fixtures) ────────────────────────────────────
  // Same visual language as the Fixtures list winner box and the World Rugby
  // Rankings points tile — 30×24 rounded 4pt box, dark fill + white number
  // for the winner, light-grey fill + primary text for the loser, uppercase
  // "FT" label between.
  scoreCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreBoxSmall: {
    ...ScoreBoxSize.row,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBoxSmallWinner: { backgroundColor: Colors.light.text },
  scoreBoxSmallText: {
    fontSize: TextSize.md,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },
  scoreBoxSmallTextWinner: { color: Colors.light.textInverse },
  ftLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  // Kickoff time in the middle slot for scheduled fixtures. Same treatment
  // as the Fixtures list `timeMid` — tabular-nums, semibold, primary text —
  // so the whole app uses one convention for "upcoming fixture middle slot".
  fixtureTime: {
    fontSize: TextSize.md,
    fontWeight: TextWeight.semibold,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },
  fixtureMeta: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  mutedRow: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
  },

  // ─── Form (momentum sparkline) ────────────────────────────────────────────
  // Section-label row + right-aligned meta cluster carrying the current
  // streak and the recency-weighted momentum score.
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    // Info-icon sits ~4pt right of the section label. Small gap keeps the
    // label + affordance reading as a single title unit.
    gap: 4,
  },
  formHeaderMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  formStreakText: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    fontVariant: ['tabular-nums'],
  },
  formMomentumSeparator: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  formMomentumText: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  sparklineWrap: {
    // Small top padding so the sparkline's outcome dots don't kiss the
    // header row when the maxAbs y-domain saturates.
    paddingTop: Spacing.one,
  },

  // ─── Form-info modal ──────────────────────────────────────────────────────
  // Centred card over a dimmed backdrop. Outer Pressable = tap-outside-to-
  // close; inner Pressable stops the card itself from bubbling that gesture.
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
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
  modalStrong: {
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
  },
  modalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginVertical: Spacing.one,
  },
  modalLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 2,
  },
  modalLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  modalLegendText: {
    flex: 1,
    fontSize: TextSize.sm,
    color: Colors.light.text,
    lineHeight: 20,
  },
  modalMetric: {
    fontSize: TextSize.sm,
    color: Colors.light.text,
    lineHeight: 20,
    marginTop: Spacing.one,
  },
});
