import { StyleSheet, Text, View } from 'react-native';

import { TeamFlagShield } from '@/components/team-flag-shield';
import { Colors, TextSize, TextTracking } from '@/constants/theme';

/**
 * Chart-card header title with the team identity pair (owner call
 * 2026-07-08, piloted on Profile): 16pt shield + nation code in
 * identity BLACK, then the one-word title in the grey title register —
 * colour separates the registers, not the face. Team-scoped cards
 * pass the ACTIVE side's team when a compare toggle is live; identity
 * omitted (title only) on non-team-scoped cards.
 */
export function CardTitle({
  title,
  flagCode,
  code,
  flagCode2,
  code2,
}: {
  title: string;
  flagCode?: string | null;
  code?: string | null;
  /** Second identity pair — two-team match cards show both sides
   *  (home first) ahead of the title. */
  flagCode2?: string | null;
  code2?: string | null;
}) {
  return (
    <View style={styles.group}>
      {flagCode ? <TeamFlagShield flagCode={flagCode} width={16} /> : null}
      {code ? <Text style={styles.code}>{code}</Text> : null}
      {flagCode2 ? <TeamFlagShield flagCode={flagCode2} width={16} /> : null}
      {code2 ? <Text style={styles.code}>{code2}</Text> : null}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  code: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    textTransform: 'uppercase',
    color: Colors.light.text,
  },
  title: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    textTransform: 'uppercase',
    color: Colors.light.textSecondary,
  },
});
