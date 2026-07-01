import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { Competition, Fixture, Result, Team } from '@rugby-app/shared';

import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, Spacing } from '@/constants/theme';

const ACCENT = '#4F46E5';

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
        <Text style={styles.dayLabel}>{dayLabel}</Text>
      </View>

      <Text style={styles.roundText}>{roundText}</Text>

      <View style={styles.matchupRow}>
        <View style={styles.teamCol}>
          {homeTeam ? <TeamFlagBall2D flagCode={homeTeam.flag_code} size={44} /> : null}
          <Text style={styles.teamCode}>{homeTeam?.short_name ?? fixture.home_team_id.toUpperCase()}</Text>
        </View>

        <ScoreBlock
          fixture={fixture}
          result={result}
          isCompleted={isCompleted}
          isLive={isLive}
        />

        <View style={styles.teamCol}>
          {awayTeam ? <TeamFlagBall2D flagCode={awayTeam.flag_code} size={44} /> : null}
          <Text style={styles.teamCode}>{awayTeam?.short_name ?? fixture.away_team_id.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.venueRow}>
        <Ionicons name="location" size={14} color={ACCENT} />
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

  if ((isCompleted || isLive) && result) {
    const homeWins = result.home_score > result.away_score;
    const awayWins = result.away_score > result.home_score;
    const statusLabel = isLive
      ? fixture.status === 'half-time'
        ? 'HT'
        : 'LIVE'
      : 'FT';
    return (
      <View style={styles.scoreRow}>
        <View style={[styles.scoreBox, homeWins && styles.scoreBoxWinner]}>
          <Text style={[styles.scoreText, homeWins && styles.scoreTextWinner]}>
            {result.home_score}
          </Text>
        </View>
        <Text style={styles.statusText}>{statusLabel}</Text>
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
      <Text style={styles.kickoffTime}>{kickoffTime}</Text>
    </View>
  );
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

  topRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  dayLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },

  roundText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: Spacing.three,
  },

  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    gap: Spacing.two,
  },
  teamCol: { alignItems: 'center', gap: 6, minWidth: 60 },
  teamCode: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.light.text,
    letterSpacing: 0.6,
  },

  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreBox: {
    minWidth: 40,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBoxWinner: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  scoreText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
  },
  scoreTextWinner: { color: ACCENT },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    marginHorizontal: 2,
  },

  scoreRowScheduled: {
    alignItems: 'center',
  },
  kickoffLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 1,
  },
  kickoffTime: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 2,
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
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '600',
    flexShrink: 1,
  },
});
