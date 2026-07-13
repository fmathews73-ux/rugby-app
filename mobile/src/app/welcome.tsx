import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { ChartDoodleBackdrop } from '@/components/chart-doodle-backdrop';
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

/** The official four-colour Google "G" (Google's sign-in branding
 *  requires the multicolour mark on provider buttons). */
function GoogleG({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
      />
      <Path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"
      />
      <Path
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1022-1.17.2822-1.71V4.9582H.9573A8.9965 8.9965 0 000 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z"
      />
      <Path
        fill="#EA4335"
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
      />
    </Svg>
  );
}

/** Welcome background options (owner A/B trial 2026-07-13):
 *  'pitch'    — option 1: full pitch composition (committed 648fd2e).
 *  'gradient' — option 2: three-green vertical gradient, doodles
 *               full-bleed, everything else identical. */
const BG_OPTION: 'pitch' | 'gradient' = 'gradient';

// Option 2's three greens, top → bottom: lit crown, base turf, deep
// shadow — same family as the pitch composition's tones.
const GRADIENT_GREENS = ['#1E7A3F', '#176D37', '#0F4A25'] as const;

// Pitch asset geometry — used to compute the on-screen field rect so
// the doodles clip to the pitch's own boundary lines (owner call
// 2026-07-11: no doodles outside the circumference). Boundary
// fractions measured from the asset's pixels.
const PITCH_IMG = { w: 1332, h: 2400 };
const PITCH_BOUNDS = { left: 0.036, right: 0.964, top: 0.035, bottom: 0.963 };

