import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Team } from '@rugby-app/shared';

import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, FlagSize, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamRecentForm } from '@/hooks/use-team-recent-form';
import { worldCupTitles } from '@/lib/world-cup-titles';

const FORM_LOOKBACK = 5;

/**
 * Compact row-scale version of the drill-hero grammar, shared by every
 * "my team" identity surface (Teams directory My Team card, Home Team
 * Selector, Team Picker rows): flag + CODE anchored left, two quiet
 * meta lines stacked left-aligned in the remaining space (world rank ·
 * points · trophies, then the last-5 record as text), optional
 * accessory pinned right. The dot-strip form visual stays off these
 * rows — the record line is the summary, the dots live in Preview.
 */
export function TeamHeroRow({
  team,
  rankRow,
  right,
}: {
  team: Team;
  rankRow: { rank: number; points: number } | null | undefined;
  /** Optional right-pinned accessory (list button, checkmark, …). */
  right?: ReactNode;
}) {
  const { outcomes } = useTeamRecentForm(team.id, FORM_LOOKBACK);
  let w = 0, l = 0, d = 0;
  for (const o of outcomes) o === 'W' ? w++ : o === 'L' ? l++ : d++;
  const record =
    outcomes.length > 0
      ? `Last ${outcomes.length} · W${w} L${l}${d > 0 ? ` D${d}` : ''}`
      : null;
  const titles = worldCupTitles(team.id);

  return (
    <View style={styles.row}>
      <View style={styles.identityGroup}>
        <TeamFlagBall2D flagCode={team.flag_code} size={FlagSize.medium} />
        <Text style={styles.code}>{team.short_name}</Text>
      </View>
      <View style={styles.metaStack}>
        <View style={styles.metaLine}>
          <Text style={styles.metaText}>
            {rankRow ? `World Rank #${rankRow.rank} · ${rankRow.points.toFixed(1)} pts` : 'Unranked'}
          </Text>
          {titles > 0 ? (
            <>
              <Text style={styles.metaText}> · </Text>
              <Ionicons name="trophy" size={11} color={Colors.light.textSecondary} />
              <Text style={styles.metaText}> X{titles}</Text>
            </>
          ) : null}
        </View>
        {record ? <Text style={styles.metaText}>{record}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  identityGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  code: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  metaStack: {
    flex: 1,
    alignItems: 'flex-start',
    gap: Spacing.one,
    paddingLeft: Spacing.three,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
});
