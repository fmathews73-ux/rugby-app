import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <View style={styles.container}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorBody}>{message}</Text>
    </View>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: {
    color: Colors.light.textSecondary,
    fontSize: 14,
  },
  errorTitle: {
    color: '#B45309',
    fontSize: 15,
    fontWeight: '600',
  },
  errorBody: {
    color: Colors.light.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
});
