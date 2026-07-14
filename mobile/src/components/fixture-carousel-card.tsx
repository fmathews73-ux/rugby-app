import { StyleSheet, Text, View } from 'react-native';

import type { Competition, Fixture, Result, Team } from '@rugby-app/shared';

import { LivePulseDot } from '@/components/live-pulse-dot';
import { formatKickoffTime } from '@/lib/format-fixture-date';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { Colors, FlagSize, ScoreBoxSize, ScoreBug, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';

/**
 * One card in the Home timeline carousel. Layout mirrors the fixture-drill
 * hero header exactly — date centred at the top, `[flag][CODE]` — score —
 * `[CODE][flag]` on the matchup row, competition + round + venue collapsed
 * to a single centred meta line at the bottom. Same typographic tokens as
 * the drill hero so the two surfaces read as one visual system when a
 * user taps from carousel into detail.
 *
 * The outer card chrome (rounded corners, shadow, hairline border) is the
 * only thing that differs from the drill hero — it's what makes this a
 * carousel card vs. a full-bleed header.
 */
export function FixtureCarouselCard({
  fixture,
  result,
  homeTeam,
  awayTeam,
  competition,
  dayLabel,
  width,
}: {
  fixture: Fixture;
  result: Result | null;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
  competition: Competition | undefined;
  dayLabel: string;
  width: number;
}) {
  const isCompleted = fixture.status === 'completed';
  const isLive = fixture.status === 'live' || fixture.status === 'half-time';

  const competitionShort = competition?.short_name ?? fixture.competition_id;
  const metaParts = [competitionShort];
  if (fixture.round) metaParts.push(fixture.round);
  metaParts.push(fixture.venue);
  const metaLine = metaParts.join(' · ');

  return (
    <View style={[styles.card, { width }]}>
      {/* Date row — centred. Live-state is signalled inside the score slot
          (matches drill hero), so no top-level live indicator here. */}
      <Text style={styles.headerLine}>
        {fixture.status === 'scheduled' ? `${dayLabel} · Upcoming` : dayLabel}
      </Text>

      {/* Matchup row — every item is a direct sibling of the row with
          `justifyContent: 'space-around'`, so distribution is even across
          the full card width. Completed / live variants render 7 items
          (flag · code · score · FT · score · code · flag); scheduled
          renders 5 (flag · code · time · code · flag). Both variants read
          as symmetrically centred. */}
      <View style={styles.matchupRow}>
        {homeTeam ? (
          <TeamFlagShield flagCode={homeTeam.flag_code} width={FlagSize.medium} />
        ) : null}
        <Text style={styles.teamShort}>
          {homeTeam?.short_name ?? fixture.home_team_id.toUpperCase()}
        </Text>
        <ScoreBlock
          fixture={fixture}
          result={result}
          isCompleted={isCompleted}
          isLive={isLive}
        />
        <Text style={styles.teamShort}>
          {awayTeam?.short_name ?? fixture.away_team_id.toUpperCase()}
        </Text>
        {awayTeam ? (
          <TeamFlagShield flagCode={awayTeam.flag_code} width={FlagSize.medium} />
        ) : null}
      </View>

      {/* Bottom meta: competition · round · venue collapsed to one line.
          Extra `marginTop` gives it a line-height of breathing room above
          so the matchup hero and the meta feel like distinct blocks. */}
      <Text style={[styles.headerLine, styles.metaLineSpacing]} numberOfLines={1}>
        {metaLine}
      </Text>
    </View>
  );
}

function ScoreBlock({
  fixture,
  result,
  isCompleted,
  isLive,
}: {
  fixture: Fixture;
  result: Result | null;
  isCompleted: boolean;
  isLive: boolean;
}) {
  const kickoffTime = formatKickoffTime(fixture.kickoff_utc);

  if (isLive && result) {
    // Live with in-progress score: pulsing red dot + minute clock replaces
    // the FT annotation between the two scores. Returns three siblings so
    // the parent row can distribute them via space-around.
    const statusText =
      fixture.status === 'half-time' ? 'HT' : `${computeLiveMinute(fixture)}'`;
    return (
      <>
        <View style={[styles.scoreBox, styles.scoreBoxLeft]}>
          <Text style={styles.scoreText}>{result.home_score}</Text>
        </View>
        <View style={styles.liveMiddle}>
          <LivePulseDot size={5} />
          <Text style={styles.statusLive}>{statusText}</Text>
        </View>
        <View style={[styles.scoreBox, styles.scoreBoxRight]}>
          <Text style={styles.scoreText}>{result.away_score}</Text>
        </View>
      </>
    );
  }

  if (isCompleted && result) {
    // Completed: winning team's score gets the dark accent box. Three
    // siblings (score / FT / score) so the parent row distributes them.
    const homeWins = result.home_score > result.away_score;
    const awayWins = result.away_score > result.home_score;
    return (
      <>
        <View style={[styles.scoreBox, styles.scoreBoxLeft, homeWins && styles.scoreBoxWinner]}>
          <Text style={[styles.scoreText, homeWins && styles.scoreTextWinner]}>
            {result.home_score}
          </Text>
        </View>
        <Text style={styles.ftLabel}>FT</Text>
        <View style={[styles.scoreBox, styles.scoreBoxRight, awayWins && styles.scoreBoxWinner]}>
          <Text style={[styles.scoreText, awayWins && styles.scoreTextWinner]}>
            {result.away_score}
          </Text>
        </View>
      </>
    );
  }

  // Scheduled or no result: kickoff time as a single centred sibling.
  return (
    <Text
      style={styles.kickoffTime}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}>
      {kickoffTime}
    </Text>
  );
}

