import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Line, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

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

/** Welcome background options (owner A/B/C trial 2026-07-13):
 *  'pitch'    — option 1: full pitch composition (committed 648fd2e).
 *  'gradient' — option 2: three-green vertical gradient, doodles
 *               full-bleed, everything else identical.
 *  'charcoal' — option 3 "The Terminal": deep charcoal gradient,
 *               wallpaper at a whisper, giant ghosted radar watermark
 *               behind the brand — monochrome BI instrument.
 *  'radial-field' — option 4: option 2's radial ground, NO doodles,
 *               the pitch artwork shrunk to an emblem centred behind
 *               the brand block. */
const BG_OPTION: 'pitch' | 'gradient' | 'charcoal' | 'radial-field' = 'gradient';

// Option 2's greens, top → bottom — FLIPPED (owner call 2026-07-13:
// dark crown falling to a lit base) and widened to five stops, the
// ends pushed one step deeper/brighter than the original trio.
const GRADIENT_GREENS = ['#0A3D1E', '#0F4A25', '#176D37', '#1E7A3F', '#27904C'] as const;

// Option 3's charcoals, top → bottom — the dark-terminal ground.
const CHARCOALS = ['#1B1D21', '#101114', '#0A0B0D'] as const;

/** Option 3's watermark — the six-lobe radar ghosted at billboard
 *  scale: two rings, spokes, and the familiar irregular shape. */
function RadarWatermark({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const ring = (radius: number) =>
    [0, 60, 120, 180, 240, 300]
      .map((deg) => {
        const a = (deg * Math.PI) / 180;
        return `${cx + radius * Math.cos(a)},${cy + radius * Math.sin(a)}`;
      })
      .join(' ');
  const spokes = [0, 60, 120].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return {
      x1: cx - r * Math.cos(a),
      y1: cy - r * Math.sin(a),
      x2: cx + r * Math.cos(a),
      y2: cy + r * Math.sin(a),
    };
  });
  const shape = [
    [0.7, 10], [0.55, 70], [0.85, 130], [0.6, 190], [0.75, 250], [0.5, 310],
  ]
    .map(([f, deg]) => {
      const a = (deg * Math.PI) / 180;
      return `${cx + r * f * Math.cos(a)},${cy + r * f * Math.sin(a)}`;
    })
    .join(' ');
  return (
    <Svg width="100%" height="100%" pointerEvents="none">
      <Polygon points={ring(r)} stroke="rgba(255,255,255,0.06)" strokeWidth={1.5} fill="none" />
      <Polygon points={ring(r / 2)} stroke="rgba(255,255,255,0.06)" strokeWidth={1.5} fill="none" />
      {spokes.map((s, i) => (
        <Line key={i} {...s} stroke="rgba(255,255,255,0.05)" strokeWidth={1.5} />
      ))}
      <Polygon points={shape} stroke="rgba(255,255,255,0.09)" strokeWidth={1.5} fill="rgba(255,255,255,0.03)" />
    </Svg>
  );
}

// Pitch asset geometry — used to compute the on-screen field rect so
// the doodles clip to the pitch's own boundary lines (owner call
// 2026-07-11: no doodles outside the circumference). Boundary
// fractions measured from the asset's pixels.
const PITCH_IMG = { w: 1332, h: 2400 };
const PITCH_BOUNDS = { left: 0.036, right: 0.964, top: 0.035, bottom: 0.963 };

