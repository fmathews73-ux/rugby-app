import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Team } from '@rugby-app/shared';

import { Ionicons } from '@expo/vector-icons';

import { TeamFlagShield } from '@/components/team-flag-shield';
import { Colors, FlagSize, Spacing, TextSize, TextTracking } from '@/constants/theme';
import { useTeamRecentForm } from '@/hooks/use-team-recent-form';
import { TROPHY_COLOR, WORLD_CUP_WINS } from '@/lib/honours';

const FORM_LOOKBACK = 5;

// Same outcome trio as FormCircles / the Form chart.
const WIN_COLOR = '#059669';
const LOSS_COLOR = '#DC2626';
const DRAW_COLOR = '#9CA3AF';

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

  return (
    <View style={styles.row}>
      <View style={styles.identityGroup}>
        <TeamFlagShield flagCode={team.flag_code} width={FlagSize.medium} />
        <Text style={styles.code}>{team.short_name}</Text>
      </View>
      <View style={styles.metaStack}>
        <Text style={styles.metaText}>
          {rankRow ? `World Rank #${rankRow.rank} · ${rankRow.points.toFixed(1)} pts` : 'Unranked'}
        </Text>
        {outcomes.length > 0 ? (
          // Result sequence as bare colour dots (newest first, matching
          // the old FormCircles convention) — sized to sit inside the
          // meta line's height so the row rhythm doesn't change.
          <View style={styles.recordRow}>
            <Text style={styles.metaText}>Last {outcomes.length} · </Text>
            {outcomes.map((o, i) => (
              <View
                key={i}
                style={[
                  styles.recordDot,
                  {
                    backgroundColor:
                      o === 'W' ? WIN_COLOR : o === 'L' ? LOSS_COLOR : DRAW_COLOR,
                  },
                ]}
              />
            ))}
          </View>
        ) : null}
        {WORLD_CUP_WINS[team.id] ? (
          <View style={styles.recordRow}>
            <Text style={styles.metaText}>WC · </Text>
            {Array.from({ length: WORLD_CUP_WINS[team.id]! }).map((_, i) => (
              <Ionicons key={i} name="trophy" size={10} color={TROPHY_COLOR} />
            ))}
          </View>
        ) : null}
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
    // Sport-display moment: Barlow Condensed Bold Italic — the family
    // file carries the weight, so no fontWeight (RN would fake-bold it).
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.xl,
    letterSpacing: TextTracking.wide,
    color: Colors.light.text,
  },
  metaStack: {
    flex: 1,
    alignItems: 'flex-start',
    gap: Spacing.one,
    paddingLeft: Spacing.three,
  },
  metaText: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  // 7pt dots — small enough to live inside the meta line's height.
  recordDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
});