export default function WelcomeScreen() {
  const router = useRouter();
  const [authNote, setAuthNote] = useState(false);
  const [layout, setLayout] = useState<{ w: number; h: number } | null>(null);

  // fill-fit (owner call 2026-07-11: stretch vertically so the dead
  // green above/below matches the flanks) — the image spans the whole
  // container, so the field rect and the 22m anchor are the measured
  // asset fractions applied directly to the layout.
  const geom = (() => {
    if (!layout) return null;
    return {
      fieldRect: {
        left: layout.w * PITCH_BOUNDS.left,
        top: layout.h * PITCH_BOUNDS.top,
        width: layout.w * (PITCH_BOUNDS.right - PITCH_BOUNDS.left),
        height: layout.h * (PITCH_BOUNDS.bottom - PITCH_BOUNDS.top),
      },
      y22: layout.h * 0.277,
    };
  })();


  // Flipping the flag flips the root layout's Stack.Protected guards —
  // the router unwinds this screen and lands on (tabs) by itself; an
  // extra replace('/') would race the guard swap.
  const enter = () => markWelcomeSeen();

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
      {/* Mowing bands (owner call 2026-07-11): nine bands — five keep
          the base turf green, four sit one shade lighter between
          them. Clipped to the pitch circumference like the doodles;
          behind the pitch artwork. */}
      {BG_OPTION === 'pitch' ? (
        <>
          {geom ? (
            <View
              style={[styles.doodleClip, geom.fieldRect, { backgroundColor: '#176D37' }]}
              pointerEvents="none">
              {Array.from({ length: 9 }).map((_, i) => (
                <View
                  key={i}
                  style={{ flex: 1, backgroundColor: i % 2 === 0 ? 'transparent' : '#1E7A3F' }}
                />
              ))}
            </View>
          ) : null}
          {/* Licensed pitch artwork (owner asset, 2026-07-11) — portrait
              aerial field, try lines top and bottom, flank numbers along
              the touchlines, fill-stretched, 16% whisper. */}
          <Image
            source={require('@/assets/images/pitch-background.png')}
            style={[StyleSheet.absoluteFill, { opacity: 0.16 }]}
            contentFit="fill"
            pointerEvents="none"
          />
        </>
      ) : (
        // Option 2: three-green vertical gradient, no pitch layers.
        <LinearGradient
          colors={GRADIENT_GREENS as unknown as [string, string, string]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {/* Doodles — clipped to the pitch circumference in option 1,
          full-bleed over the gradient in option 2. The wrapper also
          measures the layout that drives the brand anchor. */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        onLayout={(e) =>
          setLayout({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }>
        {BG_OPTION === 'gradient' ? (
          <ChartDoodleBackdrop ink="#FFFFFF" opacity={0.16} />
        ) : geom ? (
          <View style={[styles.doodleClip, geom.fieldRect]}>
            <ChartDoodleBackdrop ink="#FFFFFF" opacity={0.16} />
          </View>
        ) : null}
      </View>

      {/* Brand block OVERLAYS the upper 22m line (owner call
          2026-07-11) — the wordmark's centre rides the measured line
          position, so it lands identically on any device. */}
      {geom ? (
        <View style={[styles.brandBlock, { top: geom.y22 - 26 }]} pointerEvents="none">
          <View style={styles.logoTilt}>
            <Ionicons name="finger-print-outline" size={48} color="#FFFFFF" />
          </View>
          <Text style={styles.wordmark}>RUGBYMETRICS</Text>
          <Text style={styles.strapline}>Match analysis · Stats · Predictions</Text>
        </View>
      ) : null}
      <View style={styles.fieldSpacer} />

      <View style={styles.actions}>
        <Pressable
          onPress={() => setAuthNote(true)}
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
          style={({ pressed }) => [styles.button, styles.buttonOutline, pressed && styles.pressed]}>
          <Ionicons name="logo-apple" size={18} color={Colors.light.text} />
          <Text style={styles.buttonText}>Continue with Apple</Text>
        </Pressable>
        <Pressable
          onPress={() => setAuthNote(true)}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          style={({ pressed }) => [styles.button, styles.buttonOutline, pressed && styles.pressed]}>
          <GoogleG size={16} />
          <Text style={styles.buttonText}>Continue with Google</Text>
        </Pressable>
        <Pressable
          onPress={() => setAuthNote(true)}
          accessibilityRole="button"
          accessibilityLabel="Continue with email"
          style={({ pressed }) => [styles.button, styles.buttonOutline, pressed && styles.pressed]}>
          <Ionicons name="mail-outline" size={16} color={Colors.light.text} />
          <Text style={styles.buttonText}>Continue with Email</Text>
        </Pressable>

        {authNote ? (
          <Text style={styles.authNote}>Accounts arrive in a later build — continue below.</Text>
        ) : null}

        {/* Guest path — a proper button (owner call 2026-07-13), in a
            ghost register so it reads as a different kind of door
            than the three provider sign-ins. */}
        <Pressable
          onPress={enter}
          accessibilityRole="button"
          accessibilityLabel="Continue as guest"
          style={({ pressed }) => [styles.button, styles.buttonGhost, pressed && styles.pressed]}>
          <Text style={[styles.buttonText, styles.buttonTextGhost]}>Continue as Guest</Text>
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
    // Surround sits two stops darker than the field (broadcast
    // grammar: the pitch is the lit thing) — the in-field base green
    // (#176D37) comes from the bands layer underlay below.
    backgroundColor: '#12552B',
    paddingHorizontal: Spacing.five,
  },
  brandBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 2,
  },
  logoTilt: {
    transform: [{ rotate: '10deg' }],
    marginBottom: 2,
  },
  fieldSpacer: { flex: 1 },
  doodleClip: {
    position: 'absolute',
    overflow: 'hidden',
  },
  wordmark: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: 46,
    color: '#FFFFFF',
  },
  strapline: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    letterSpacing: TextTracking.wide,
    textTransform: 'uppercase',
    // Legibility over the green ground (grey drowned in the stripes).
    color: 'rgba(255,255,255,0.9)',
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
  buttonOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C7CBD1',
  },
  buttonText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 14,
    color: Colors.light.text,
  },
  authNote: {
    textAlign: 'center',
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    color: 'rgba(255,255,255,0.9)',
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  buttonTextGhost: {
    color: '#FFFFFF',
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
    color: 'rgba(255,255,255,0.8)',
  },
  legalLink: {
    color: '#FFFFFF',
  },
});
