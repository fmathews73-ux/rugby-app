import { StyleSheet, Text, View } from 'react-native';

import type { Fixture, Result, Team } from '@rugby-app/shared';

import { LivePulseDot } from '@/components/live-pulse-dot';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { Colors, DRILL_HERO_MIN_HEIGHT, FlagSize, ScoreBoxSize, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';

// ─── Matchup header ──────────────────────────────────────────────────────────

export function MatchupHeader({
  fixture,
  result,
  homeTeam,
  awayTeam,
  competitionName,
}: {
  fixture: Fixture;
  result: Result | null;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
  competitionName: string | undefined;
}) {
  const isCompleted = fixture.status === 'completed';
  const isLive = fixture.status === 'live' || fixture.status === 'half-time';

  // Match minute for the LIVE chip: elapsed real minutes since kickoff,
  // clamped 0–80.
  const liveMinute = (() => {
    const elapsed = Math.floor((Date.now() - new Date(fixture.kickoff_utc).getTime()) / 60000);
    return Math.min(80, Math.max(0, elapsed));
  })();

  return (
    <View style={styles.header}>
      {/* Date sits at the top as the temporal orient-me anchor.
          Competition + venue drop to below the flags/score row so the
          hero mirrors the Fixtures list layout: matchup first, then
          the "what tournament / where" meta line beneath. */}
      <Text style={styles.headerLine}>{formatKickoff(fixture.kickoff_utc)}</Text>
      {/* Row 1 — flags + score. Flags locked to `FlagSize.medium` (40 pt)
          to match the Home page fixture-carousel hero card — same "who's
          playing" visual weight across the two surfaces. The 3-letter
          team code sits inline next to each flag (home code on the RIGHT
          of the home flag, away code on the LEFT of the away flag) so the
          codes hug the score slot in the middle. */}
      <View style={styles.matchupTopRow}>
        <View style={styles.flagSlotHome}>
          {homeTeam ? (
            <TeamFlagShield flagCode={homeTeam.flag_code} width={FlagSize.medium} />
          ) : null}
          <Text style={styles.teamShort}>
            {homeTeam?.short_name ?? fixture.home_team_id.toUpperCase()}
          </Text>
        </View>
        <View style={styles.scoreSlot}>
          {(isCompleted || (isLive && result)) && result ? (
            // Any fixture with a result — completed OR live — shows the
            // score cluster. Middle annotation flips: 'FT' when completed,
            // pulsing dot + current minute when live. Winner accent only
            // applies once the match is final.
            <View style={styles.detailScoreRow}>
              <View
                style={[
                  styles.detailScoreBox,
                  isCompleted && result.home_score > result.away_score && styles.detailScoreBoxWinner,
                ]}>
                <Text
                  style={[
                    styles.detailScoreText,
                    isCompleted && result.home_score > result.away_score && styles.detailScoreTextWinner,
                  ]}>
                  {result.home_score}
                </Text>
              </View>
              {isLive ? (
                <View style={styles.liveMiddle}>
                  <LivePulseDot size={5} />
                  <Text style={styles.liveMinute}>
                    {fixture.status === 'half-time' ? 'HT' : `${liveMinute}'`}
                  </Text>
                </View>
              ) : (
                <Text style={styles.ftLabel}>FT</Text>
              )}
              <View
                style={[
                  styles.detailScoreBox,
                  isCompleted && result.away_score > result.home_score && styles.detailScoreBoxWinner,
                ]}>
                <Text
                  style={[
                    styles.detailScoreText,
                    isCompleted && result.away_score > result.home_score && styles.detailScoreTextWinner,
                  ]}>
                  {result.away_score}
                </Text>
              </View>
            </View>
          ) : (
            // No result yet (scheduled / postponed / cancelled): status
            // pill anchors the match state where the score would go.
            <StatusPill status={fixture.status} />
          )}
        </View>
        <View style={styles.flagSlotAway}>
          <Text style={styles.teamShort}>
            {awayTeam?.short_name ?? fixture.away_team_id.toUpperCase()}
          </Text>
          {awayTeam ? (
            <TeamFlagShield flagCode={awayTeam.flag_code} width={FlagSize.medium} />
          ) : null}
        </View>
      </View>
      {/* Meta line below the flags/score row — competition · round · venue
          on a single centred line, mirroring the Fixtures list row's
          "COMP · Venue" meta placement. */}
      <Text style={styles.headerLine}>
        {competitionName ?? fixture.competition_id}
        {fixture.round ? ` · ${fixture.round}` : ''}
        {' · '}
        {fixture.venue}
      </Text>
    </View>
  );
}

function StatusPill({ status }: { status: Fixture['status'] }) {
  const config: Record<Fixture['status'], { bg: string; fg: string; label: string }> = {
    scheduled: { bg: '#E5E7EB', fg: '#374151', label: 'Upcoming' },
    live: { bg: '#DC2626', fg: '#FFFFFF', label: 'LIVE' },
    'half-time': { bg: '#F59E0B', fg: '#FFFFFF', label: 'HALF-TIME' },
    completed: { bg: '#111827', fg: '#F9FAFB', label: 'Final' },
    postponed: { bg: '#F59E0B', fg: '#FFFFFF', label: 'Postponed' },
    cancelled: { bg: '#9CA3AF', fg: '#FFFFFF', label: 'Cancelled' },
  };
  const c = config[status];
  const showPulse = status === 'live' || status === 'half-time';
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      {showPulse ? (
        <View style={styles.pillDotSlot}>
          <LivePulseDot size={6} color={Colors.light.background} />
        </View>
      ) : null}
      <Text style={[styles.pillText, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatKickoff(iso: string): string {
  const date = new Date(iso);
  const dayStr = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${dayStr} · ${timeStr}`;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    // Hero section stays white against the grey page background — reads as
    // a top strip that owns the flags + score, distinct from the tab body.
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    // Bottom padding mirrors the matchupTopRow marginTop above the flags
    // + score row, so the hero has symmetric breathing room on both
    // sides of the "who's playing" row.
    paddingBottom: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
    // Shared drill-hero height — the team / player heroes centre their
    // shorter content in the same box so all three drills measure
    // identically from header to pill strip.
    minHeight: DRILL_HERO_MIN_HEIGHT,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  matchupTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    width: '100%',
    paddingHorizontal: Spacing.two,
    // Symmetric breathing room above AND below the flags/score cluster —
    // separates the "who's playing" hero from both the date/time meta
    // above and the competition/venue meta below by the same amount.
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
  },
  // Home + away flag-with-code columns. Each column is a flex-1 slot that
  // matches the width of the middle score slot's flex sibling, so codes
  // hug the score rather than the outer edges of the screen. Home
  // renders [flag][code] left-to-right; away mirrors as [code][flag].
  flagSlotHome: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  flagSlotAway: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  teamShort: {
    // 40pt-shield rule: sport-display face at xl beside medium shields.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.xl,
    letterSpacing: TextTracking.wide,
    color: Colors.light.text,
  },
  // scoreSlot is used twice: once wrapping the score row (top) and once as an
  // invisible spacer beneath it — same width both times so the labels sit
  // symmetric around the score column.
  scoreSlot: { minWidth: 124, alignItems: 'center', justifyContent: 'center' },
  score: { fontSize: TextSize.xl, fontWeight: TextWeight.bold, color: Colors.light.text, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  // gap 8 between each score box and the FT label — a bit more breathing
  // room than the small-tile 6pt gap because the boxes and text are all
  // scaled up here.
  detailScoreRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  // Card-scale "FT" annotation: 12pt bold, wide tracking, textSecondary.
  // Mirrors the row-scale FT (10pt bold wide) at the card tier — both
  // muted to read as informational annotation, not decoration.
  ftLabel: {
    fontSize: TextSize.md,
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  // Live-state middle chip in the hero: pulsing red dot + live minute
  // (or 'HT' during half-time break). Sits in the same middle position
  // as the 'FT' annotation for completed matches.
  liveMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveMinute: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    color: StatusColor.live,
    fontVariant: ['tabular-nums'],
  },
  detailScoreBox: {
    ...ScoreBoxSize.card,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailScoreBoxWinner: { backgroundColor: Colors.light.textSecondary },
  detailScoreText: { fontSize: TextSize.xl, fontFamily: 'BarlowCondensed_700Bold_Italic', color: Colors.light.textSecondary },
  detailScoreTextWinner: { color: Colors.light.textInverse },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pillText: { fontSize: TextSize.xs, fontWeight: TextWeight.bold, letterSpacing: TextTracking.wide },
  pillDotSlot: { justifyContent: 'center' },
  headerLine: { fontSize: TextSize.sm, color: Colors.light.textSecondary, textAlign: 'center' },
});
