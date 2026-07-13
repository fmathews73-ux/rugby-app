import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTeams } from '@/api/hooks';
import { PageGradient } from '@/components/page-gradient';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { TeamPickerModal } from '@/components/team-picker-modal';
import { useMyTeamId } from '@/hooks/use-my-team-id';
import { resetWelcomeSeen } from '@/hooks/use-welcome-seen';
import { Colors, FlagSize, PAGE_BOTTOM_INSET, Spacing, StatusColor, TextSize, TextTracking } from '@/constants/theme';

/**
 * Account & settings (PRD register #15 — skeleton, owner call
 * 2026-07-11). Root-level route so it opens from the avatar on ANY
 * tab and back pops to wherever the user was. Grouped cards in the
 * list-row grammar; only My Team is live in Phase 0 — the remaining
 * rows are honest placeholders for surfaces with confirmed future
 * homes (Firebase Auth #16, FCM prefs Phase 5, subscription #31,
 * App Store legal pages).
 */

export default function AccountScreen() {
  const router = useRouter();
  const teams = useTeams();
  const [myTeamId, setMyTeamId] = useMyTeamId();
  const [pickerOpen, setPickerOpen] = useState(false);

  const myTeam = teams.data?.find((t) => t.id === myTeamId) ?? null;
  const version = Constants.expoConfig?.version ?? '0.0.0';

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageGradient />
      {/* Own header row — this screen lives outside the tab layout, so
          the AppHeader doesn't render here. Same glyph registers. */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.headerSlot, pressed && styles.pressedDim]}>
          <Ionicons name="chevron-back-circle-outline" size={28} color="#C7CBD1" />
        </Pressable>
        <Text style={styles.headerTitle}>Account</Text>
        <View style={styles.headerSlot} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <SettingsCard title="Account">
          <SettingsRow
            label="My Team"
            onPress={() => setPickerOpen(true)}
            accessory={
              myTeam ? (
                <View style={styles.teamAccessory}>
                  <TeamFlagShield flagCode={myTeam.flag_code} width={FlagSize.row} />
                  <Text style={styles.teamCode}>{myTeam.short_name}</Text>
                </View>
              ) : (
                <Text style={styles.valueText}>Select team</Text>
              )
            }
          />
          <SettingsRow label="Sign in" placeholder="Coming soon" />
        </SettingsCard>

        <SettingsCard title="Preferences">
          <SettingsRow label="Notifications" placeholder="Coming soon" />
        </SettingsCard>

        <SettingsCard title="Membership">
          <SettingsRow label="Subscription" placeholder="Free plan" />
        </SettingsCard>

        <SettingsCard title="About">
          <SettingsRow label="Privacy Policy" onPress={() => router.push('/legal/privacy')} />
          <SettingsRow label="Terms of Service" onPress={() => router.push('/legal/terms')} />
          <SettingsRow label="Version" accessory={<Text style={styles.valueText}>{version}</Text>} />
        </SettingsCard>

        {/* Sign out (Phase 0: no real session — re-gates the welcome
            screen). Destructive register per design-system §5.2. */}
        <View style={styles.card}>
          <Pressable
            onPress={() => {
              // Until real auth lands, signing out clears the whole
              // local "session" — including My Team — so every
              // walk-through starts from a clean slate (owner call
              // 2026-07-11). With Firebase Auth this becomes
              // signOut() + preference sync teardown.
              setMyTeamId(null);
              resetWelcomeSeen();
              router.replace('/welcome');
            }}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => [styles.signOutRow, pressed && styles.rowPressed]}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>

        {__DEV__ ? (
          <Text style={styles.footerMeta}>Development build · synthetic data</Text>
        ) : null}
      </ScrollView>

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
    </SafeAreaView>
  );
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <View style={styles.insetDivider} />
      {rows.map((child, i) => (
        <View key={i}>
          {child}
          {i < rows.length - 1 ? <View style={styles.insetDivider} /> : null}
        </View>
      ))}
    </View>
  );
}

function SettingsRow({
  label,
  onPress,
  accessory,
  placeholder,
}: {
  label: string;
  onPress?: () => void;
  accessory?: React.ReactNode;
  /** Renders the row quiet (grey label, meta text, no chevron). */
  placeholder?: string;
}) {
  const disabled = !onPress;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Text style={[styles.rowLabel, placeholder !== undefined && styles.rowLabelQuiet]}>
        {label}
      </Text>
      <View style={styles.rowRight}>
        {placeholder !== undefined ? (
          <Text style={styles.valueText}>{placeholder}</Text>
        ) : (
          accessory
        )}
        {onPress ? (
          <Ionicons name="chevron-forward" size={16} color="#C7CBD1" />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerSlot: { minWidth: 44 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    textTransform: 'uppercase',
    color: Colors.light.textSecondary,
  },
  pressedDim: { opacity: 0.5 },

  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: PAGE_BOTTOM_INSET,
    gap: Spacing.three,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  cardTitle: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    textTransform: 'uppercase',
    color: Colors.light.textSecondary,
  },
  insetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C7CBD1',
    marginHorizontal: Spacing.three,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  rowPressed: { backgroundColor: Colors.light.backgroundElement },
  rowLabel: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.md,
    color: Colors.light.text,
  },
  rowLabelQuiet: {
    color: Colors.light.textSecondary,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  valueText: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  teamAccessory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  teamCode: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.text,
  },
  signOutRow: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  signOutText: {
    fontFamily: 'WorkSans_600SemiBold',
    fontSize: 14,
    color: StatusColor.live,
  },
  footerMeta: {
    textAlign: 'center',
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
});
