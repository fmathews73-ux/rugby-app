import { Barlow_400Regular, Barlow_500Medium, Barlow_500Medium_Italic, Barlow_600SemiBold } from '@expo-google-fonts/barlow';
import { BarlowCondensed_700Bold_Italic, useFonts } from '@expo-google-fonts/barlow-condensed';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

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

  // Display font (Barlow Condensed Bold Italic — nation codes and
  // other sport-display moments) loads at runtime; the brand wordmark
  // font (Anton) is embedded natively via the expo-font config plugin
  // (app.json).
  const [fontsLoaded, fontError] = useFonts({
    BarlowCondensed_700Bold_Italic,
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_500Medium_Italic,
    Barlow_600SemiBold,
  });

  // Splash-screen hide. `preventAutoHideAsync()` above holds the splash
  // until React has mounted; without a matching `hideAsync()` the app
  // shows the launch screen forever. `AnimatedSplashOverlay` was
  // intended to own this handoff but isn't rendered anywhere in the
  // tree, so we hide directly here — gated on the font so text never
  // flashes from the fallback face.
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

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

  // Hold the whole tree until fonts are in. Text mounted before the
  // font loads paints in the system fallback and never re-renders
  // (navigator/screen memoization blocks the root re-render), so the
  // wordmark and card titles were stuck on the fallback face.
  // Proceed on error too — a failed font load falls back to system
  // faces rather than hanging on a blank screen forever.
  if (!fontsLoaded && !fontError) return null;

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
