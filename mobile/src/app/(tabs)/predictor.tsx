import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageGradient } from '@/components/page-gradient';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';

/**
 * Predictor — ML-driven match + tournament winner predictions.
 *
 * ─── PHASE STUB — TODO(#predictor-ml) ────────────────────────────────
 * Screen is a placeholder in Phase 0–5. The real Predictor requires:
 *
 *   • A trained model (rugby-specific ELO variant, gradient-boosted
 *     tree, or small neural net — decision open) served from the
 *     personal GCP project rugby-mobile-app.
 *   • A feature pipeline computing team form, ranking, head-to-head
 *     record, home advantage, injury / squad rotation signals, and
 *     competition-context features from cached fixture data.
 *   • Server-side inference route (Cloud Run) so the model weights
 *     never ship in the app bundle and can be retrained without a
 *     store submission.
 *   • Calibrated probabilities (Brier / log-loss on held-out matches)
 *     with uncertainty bands, not point estimates dressed up as facts.
 *
 * Full phase brief: `docs/predictor-phase-spec.md`.
 *
 * Same guardrails as the analysis narrative path (root CLAUDE.md §8):
 * client never holds model weights or an inference key; inference is a
 * server-side call in the personal GCP project; no inference against
 * real player names until image / name licensing clears (Phase 6).
 */
export default function PredictorScreen() {
  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      <PageGradient />
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles-outline" size={40} color={Colors.light.textSecondary} />
        </View>
        <Text style={styles.title}>Predictor</Text>
        <Text style={styles.subtitle}>
          ML-driven match and tournament winner predictions with calibrated
          probabilities.
        </Text>
        <View style={styles.phasePill}>
          <Text style={styles.phasePillLabel}>Phase 6</Text>
        </View>
        <Text style={styles.note}>
          Model design, feature pipeline and server-side inference land in
          Phase 6 (see docs/predictor-phase-spec.md). Wired as a tab entry
          point in advance so the IA is stable.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  iconWrap: {
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: TextSize.xl,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  phasePill: {
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  phasePillLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  note: {
    marginTop: Spacing.two,
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 340,
    fontStyle: 'italic',
  },
});
