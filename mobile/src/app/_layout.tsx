import { Anton_400Regular, useFonts } from '@expo-google-fonts/anton';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { DevModeBanner } from '@/components/dev-mode-banner';

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
  // Brand wordmark face (see AppHeader). Impact itself isn't available
  // on iOS/Android and can't be bundled without a Monotype licence;
  // Anton (OFL) is the standard substitute.
  const [fontsLoaded] = useFonts({ Anton_400Regular });

  // Splash-screen hide. `preventAutoHideAsync()` above holds the splash
  // until React has mounted; without a matching `hideAsync()` the app
  // shows the launch screen forever. `AnimatedSplashOverlay` was
  // intended to own this handoff but isn't rendered anywhere in the
  // tree, so we hide directly here after the first render (once the
  // wordmark font is in, so the header doesn't flash a fallback face).
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

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
              </Stack>
            </View>
          </SafeAreaProvider>
      </ThemeProvider>
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
