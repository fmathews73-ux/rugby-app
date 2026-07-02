import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { Competition, Fixture, Result, Team } from '@rugby-app/shared';

import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, FlagSize, ScoreBoxSize, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';

/**
 * One card in the Home timeline carousel. Layout:
 *
 *   Sat 4 Jul                                              (top-left)
 *                       Round 1                            (centred)
 *   [flag]              [X] [FT] [Y]              [flag]   (matchup row)
 *   HOME                                          AWAY
 *   ─────────────────────────────────────────────────────  (divider)
 *   📍 Stade de France                                     (venue)
 *
 * Winning team's score is accent-boxed; the other is a flat grey box.
 * Scheduled fixtures show just the kickoff time centred, no score boxes.
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
  const roundText = fixture.round ?? competition?.short_name ?? '';

  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.topRow}>
        {isLive ? (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveLabel}>Live</Text>
          </View>
        ) : (
          <Text style={styles.dayLabel}>{dayLabel}</Text>
        )}
      </View>

      <Text style={styles.roundText}>{roundText}</Text>

      {/* Top row — flag + score + flag on the same horizontal centre line.
          All three columns flex-1 so slots are equally wide, guaranteeing
          the team labels below sit exactly under their flag. */}
      <View style={styles.matchupTopRow}>
        <View style={styles.flagSlot}>
          {homeTeam ? <TeamFlagBall2D flagCode={homeTeam.flag_code} size={FlagSize.medium} /> : null}
        </View>

        <View style={styles.scoreSlot}>
          <ScoreBlock
            fixture={fixture}
            result={result}
            isCompleted={isCompleted}
            isLive={isLive}
          />
        </View>

        <View style={styles.flagSlot}>
          {awayTeam ? <TeamFlagBall2D flagCode={awayTeam.flag_code} size={FlagSize.medium} /> : null}
        </View>
      </View>

      {/* Bottom row — team codes under each flag, invisible middle slot
          matching scoreSlot width so codes stay symmetric under the flags. */}
      <View style={styles.matchupLabelsRow}>
        <View style={styles.labelCol}>
          <Text style={styles.teamCode}>{homeTeam?.short_name ?? fixture.home_team_id.toUpperCase()}</Text>
        </View>
        <View style={styles.scoreSlot} />
        <View style={styles.labelCol}>
          <Text style={styles.teamCode}>{awayTeam?.short_name ?? fixture.away_team_id.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.venueRow}>
        <Ionicons name="location" size={14} color={Colors.light.text} />
        <Text style={styles.venueText} numberOfLines={1}>
          {fixture.venue}
        </Text>
      </View>
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
  const kickoffTime = fixture.kickoff_utc.slice(11, 16);

  if (isLive && result) {
    // Live: both scores in plain grey boxes; middle status shows the current
    // minute (e.g. "41'") in red. Half-time shows "HT" in the same red slot.
    // No accent on either score — the play is still going.
    const statusText =
      fixture.status === 'half-time' ? 'HT' : `${computeLiveMinute(fixture)}'`;
    return (
      <View style={styles.scoreRow}>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreText}>{result.home_score}</Text>
        </View>
        <Text style={styles.statusLive}>{statusText}</Text>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreText}>{result.away_score}</Text>
        </View>
      </View>
    );
  }

  if (isCompleted && result) {
    // Completed: winning team's score gets the indigo accent box.
    const homeWins = result.home_score > result.away_score;
    const awayWins = result.away_score > result.home_score;
    return (
      <View style={styles.scoreRow}>
        <View style={[styles.scoreBox, homeWins && styles.scoreBoxWinner]}>
          <Text style={[styles.scoreText, homeWins && styles.scoreTextWinner]}>
            {result.home_score}
          </Text>
        </View>
        <Text style={styles.statusText}>FT</Text>
        <View style={[styles.scoreBox, awayWins && styles.scoreBoxWinner]}>
          <Text style={[styles.scoreText, awayWins && styles.scoreTextWinner]}>
            {result.away_score}
          </Text>
        </View>
      </View>
    );
  }

  // Scheduled or no result: show kickoff time centred
  return (
    <View style={styles.scoreRowScheduled}>
      <Text style={styles.kickoffLabel}>KO</Text>
      <Text
        style={styles.kickoffTime}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}>
        {kickoffTime}
      </Text>
    </View>
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
    padding: Spacing.four,
    minHeight: 200,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  topRow: { flexDirection: 'row', justifyContent: 'flex-start', minHeight: 18 },
  dayLabel: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontWeight: TextWeight.regular,
  },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: StatusColor.live,
  },
  liveLabel: {
    fontSize: TextSize.sm,
    color: StatusColor.live,
    fontWeight: TextWeight.bold,
  },

  roundText: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: Spacing.three,
  },

  matchupTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    // Generous outer breathing gap (60) intentionally 10× the internal
    // ScoreBlock cluster gap (6). Reads as: flag / [score-FT-score cluster] /
    // flag — three distinct visual groups instead of five equally-spaced items.
    // Not on the Spacing scale because this is a per-context aesthetic
    // decision for the paired-element pattern, not a general spacing token.
    gap: 60,
  },
  flagSlot: { flex: 1, alignItems: 'center' },
  // Same style is used twice in the card: once wrapping ScoreBlock (top row)
  // and once as an invisible spacer under it (labels row) — guarantees the
  // team codes sit exactly under their flag.
  scoreSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  matchupLabelsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    // Padding AND gap MUST match matchupTopRow so the three flex-1 columns are
    // the same width in both rows — otherwise the label centres drift outward
    // relative to the flag centres above.
    paddingHorizontal: Spacing.two,
    gap: 60,
    marginTop: 6,
  },
  labelCol: { flex: 1, alignItems: 'center' },
  teamCode: {
    fontSize: TextSize.lg,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
  },

  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreBox: {
    ...ScoreBoxSize.card,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBoxWinner: {
    backgroundColor: Colors.light.text,
  },
  scoreText: {
    fontSize: TextSize.xl,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },
  scoreTextWinner: { color: Colors.light.textInverse },
  // FT annotation for completed fixtures in the card. Uses the canonical
  // card-scale FT spec — 12pt bold wide textSecondary — matching the
  // fixture-detail hero and mirroring the row-scale FT at 10pt used in the
  // list contexts. See design-system.md §6 for the two-tier FT scale.
  statusText: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    marginHorizontal: 2,
  },
  statusLive: {
    fontSize: TextSize.lg,
    fontWeight: TextWeight.bold,
    color: StatusColor.live,
    marginHorizontal: 2,
  },

  scoreRowScheduled: {
    alignItems: 'center',
  },
  kickoffLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
    letterSpacing: TextTracking.wide,
  },
  kickoffTime: {
    fontSize: TextSize.xl,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginTop: Spacing.three,
    marginBottom: Spacing.two + 2,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  venueText: {
    fontSize: TextSize.md,
    color: Colors.light.text,
    fontWeight: TextWeight.semibold,
    flexShrink: 1,
  },
});
