import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useMemo } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { DevModeBanner } from '@/components/dev-mode-banner';

SplashScreen.preventAutoHideAsync();

/**
 * Root layout. Stack wraps everything so team detail (and later, fixture
 * detail) can push above the tabs. The `(tabs)` group is one Stack screen;
 * `teams/[id]` is another.
 *
 * Dev-mode banner sits above the Stack so it's visible on every screen —
 * including modal pushes.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
    [],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <SafeAreaProvider>
          <SafeAreaView edges={['top']} style={styles.bannerSafeArea}>
            <DevModeBanner />
          </SafeAreaView>
          <View style={styles.appBody}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="teams/[id]"
                options={{
                  headerShown: true,
                  headerBackTitle: 'Teams',
                  title: '',
                }}
              />
            </Stack>
          </View>
        </SafeAreaProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  bannerSafeArea: {
    backgroundColor: '#B45309',
  },
  appBody: {
    flex: 1,
  },
});
