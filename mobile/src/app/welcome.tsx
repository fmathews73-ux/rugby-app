import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { ChartDoodleBackdrop, FINGERPRINT_PATH } from '@/components/chart-doodle-backdrop';
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

/** The official Google "G" — four-colour by default; pass `color`
 *  for a monochrome variant (owner call 2026-07-13: white G on the
 *  green sheet button). */
function GoogleG({ size = 16, color }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path
        fill={color ?? '#4285F4'}
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
      />
      <Path
        fill={color ?? '#34A853'}
        d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"
      />
      <Path
        fill={color ?? '#FBBC05'}
        d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1022-1.17.2822-1.71V4.9582H.9573A8.9965 8.9965 0 000 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z"
      />
      <Path
        fill={color ?? '#EA4335'}
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
 *               the brand block.
 *  'burst'    — option 5 (owner artwork 2026-07-14): the light-burst
 *               composition rasterised from the supplied Illustrator
 *               SVG (its screen-blend gradients can't render in
 *               react-native-svg) — silver beams + sparkles over the
 *               green sweep. No doodles, no spotlight: the artwork
 *               carries the drama. */
/** 'split' — option 6 (owner call 2026-07-16): the APP ICON's ground
 *  at full screen — light pitch green over deep ink, one hard
 *  diagonal from 25% up the left edge to 25% down the right, echoing
 *  pitch line markings. Brand block goes white/silver over it. */
const BG_OPTION: 'pitch' | 'gradient' | 'charcoal' | 'radial-field' | 'burst' | 'split' =
  'split';

// Option 2's greens, top → bottom — FLIPPED (owner call 2026-07-13:
// dark crown falling to a lit base) and widened to five stops, the
// ends pushed one step deeper/brighter than the original trio.
const GRADIENT_GREENS = ['#0A3D1E', '#0F4A25', '#176D37', '#1E7A3F', '#27904C'] as const;

// Option 3's charcoals, top → bottom — the dark-terminal ground.
const CHARCOALS = ['#1B1D21', '#101114', '#0A0B0D'] as const;

// The broadcast pitch ramp (owner arc 2026-07-14): the wordmark's
// dark zone (#124E1B→#1D6423) and light zone (#4DA344→#5CB04E) with
// an interpolated mid stop — one green system for the brand block,
// the artwork's sweep and the sign-in doors.
const PITCH_GREENS = ['#124E1B', '#1D6423', '#358333', '#4DA344', '#5CB04E'] as const;

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
  const insets = useSafeAreaInsets();

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
    // No top/bottom safe edges — the label frame runs the full screen
    // height (owner call 2026-07-14); the legal row carries the home-
    // indicator inset itself.
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      {/* Mowing bands (owner call 2026-07-11): nine bands — five keep
          the base turf green, four sit one shade lighter between
          them. Clipped to the pitch circumference like the doodles;
          behind the pitch artwork. */}
      {BG_OPTION === 'split' ? (
        // Option 6: the icon's split ground, computed in real pixels
        // so the divide runs exactly 0.75h-left → 0.25h-right on any
        // device (no viewBox stretching, per the chart rules).
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {layout ? (
            (() => {
              const { w, h } = layout;
              // The ICON's slope (26.6° — drop of half the width),
              // centred on mid-height. The dark zone is a real
              // POLYGON, not a gradient hard-stop — a vector edge is
              // razor sharp where duplicate stops still feathered
              // ~2pt across the gradient run (owner call 2026-07-16:
              // "make the dividing line sharper").
              const pl = Math.hypot(0.5 * w, w);
              const ux = (0.5 * w) / pl;
              const uy = w / pl;
              const s = 0.55 * h;
              const yLeft = h / 2 + 0.25 * w;
              const yRight = h / 2 - 0.25 * w;
              return (
                <Svg width="100%" height="100%">
                  <Defs>
                    <SvgLinearGradient
                      id="ground-light"
                      gradientUnits="userSpaceOnUse"
                      x1={w / 2 - ux * s}
                      y1={h / 2 - uy * s}
                      x2={w / 2}
                      y2={h / 2}>
                      <Stop offset="0" stopColor="#5CB04E" />
                      <Stop offset="1" stopColor="#4DA344" />
                    </SvgLinearGradient>
                    <SvgLinearGradient
                      id="ground-dark"
                      gradientUnits="userSpaceOnUse"
                      x1={w / 2}
                      y1={h / 2}
                      x2={w / 2 + ux * s}
                      y2={h / 2 + uy * s}>
                      <Stop offset="0" stopColor="#1D6423" />
                      <Stop offset="1" stopColor="#124E1B" />
                    </SvgLinearGradient>
                  </Defs>
                  <Rect x={0} y={0} width="100%" height="100%" fill="url(#ground-light)" />
                  <Polygon
                    points={`0,${yLeft} ${w},${yRight} ${w},${h} 0,${h}`}
                    fill="url(#ground-dark)"
                  />
                </Svg>
              );
            })()
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#4DA344' }]} />
          )}
        </View>
      ) : BG_OPTION === 'burst' ? (
        // Option 5: the artwork full-bleed edge to edge. The white
        // circumference frame was trialled and CANCELLED (owner call
        // 2026-07-14): display corner radii differ per device and
        // aren't queryable, so square full-bleed is the only render
        // that's identical everywhere. fill-stretch — the asset is
        // cut to phone aspect, so distortion is negligible.
        <Image
          source={require('@/assets/images/welcome-burst.jpg')}
          style={StyleSheet.absoluteFill}
          contentFit="fill"
          pointerEvents="none"
        />
      ) : BG_OPTION === 'pitch' ? (
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
        // Options 2/4: vertical dark → light → dark over SEVEN stops
        // biased to the darker shades (owner call 2026-07-13) — the
        // peak caps at the second-lightest green and the shoulders
        // linger in the deep end of the ramp.
        <LinearGradient
          colors={[
            GRADIENT_GREENS[0],
            GRADIENT_GREENS[1],
            GRADIENT_GREENS[2],
            GRADIENT_GREENS[3],
            GRADIENT_GREENS[2],
            GRADIENT_GREENS[1],
            GRADIENT_GREENS[0],
          ]}
          locations={[0, 0.12, 0.23, 0.35, 0.55, 0.75, 1]}
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
          // Spotlit wallpaper (owner ask 2026-07-14): doodles catch
          // the stadium light — brighter than the old flat 0.16
          // inside the pool, falling toward darkness at the edges.
          <ChartDoodleBackdrop
            ink="#FFFFFF"
            opacity={0.22}
            spotlight={
              layout
                ? { cx: layout.w / 2, cy: layout.h * 0.335 + 55, r: layout.w * 0.62 }
                : undefined
            }
          />
        ) : BG_OPTION === 'pitch' && geom ? (
          <View style={[styles.doodleClip, geom.fieldRect]}>
            <ChartDoodleBackdrop ink="#FFFFFF" opacity={0.16} />
          </View>
        ) : null}
      </View>

      {/* Stadium-spotlight pool (owner ask 2026-07-14) — a soft
          white radial glow centred on the brand block, sitting OVER
          the doodles (atmospheric haze) and UNDER the brand. The
          ellipse is wider than tall — light pooling on a surface. */}
      {BG_OPTION === 'gradient' && layout ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient
                id="spotlight-pool"
                gradientUnits="userSpaceOnUse"
                cx={layout.w / 2}
                cy={layout.h * 0.335 + 55}
                rx={layout.w * 0.55}
                ry={layout.w * 0.46}>
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.16} />
                <Stop offset="0.4" stopColor="#FFFFFF" stopOpacity={0.08} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill="url(#spotlight-pool)" />
          </Svg>
        </View>
      ) : null}

      {/* Brand block raised into the top third (owner call
          2026-07-15) — the block (print + name + bars + tagline,
          ~150pt) spans roughly 0.15h → 0.33h. */}
      {geom ? (
        <View style={[styles.brandBlock, { top: layout ? layout.h * 0.22 : geom.y22 }]} pointerEvents="none">
          <View style={styles.logoTilt}>
            {/* The exact Ionicons print geometry in WHITE (owner call
                2026-07-16) — the icon's white print, mirrored on the
                split ground. */}
            <Svg width={58} height={58} viewBox="0 0 512 512">
              <Path d={FINGERPRINT_PATH} fill="#FFFFFF" />
            </Svg>
          </View>
          {/* Wordmark in the GRADIENT_GREENS ramp (owner call
              2026-07-14) — light leading into deep ink, the EXPERT
              label's left-to-right sweep. SVG text because RN Text
              cannot take a gradient fill. */}
          <Svg width={340} height={54}>
            <Defs>
              {/* The EXPERT-label two-tone (owner call 2026-07-14):
                  a LIGHT gradient zone and a DARK gradient zone split
                  by one hard diagonal running corner to corner —
                  bottom-left of the R to the top-right of the S. The
                  gradient runs top-left → bottom-right so the shared
                  0.5 stop lands exactly on that anti-diagonal. Greens
                  from the broadcast pitch ramp so the name and the
                  artwork's sweep speak one green. */}
              {/* User-space gradient perpendicular to the divide
                  line — 25% up the R's side rising to 25% down the
                  S (flattened from full corner-to-corner, owner call
                  2026-07-14) — so the hard 0.5 stop IS that line:
                  every letter splits light-over-dark around it. */}
              <SvgLinearGradient
                id="wordmark-ramp"
                gradientUnits="userSpaceOnUse"
                x1="171"
                y1="2"
                x2="174"
                y2="56">
                {/* White above the line, silver/light-grey below
                    (owner call 2026-07-16) — the green two-tone moved
                    to the ground, so the name flips to the page's
                    other material. */}
                <Stop offset="0" stopColor="#FFFFFF" />
                <Stop offset="0.499" stopColor="#F2F4F6" />
                <Stop offset="0.501" stopColor="#C9CCD1" />
                <Stop offset="1" stopColor="#AEB3BA" />
              </SvgLinearGradient>
            </Defs>
            <SvgText
              x={170}
              y={44}
              textAnchor="middle"
              fontFamily="BarlowCondensed_700Bold_Italic"
              fontSize={46}
              fill="url(#wordmark-ramp)">
              RUGBYMETRICS
            </SvgText>
          </Svg>
          {/* Miniature stats-bar row (owner call 2026-07-14) — the
              app's signature grammar as a visual cue of what's
              inside: skewed cut score boxes, centre-out diverging
              bars, the real leader-green / lagger-red pairing. */}
          <View style={styles.statsCue}>
            {/* Leader bar in white on the split ground; dark-ink bar
                trialled and reverted (owner call 2026-07-16). */}
            <View style={[styles.cueSeg, { flex: 1, backgroundColor: '#FFFFFF' }]} />
            <View style={styles.cueGap} />
            {/* The pre-match bars' near-black centre marker. */}
            <View style={styles.cueMarker} />
            <View style={styles.cueGap} />
            <View style={[styles.cueSeg, { flex: 1, backgroundColor: '#DC2626' }]} />
          </View>

          {/* Tagline in the wordmark's DARK-zone ramp (owner call
              2026-07-14) — SVG text because RN Text can't take a
              gradient fill. */}
          <Svg width={386} height={18}>
            <Defs>
              {/* White on the split ground (owner call 2026-07-16). */}
              <SvgLinearGradient id="tagline-ramp" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" />
                <Stop offset="1" stopColor="#EDEFF2" />
              </SvgLinearGradient>
            </Defs>
            <SvgText
              x={193}
              y={12}
              textAnchor="middle"
              fontFamily="WorkSans_500Medium"
              fontSize={10}
              letterSpacing={TextTracking.wide}
              fill="url(#tagline-ramp)">
              FIXTURES · MATCH ANALYSIS · STATS · PREDICTIONS
            </SvgText>
          </Svg>
        </View>
      ) : null}
      <View style={styles.fieldSpacer} />

      {/* ONE door (owner call 2026-07-13): Sign in opens the sheet;
          the guest path lives inside it. */}
      <View style={styles.actions}>
        {/* Apple-glass door (owner call 2026-07-13): real backdrop
            blur — the wallpaper diffuses into soft light under the
            button instead of being masked. */}
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          style={({ pressed }) => [styles.glassWrap, pressed && styles.pressed]}>
          {/* Silver-ribbon door (owner call 2026-07-14): the sweep's
              silver edge reborn as the button fill — white catching
              silver at the centre — with the wordmark's deep green
              as the label ink. Green fills trialled and retired. */}
          <LinearGradient
            colors={['#FFFFFF', '#DDE0E4', '#C9CCD1', '#DDE0E4', '#FFFFFF']}
            locations={[0, 0.3, 0.5, 0.7, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.glassFill}>
            <Text style={styles.buttonTextGreen}>Sign in</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <View style={[styles.legalRow, { paddingBottom: Spacing.three + insets.bottom }]}>
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

      {/* Provider bottom sheet — the four doors wear ONE continuous
          dark→light gradient (owner call 2026-07-13): each button
          renders its quarter of the five-green ramp, so the stack
          reads as a single column of light. */}
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
          {(
            [
              {
                key: 'apple',
                label: 'Continue with Apple',
                icon: <Ionicons name="logo-apple" size={18} color="#FFFFFF" />,
                onPress: () => setAuthNote(true),
              },
              {
                key: 'google',
                label: 'Continue with Google',
                icon: <GoogleG size={16} color="#FFFFFF" />,
                onPress: () => setAuthNote(true),
              },
              {
                key: 'email',
                label: 'Continue with Email',
                icon: <Ionicons name="mail" size={16} color="#FFFFFF" />,
                onPress: () => setAuthNote(true),
              },
              {
                key: 'guest',
                label: 'Continue as Guest',
                icon: <Ionicons name="american-football" size={16} color="#FFFFFF" />,
                onPress: () => {
                  setSheetOpen(false);
                  enter();
                },
              },
            ] as const
          ).map((door, i) => (
            <Pressable
              key={door.key}
              onPress={door.onPress}
              accessibilityRole="button"
              accessibilityLabel={door.label}
              style={({ pressed }) => [styles.button, styles.sheetDoor, pressed && styles.pressed]}>
              {/* Quarter i of the ramp: adjacent buttons share their
                  seam colour, so the stack is one continuous sweep. */}
              <LinearGradient
                colors={[PITCH_GREENS[i], PITCH_GREENS[i + 1]]}
                style={styles.sheetDoorFill}>
                <View style={styles.sheetBtnInner}>
                  <View style={styles.sheetBtnIcon}>{door.icon}</View>
                  <Text style={[styles.sheetButtonText, styles.sheetButtonTextInverse]}>
                    {door.label}
                  </Text>
                </View>
              </LinearGradient>
            </Pressable>
          ))}
          {authNote ? (
            <Text style={styles.sheetNote}>
              Accounts arrive in a later build — continue as guest for now.
            </Text>
          ) : null}
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
    // Tilt-along-the-divide trialled at 26.6° and 13° and REVERTED
    // (owner call 2026-07-16) — the block stays horizontal; the
    // ground alone carries the diagonal.
  },
  logoTilt: {
    transform: [{ rotate: '10deg' }],
    marginBottom: 2,
  },
  fieldSpacer: { flex: 1 },
  // The stats-bar cue as a title underline — boxes removed (owner
  // call 2026-07-14), equal green/red halves at the wordmark's width.
  statsCue: {
    flexDirection: 'row',
    alignItems: 'center',
    // Hugs the wordmark's rendered glyphs (R → S), not its canvas.
    width: 234,
    height: 2,
    // VISUALLY equal air above and below (owner call 2026-07-14):
    // the wordmark canvas carries ~6px of empty space under its
    // descenders, so the top margin goes negative to compensate.
    marginTop: -1,
    marginBottom: 5,
  },
  cueSeg: { height: 2, borderRadius: 1 },
  cueGap: { width: 3 },
  // Deep-ink marker (the black↔green tick round-trip settled here,
  // owner call 2026-07-16).
  cueMarker: { width: 2, height: 8, borderRadius: 1, backgroundColor: '#124E1B' },
  doodleClip: {
    position: 'absolute',
    overflow: 'hidden',
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
  // Pill door (owner call 2026-07-14): compact centred pill instead
  // of the full-width bar.
  glassWrap: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    alignSelf: 'center',
    width: 150,
  },
  glassFill: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'WorkSans_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  buttonTextGreen: {
    fontFamily: 'WorkSans_600SemiBold',
    fontSize: 14,
    // The wordmark's deep-ink green on the silver ribbon.
    color: '#124E1B',
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
  // One continuous gradient across the four doors — each button
  // clips its quarter of the ramp (owner call 2026-07-13).
  sheetDoor: {
    overflow: 'hidden',
  },
  sheetDoorFill: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fixed inner cluster: a common icon slot so every "Continue …"
  // label starts at the same x across the three buttons, while the
  // cluster itself stays visually centred.
  sheetBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 200,
    gap: Spacing.two,
  },
  sheetBtnIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetButtonText: {
    fontFamily: 'WorkSans_600SemiBold',
    fontSize: 14,
    color: Colors.light.text,
  },
  sheetButtonTextInverse: {
    color: Colors.light.textInverse,
  },
  sheetNote: {
    textAlign: 'center',
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  pressed: { opacity: 0.6 },

  legalRow: {
    paddingBottom: Spacing.three,
  },
  legalText: {
    textAlign: 'center',
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.xs,
    lineHeight: 15,
    color: 'rgba(255,255,255,0.8)',
  },
  legalLink: {
    color: '#FFFFFF',
  },
});