export default function WelcomeScreen() {
  const router = useRouter();
  const [authNote, setAuthNote] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
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
      ) : BG_OPTION === 'gradient' || BG_OPTION === 'radial-field' ? (
        // Options 2/4: vertical dark → light → dark (owner calls
        // 2026-07-13) — the lit band sits at the brand block's
        // height, deep turf at both ends.
        <LinearGradient
          colors={[GRADIENT_GREENS[0], GRADIENT_GREENS[4], GRADIENT_GREENS[0]]}
          locations={[0, 0.35, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : (
        // Option 3: charcoal vertical gradient ground.
        <LinearGradient
          colors={CHARCOALS as unknown as [string, string, string]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {/* Option 3's ghosted radar billboard behind the brand block. */}
      {BG_OPTION === 'charcoal' && layout ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <RadarWatermark cx={layout.w / 2} cy={layout.h * 0.31} r={layout.w * 0.52} />
        </View>
      ) : null}
      {/* Option 4's pitch emblem — the field artwork shrunk and
          centred behind the brand block (owner call 2026-07-13). */}
      {BG_OPTION === 'radial-field' && layout
        ? (() => {
            const emblemW = layout.w * 0.375;
            const emblemH = emblemW * (2400 / 1332);
            return (
              <Image
                source={require('@/assets/images/pitch-background.png')}
                style={{
                  position: 'absolute',
                  width: emblemW,
                  height: emblemH,
                  left: (layout.w - emblemW) / 2,
                  // Net +5% of screen height below the brand anchor
                  // (owner calls 2026-07-13: dropped 10%, raised 5%).
                  top: layout.h * 0.327 + 8 - emblemH / 2,
                  opacity: 0.2,
                }}
                contentFit="fill"
                pointerEvents="none"
              />
            );
          })()
        : null}
      {/* Doodles — clipped to the pitch circumference in option 1,
          full-bleed over the gradient in option 2. The wrapper also
          measures the layout that drives the brand anchor. */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        onLayout={(e) =>
          setLayout({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }>
        {BG_OPTION === 'charcoal' ? (
          // Terminal mode: the wallpaper drops to a whisper — texture
          // you sense more than read.
          <ChartDoodleBackdrop ink="#FFFFFF" opacity={0.06} />
        ) : BG_OPTION === 'gradient' ? (
          <ChartDoodleBackdrop ink="#FFFFFF" opacity={0.16} />
        ) : BG_OPTION === 'pitch' && geom ? (
          <View style={[styles.doodleClip, geom.fieldRect]}>
            <ChartDoodleBackdrop ink="#FFFFFF" opacity={0.16} />
          </View>
        ) : null}
      </View>

      {/* Brand block OVERLAYS the upper 22m line (owner call
          2026-07-11) — the wordmark's centre rides the measured line
          position, so it lands identically on any device. */}
      {geom ? (
        <View style={[styles.brandBlock, { top: geom.y22 - 2 }]} pointerEvents="none">
          <View style={styles.logoTilt}>
            <Ionicons name="finger-print-outline" size={48} color="#FFFFFF" />
          </View>
          <Text style={styles.wordmark}>RUGBYMETRICS</Text>
          <Text style={styles.strapline}>Match analysis · Stats · Predictions</Text>
        </View>
      ) : null}
      <View style={styles.fieldSpacer} />

      {/* ONE door (owner call 2026-07-13): Sign in opens the sheet;
          the guest path lives inside it. */}
      <View style={styles.actions}>
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          style={({ pressed }) => [styles.button, styles.buttonOutline, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>Sign in</Text>
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

      {/* Provider bottom sheet — the three sign-in doors, one tap
          away. White sheet in the app's light grammar; providers wear
          their classic light-surface styles (Apple black, Google
          white-keyline, Email quiet grey). */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}>
        <Pressable
          style={styles.sheetBackdrop}
          accessibilityRole="button"
          accessibilityLabel="Close sign-in options"
          onPress={() => setSheetOpen(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetGrabber} />
          <Text style={styles.sheetTitle}>Sign in</Text>
          <Pressable
            onPress={() => setAuthNote(true)}
            accessibilityRole="button"
            accessibilityLabel="Continue with Apple"
            style={({ pressed }) => [styles.button, styles.sheetApple, pressed && styles.pressed]}>
            <Ionicons name="logo-apple" size={18} color="#FFFFFF" />
            <Text style={[styles.sheetButtonText, styles.sheetButtonTextInverse]}>
              Continue with Apple
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setAuthNote(true)}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            style={({ pressed }) => [styles.button, styles.sheetGoogle, pressed && styles.pressed]}>
            <GoogleG size={16} />
            <Text style={styles.sheetButtonText}>Continue with Google</Text>
          </Pressable>
          <Pressable
            onPress={() => setAuthNote(true)}
            accessibilityRole="button"
            accessibilityLabel="Continue with email"
            style={({ pressed }) => [styles.button, styles.sheetEmail, pressed && styles.pressed]}>
            <Ionicons name="mail-outline" size={16} color={Colors.light.text} />
            <Text style={styles.sheetButtonText}>Continue with Email</Text>
          </Pressable>
          {authNote ? (
            <Text style={styles.sheetNote}>
              Accounts arrive in a later build — continue as guest for now.
            </Text>
          ) : null}
          {/* Guest path lives in the sheet (owner call 2026-07-13) —
              quiet text door under the providers. */}
          <Pressable
            onPress={() => {
              setSheetOpen(false);
              enter();
            }}
            accessibilityRole="button"
            accessibilityLabel="Continue as guest"
            style={({ pressed }) => [styles.sheetGuest, pressed && styles.pressed]}>
            <Text style={styles.sheetGuestText}>Continue as Guest</Text>
          </Pressable>
        </View>
      </Modal>
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
    // Sits just above the legal line with a 16pt separation
    // (owner call 2026-07-13).
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
  // Frosted register (owner call 2026-07-13: solid white was
  // glaring on the dark ground) — translucent fill, soft keyline,
  // white content.
  buttonOutline: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  buttonText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  sheetGrabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#C7CBD1',
    marginBottom: Spacing.one,
  },
  sheetTitle: {
    textAlign: 'center',
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    textTransform: 'uppercase',
    color: Colors.light.textSecondary,
    marginBottom: Spacing.one,
  },
  sheetApple: {
    backgroundColor: Colors.light.text,
  },
  sheetGoogle: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C7CBD1',
  },
  sheetEmail: {
    backgroundColor: '#F3F4F6',
  },
  sheetButtonText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 14,
    color: Colors.light.text,
  },
  sheetButtonTextInverse: {
    color: Colors.light.textInverse,
  },
  sheetNote: {
    textAlign: 'center',
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  sheetGuest: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    marginTop: Spacing.one,
  },
  sheetGuestText: {
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
    color: 'rgba(255,255,255,0.8)',
  },
  legalLink: {
    color: '#FFFFFF',
  },
});
