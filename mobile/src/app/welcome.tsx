import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageGradient } from '@/components/page-gradient';
import { markWelcomeSeen } from '@/hooks/use-welcome-seen';
import { Colors, Spacing, TextSize, TextTracking } from '@/constants/theme';

/**
 * Welcome screen — first launch only (owner call 2026-07-11:
 * SKIPPABLE gate). Sign-in methods locked as Apple + Google + email/
 * password, all via Firebase Auth at Phase 5/6 (register #16);
 * credentials live with Firebase, never in our own DB. Until auth
 * ships the provider buttons are honest placeholders: tapping shows
 * the "later build" note instead of pretending to work.
 */

export default function WelcomeScreen() {
  const router = useRouter();
  const [authNote, setAuthNote] = useState(false);

  // Flipping the flag flips the root layout's Stack.Protected guards —
  // the router unwinds this screen and lands on (tabs) by itself; an
  // extra replace('/') would race the guard swap.
  const enter = () => markWelcomeSeen();

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
      <PageGradient />

      <View style={styles.brandBlock}>
        <View style={styles.logoTilt}>
          <Ionicons name="finger-print-outline" size={56} color={Colors.light.text} />
        </View>
        <Text style={styles.wordmark}>RUGBYMETRICS</Text>
        <Text style={styles.strapline}>Match analysis · Stats · Predictions</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => setAuthNote(true)}
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
          style={({ pressed }) => [styles.button, styles.buttonApple, pressed && styles.pressed]}>
          <Ionicons name="logo-apple" size={18} color={Colors.light.textInverse} />
          <Text style={[styles.buttonText, styles.buttonTextInverse]}>Continue with Apple</Text>
        </Pressable>
        <Pressable
          onPress={() => setAuthNote(true)}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          style={({ pressed }) => [styles.button, styles.buttonOutline, pressed && styles.pressed]}>
          <Ionicons name="logo-google" size={16} color={Colors.light.text} />
          <Text style={styles.buttonText}>Continue with Google</Text>
        </Pressable>
        <Pressable
          onPress={() => setAuthNote(true)}
          accessibilityRole="button"
          accessibilityLabel="Continue with email"
          style={({ pressed }) => [styles.button, styles.buttonQuiet, pressed && styles.pressed]}>
          <Ionicons name="mail-outline" size={16} color={Colors.light.text} />
          <Text style={styles.buttonText}>Continue with Email</Text>
        </Pressable>

        {authNote ? (
          <Text style={styles.authNote}>Accounts arrive in a later build — continue below.</Text>
        ) : null}

        <Pressable
          onPress={enter}
          accessibilityRole="button"
          accessibilityLabel="Continue without an account"
          style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
          <Text style={styles.skipText}>Continue without an account</Text>
        </Pressable>
      </View>

      <View style={styles.legalRow}>
        <Text style={styles.legalText}>
          By continuing you agree to the{' '}
          <Text style={styles.legalLink} onPress={() => router.push('/legal/terms')}>
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text style={styles.legalLink} onPress={() => router.push('/legal/privacy')}>
            Privacy Policy
          </Text>
          .
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: Spacing.five,
  },
  brandBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  logoTilt: {
    transform: [{ rotate: '10deg' }],
    marginBottom: Spacing.one,
  },
  wordmark: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: 44,
    color: Colors.light.text,
  },
  strapline: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    letterSpacing: TextTracking.wide,
    textTransform: 'uppercase',
    color: Colors.light.textSecondary,
  },

  actions: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 48,
    borderRadius: 12,
  },
  buttonApple: {
    backgroundColor: Colors.light.text,
  },
  buttonOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C7CBD1',
  },
  buttonQuiet: {
    backgroundColor: '#F3F4F6',
  },
  buttonText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 14,
    color: Colors.light.text,
  },
  buttonTextInverse: {
    color: Colors.light.textInverse,
  },
  authNote: {
    textAlign: 'center',
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  skip: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  skipText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  pressed: { opacity: 0.6 },

  legalRow: {
    paddingBottom: Spacing.three,
  },
  legalText: {
    textAlign: 'center',
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.xs,
    lineHeight: 15,
    color: Colors.light.textSecondary,
  },
  legalLink: {
    color: Colors.light.text,
  },
});