/** Elapsed minutes since kickoff, clamped to a rugby-plausible 0-80. When the
 * real feed is wired the live minute will come from the feed and this will
 * become a fallback. */
function computeLiveMinute(fixture: Fixture): number {
  const kickoff = new Date(fixture.kickoff_utc).getTime();
  const now = Date.now();
  const elapsed = Math.floor((now - kickoff) / 60000);
  return Math.min(80, Math.max(0, elapsed));
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    // Horizontal Spacing.three (16pt), vertical Spacing.four (24pt) —
    // adds a line-height of breathing room compared to Spacing.three
    // (8pt more top + 8pt more bottom) while keeping the tighter
    // horizontal padding that lets the flags sit closer to the card
    // edges for even `space-evenly` distribution across the row.
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    // Same vertical rhythm as the drill hero — 8pt gap between the date,
    // matchup row, and meta line; matchup row supplies its own extra
    // marginTop for the "who's playing" hero breathing room.
    gap: Spacing.two,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  // Muted centred single-line style used for the date at the top and the
  // meta (competition · round · venue) at the bottom. Same token as the
  // drill hero's `headerLine`.
  headerLine: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  // One line-height of extra breathing room above the bottom meta so it
  // reads as its own block rather than sitting flush against the flags.
  metaLineSpacing: {
    marginTop: Spacing.three,
  },

  // Matchup row — every item (flag, code, score, FT/minute, score, code,
  // flag) is a direct sibling. `justifyContent: 'space-around'` gives each
  // item equal breathing room on either side, so distribution stays even
  // even when the middle content changes between kickoff-time / score-FT-
  // score / score-LIVE-score. Zero horizontal padding lets the outer
  // flags sit closer to the card edge — the outer whitespace is the
  // card's `paddingHorizontal` only.
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // `space-between` anchors the home flag flush with the card's
    // paddingHorizontal (Spacing.three) — no extra `space-evenly` slot
    // to its left. That lines its x-position up with the Team Selector /
    // My-Team-Matches / My-Team-Preview cards' left-edge content on
    // the Home page, so every card on that surface shares one vertical
    // gridline.
    justifyContent: 'space-between',
    width: '100%',
    marginTop: Spacing.three,
  },
  teamShort: {
    // Same sport-display face as the hero-row nation codes.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.xl,
    letterSpacing: TextTracking.wide,
    color: Colors.light.text,
  },
  scoreBox: {
    ...ScoreBoxSize.card,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    ...ScoreBug.skew,
  },
  scoreBoxLeft: { ...ScoreBug.cutLeft },
  scoreBoxRight: { ...ScoreBug.cutRight },
  scoreBoxWinner: {
    backgroundColor: Colors.light.textSecondary,
  },
  scoreText: {
    fontSize: TextSize.xl,
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    color: Colors.light.textSecondary,
    ...ScoreBug.counterSkew,
  },
  scoreTextWinner: { color: Colors.light.textInverse },
  // Card-scale FT annotation between the two completed scores. Same 12pt
  // bold wide textSecondary spec used in the drill hero.
  ftLabel: {
    fontSize: TextSize.md,
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    marginHorizontal: 2,
  },
  // Live-state middle slot: pulsing red dot + minute clock. Sits in the
  // same middle position as the FT annotation for completed matches.
  liveMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: 2,
  },
  statusLive: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    color: StatusColor.live,
  },

  kickoffTime: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.xl,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
});
