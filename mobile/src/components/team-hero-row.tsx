import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Team } from '@rugby-app/shared';

import { CapsJerseyBadge } from '@/components/squad-jersey';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { Colors, FlagSize, ScoreBoxSize, Spacing, TextSize, TextTracking } from '@/constants/theme';
import { useTeamPlayers } from '@/api/hooks';
import { useTeamRecentForm } from '@/hooks/use-team-recent-form';

// One window, one story — prev-10 record.
const FORM_LOOKBACK = 10;

/**
 * EXACT clone of the fixtures-list row geometry (owner call
 * 2026-07-10: "as close as possible to the fixtures row list items"):
 * centred cluster of [24pt shield][lg code, fixed 40 slot][fixed 96
 * middle: W/L boxes in the ScoreBoxSize.row register with the match
 * pairing][caps + 24pt-scale jersey], then the rank line in the
 * fixture row's metaText register. Chevron rides absolutely at the
 * right edge like rowChevron. Dot sequence removed (owner call).
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
  const wins = outcomes.filter((o) => o === 'W').length;
  const draws = outcomes.filter((o) => o === 'D').length;
  const losses = outcomes.filter((o) => o === 'L').length;
  const players = useTeamPlayers(team.id);
  const caps = (players.data ?? []).reduce((sum, pl) => sum + pl.cap_count, 0);

  return (
    <View style={styles.rowOuter}>
      <View style={styles.matchupRow}>
        <View style={styles.flagWrap}>
          <TeamFlagShield flagCode={team.flag_code} width={FlagSize.row} />
        </View>
        <Text style={styles.teamCode}>{team.short_name}</Text>
        <View style={styles.middle}>
          {/* Dark treatment lives on the W box ALWAYS (owner call
              2026-07-09 sim date): wins are the identity number, the
              L box stays quiet whatever the record. */}
          <View style={[styles.scoreBoxSmall, styles.scoreBoxSmallWinner]}>
            <Text style={[styles.scoreBoxSmallText, styles.scoreBoxSmallTextWinner]}>
              {wins}
              <Text style={[styles.unitText, styles.scoreBoxSmallTextWinner]}> W</Text>
            </Text>
          </View>
          <View style={styles.scoreBoxSmall}>
            <Text style={styles.scoreBoxSmallText}>
              {draws}
              <Text style={styles.unitText}> D</Text>
            </Text>
          </View>
          <View style={styles.scoreBoxSmall}>
            <Text style={styles.scoreBoxSmallText}>
              {losses}
              <Text style={styles.unitText}> L</Text>
            </Text>
          </View>
        </View>
        <Text style={styles.capsText}>{caps > 0 ? caps.toLocaleString('en-GB') : '—'}</Text>
        <View style={styles.flagWrap}>
          <CapsJerseyBadge teamId={team.id} caps={0} size={FlagSize.row / 0.9045} hideNumber />
        </View>
        {right ? <View style={styles.rowChevron}>{right}</View> : null}
      </View>
      <Text style={styles.metaText}>
        {rankRow
          ? `World Rank #${rankRow.rank} · ${rankRow.points.toFixed(1)} pts`
          : 'Unranked'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rowOuter: {
    // Callers wrap this in a ROW Pressable — flex to claim its width.
    flex: 1,
    gap: 4,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  flagWrap: {
    width: FlagSize.row,
    height: FlagSize.row,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamCode: {
    // 24pt-shield rule: sport-display face at lg beside row shields.
    width: 40,
    textAlign: 'center',
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.text,
  },
  // Fixed-width middle slot — the fixture row's score column,
  // widened with a tighter gap to seat the W/D/L trio.
  middle: {
    width: 112,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  scoreBoxSmall: {
    ...ScoreBoxSize.row,
    minWidth: ScoreBoxSize.row.width + 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  scoreBoxSmallWinner: { backgroundColor: Colors.light.textSecondary },
  scoreBoxSmallText: {
    fontSize: TextSize.lg,
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    color: Colors.light.textSecondary,
  },
  scoreBoxSmallTextWinner: { color: Colors.light.textInverse },
  unitText: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 7,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  // Away-side mirror of the code slot — caps count in the same
  // register beside the jersey glyph.
  capsText: {
    width: 40,
    textAlign: 'center',
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.text,
  },
  rowChevron: {
    position: 'absolute',
    right: -Spacing.two,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaText: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});
