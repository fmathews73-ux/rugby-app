import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useMemo } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { DevModeBanner } from '@/components/dev-mode-banner';
import { SimLiveProvider } from '@/dev/sim-live';

SplashScreen.preventAutoHideAsync();

/**
 * Root layout. A Stack wraps the (tabs) group + detail routes so
 * `router.push('/teams/{id}')` and `router.push('/fixtures/{id}')` from any
 * tab properly slide a new screen in.
 *
 * DevModeBanner sits above the Stack so it stays visible on every screen —
 * including detail pushes.
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
      <SimLiveProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <SafeAreaProvider>
            <SafeAreaView edges={['top']} style={styles.bannerSafeArea}>
              <DevModeBanner />
            </SafeAreaView>
            <View style={styles.appBody}>
              <Stack
                // Detail-screen defaults: custom BackButton in place of the
                // system iOS-blue chevron + back title. Empty screen title so
                // the header carries no wordmark — content owns the top of
                // the screen.
                screenOptions={{
                  headerLeft: () => <BackButton />,
                  headerBackVisible: false, // hide the default back button
                  title: '',
                }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="team/[id]" />
                <Stack.Screen name="fixture/[id]" />
              </Stack>
            </View>
          </SafeAreaProvider>
        </ThemeProvider>
      </SimLiveProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  bannerSafeArea: {
    backgroundColor: '#F3F4F6',
  },
  appBody: {
    flex: 1,
  },
});
