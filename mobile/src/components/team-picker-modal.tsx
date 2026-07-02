import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Team } from '@rugby-app/shared';

import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, FlagSize, Spacing, TextSize, TextWeight } from '@/constants/theme';

/**
 * Full-screen modal for picking a favourite team. All 28 international teams
 * (Tier 1 + Tier 2) sorted alphabetically in a single flat list — no tier
 * grouping. Tap a row to select; the selection is provisional until Confirm
 * is tapped. Cancel discards the change.
 */
export function TeamPickerModal({
  visible,
  teams,
  currentTeamId,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  teams: readonly Team[];
  currentTeamId: string | null;
  onCancel: () => void;
  onConfirm: (teamId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(currentTeamId);

  // Reset provisional selection each time the modal opens.
  useEffect(() => {
    if (visible) setSelected(currentTeamId);
  }, [visible, currentTeamId]);

  const sortedTeams = useMemo(
    () => teams.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [teams],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={onCancel} hitSlop={12}>
            <Text style={styles.headerAction}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>My Team</Text>
          {/* Placeholder to balance flex layout with Cancel. */}
          <View style={styles.headerActionSpacer} />
        </View>

        <FlatList
          data={sortedTeams}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => {
            const isSelected = selected === item.id;
            const isFirst = index === 0;
            const isLast = index === sortedTeams.length - 1;
            return (
              <Pressable
                onPress={() => setSelected(item.id)}
                style={({ pressed }) => [
                  styles.row,
                  isFirst && styles.rowFirst,
                  isLast && styles.rowLast,
                  pressed && styles.rowPressed,
                ]}>
                <TeamFlagBall2D flagCode={item.flag_code} size={FlagSize.medium} />
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowShort}>{item.short_name}</Text>
                </View>
                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={26} color={Colors.light.text} />
                ) : (
                  <View style={styles.tickPlaceholder} />
                )}
              </Pressable>
            );
          }}
        />

        <View style={styles.footer}>
          <Pressable
            onPress={() => selected && onConfirm(selected)}
            disabled={selected === null}
            style={({ pressed }) => [
              styles.confirmButton,
              selected === null && styles.confirmButtonDisabled,
              pressed && styles.confirmButtonPressed,
            ]}>
            <Text style={styles.confirmButtonText}>Confirm</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F7' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerAction: { fontSize: TextSize.md, color: Colors.light.text, fontWeight: TextWeight.semibold },
  headerActionSpacer: { width: 60 },
  headerTitle: { fontSize: TextSize.lg, fontWeight: TextWeight.bold, color: Colors.light.text },

  listContent: {
    padding: Spacing.four,
    paddingBottom: 40,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  rowFirst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  rowLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  rowPressed: { backgroundColor: '#F3F4F6' },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: TextSize.md, fontWeight: TextWeight.semibold, color: Colors.light.text },
  rowShort: {
    fontSize: TextSize.xs,
    letterSpacing: 1,
    color: Colors.light.textSecondary,
    fontWeight: TextWeight.semibold,
  },
  tickPlaceholder: { width: 26, height: 26 },

  footer: {
    padding: Spacing.four,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  confirmButton: {
    backgroundColor: Colors.light.text,
    paddingVertical: Spacing.three,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonPressed: { opacity: 0.85 },
  confirmButtonDisabled: { backgroundColor: '#9CA3AF' },
  confirmButtonText: { color: '#FFFFFF', fontSize: TextSize.md, fontWeight: TextWeight.bold },
});
