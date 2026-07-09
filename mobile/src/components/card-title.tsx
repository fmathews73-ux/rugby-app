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
  comparison,
  centerTitle,
}: {
  title: string;
  flagCode?: string | null;
  code?: string | null;
  /** Second identity pair — two-team match cards show both sides
   *  (home first) ahead of the title. */
  flagCode2?: string | null;
  code2?: string | null;
  /** Comparison basis tag after the identity (owner convention
   *  2026-07-09): shield · code · "vs TIER AVG" · padding · TITLE. */
  comparison?: string | null;
  /** Centre the TITLE on the card (owner call 2026-07-09) so it
   *  aligns with the matrix's vertical crosshair; identity stays
   *  left. Requires the row's trigger to be absolutely positioned and
   *  CardTitle to span the full row (flex: 1). */
  centerTitle?: boolean;
}) {
  if (centerTitle) {
    return (
      <View style={styles.groupCentered}>
        <View style={styles.group}>
          {flagCode ? <TeamFlagShield flagCode={flagCode} width={16} /> : null}
          {code ? <Text style={styles.code}>{code}</Text> : null}
          {flagCode2 ? <TeamFlagShield flagCode={flagCode2} width={16} /> : null}
          {code2 ? <Text style={styles.code}>{code2}</Text> : null}
          {comparison ? <Text style={styles.comparison}>{comparison}</Text> : null}
        </View>
        <View style={styles.centreOverlay} pointerEvents="none">
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.group}>
      {flagCode ? <TeamFlagShield flagCode={flagCode} width={16} /> : null}
      {code ? <Text style={styles.code}>{code}</Text> : null}
      {flagCode2 ? <TeamFlagShield flagCode={flagCode2} width={16} /> : null}
      {code2 ? <Text style={styles.code}>{code2}</Text> : null}
      {comparison ? <Text style={styles.comparison}>{comparison}</Text> : null}
      <Text style={[styles.title, comparison ? styles.titlePadded : null]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  groupCentered: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    minHeight: 20,
  },
  centreOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
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
  titlePadded: {
    marginLeft: 6,
  },
  // Quiet comparison-basis tag — meta register, not identity.
  comparison: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.xs,
    letterSpacing: TextTracking.wide,
    textTransform: 'uppercase',
    color: Colors.light.textSecondary,
  },
});
