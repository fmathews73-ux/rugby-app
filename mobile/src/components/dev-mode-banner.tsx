import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getDataSource, subscribeDataSource } from '@/api/client';
import type { DataSource } from '@/api/client';
import { Colors, TextSize, TextTracking, TextWeight } from '@/constants/theme';

/**
 * Persistent dev-mode banner. Required by PRD §5.5 whenever any screen is
 * rendering synthetic data. Non-dismissable by design — a user must never
 * mistake a dev build for a real one.
 *
 * The banner is keyed off the `X-Data-Source` response header that the API
 * emits on every successful call. It appears the moment the first synthetic
 * response lands and stays visible thereafter.
 */
export function DevModeBanner() {
  const [source, setSource] = useState<DataSource>(getDataSource());

  useEffect(() => subscribeDataSource(setSource), []);

  if (source !== 'synthetic') return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>DEV — SYNTHETIC DATA</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#F4F6F9',
    paddingVertical: 3,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E3E8EF',
  },
  text: {
    color: Colors.light.textSecondary,
    fontSize: TextSize.xs,
    fontWeight: TextWeight.semibold,
    letterSpacing: TextTracking.wide,
  },
});
