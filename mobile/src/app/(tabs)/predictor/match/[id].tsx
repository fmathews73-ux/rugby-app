import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFixture, useMatchPrediction, useTeams, useCompetitions } from '@/api/hooks';
import { CardHeaderActions } from '@/components/card-header-actions';
import { CardTitle } from '@/components/card-title';
import { MatchupHeader } from '@/components/fixture-drill/matchup-header';
import { FadeCard, NarrativeBack, BackStrong } from '@/components/narrative-flip-card';
import { ErrorState, LoadingState } from '@/components/state-views';
import { PageGradient } from '@/components/page-gradient';
import { PAGE_BOTTOM_INSET, Colors, Spacing, TextSize, TextTracking } from '@/constants/theme';

/**
 * Match prediction drill — split probability bar, predicted margin
 * band, and the model's top drivers, per the spec §6 presentation.
 * Home/away wear the app-wide match-chart pairing (home blue / away
 * purple). Numbers are the synthetic ranking-implied preview until
 * the Phase 6 BigQuery ML cutover (spec §2d).
 */

// The house semantic pair (peer-bar grammar): favourite = green,
// underdog = red (owner call 2026-07-13, replacing the home-blue /
// away-purple identity pairing — a prediction is a verdict, not a
// venue).
const FAV_COLOR = '#059669';
const DOG_COLOR = '#DC2626';

const PREDICTION_ABOUT = (
  <>
    The bar splits one hundred replays of this match:{' '}
    <BackStrong>a 78% side wins 78 of them and still loses the other
    22</BackStrong>. The margin band shows where the middle half of
    those replays finish; the drivers are the inputs pushing the
    probability — bars toward a side favour that side. Until the real
    model lands at cutover these are ranking-implied preview numbers on
    development data, so treat the shape, not the digits, as the story.
  </>
);

/**
 * The fixture stats-pane row anatomy, verbatim: centred muted label,
 * 44×22 value boxes, 4pt centre-out diverging bars with a centre gap,
 * leading side green / lagging red, leading box dark.
 */
function StatRow({
  label,
  home,
  away,
  homeFlex,
  awayFlex,
  homeLeads,
  tie,
}: {
  label: string;
  home: string;
  away: string;
  homeFlex: number;
  awayFlex: number;
  homeLeads: boolean;
  /** Dead heat — both boxes quiet (the app-wide draw law). */
  tie?: boolean;
}) {
  const total = Math.max(homeFlex + awayFlex, 1);
  const MAX_FILL = 0.85;
  const homeSeg = (homeFlex / total) * MAX_FILL;
  const awaySeg = (awayFlex / total) * MAX_FILL;
  const homeColor = homeFlex === 0 ? 'transparent' : homeLeads ? FAV_COLOR : DOG_COLOR;
  const awayColor = awayFlex === 0 ? 'transparent' : homeLeads ? DOG_COLOR : FAV_COLOR;
  // EXPERIMENT (owner call 2026-07-13): winner-side boxes = light
  // green bg + dark green value; loser-side = light red bg + dark
  // red value. Empty/dash boxes stay neutral.
  // Winner boxes dark, everything else quiet — the app-wide score-box
  // pairing (settled after green/red box trials 2026-07-13: colour
  // lives in the BARS, values stay neutral).
  const homeWins = !tie && homeLeads && home !== '' && home !== '—';
  const awayWins = !tie && !homeLeads && away !== '' && away !== '—';

  return (
    <View style={styles.statBlock}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statBarRow}>
        <View
          style={[
            styles.statValueBox,
            homeWins && styles.statValueBoxWin,
            home === '' && styles.statValueBoxEmpty,
          ]}>
          {home !== '' ? (
            <Text style={[styles.statValue, homeWins && styles.statValueTextWin]}>{home}</Text>
          ) : null}
        </View>
        <View style={styles.barTrack}>
          <View style={styles.barHalfLeft}>
            <View style={[styles.barSeg, { flex: homeSeg, backgroundColor: homeColor }]} />
            <View style={{ flex: Math.max(1 - homeSeg, 0.001) }} />
          </View>
          <View style={styles.barCentreGap} />
          <View style={styles.barHalfRight}>
            <View style={[styles.barSeg, { flex: awaySeg, backgroundColor: awayColor }]} />
            <View style={{ flex: Math.max(1 - awaySeg, 0.001) }} />
          </View>
        </View>
        <View
          style={[
            styles.statValueBox,
            awayWins && styles.statValueBoxWin,
            away === '' && styles.statValueBoxEmpty,
          ]}>
          {away !== '' ? (
            <Text style={[styles.statValue, awayWins && styles.statValueTextWin]}>{away}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function MatchPredictionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fixture = useFixture(id);
  const prediction = useMatchPrediction(id);
  const teams = useTeams();
  const competitions = useCompetitions();
  const [flipped, setFlipped] = useState(false);

  const homeTeam = teams.data?.find((t) => t.id === fixture.data?.home_team_id);
  const awayTeam = teams.data?.find((t) => t.id === fixture.data?.away_team_id);
  const competitionName = competitions.data?.find(
    (c) => c.id === fixture.data?.competition_id,
  )?.short_name;

  const p = prediction.data;

  if (fixture.isLoading || prediction.isLoading) {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safe}>
        <PageGradient />
        <LoadingState />
      </SafeAreaView>
    );
  }
  if (fixture.error || prediction.error || !fixture.data || !p) {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safe}>
        <PageGradient />
        <ErrorState error={fixture.error ?? prediction.error ?? new Error('No prediction')} />
      </SafeAreaView>
    );
  }

  const homePct = Math.round(p.home_win_prob * 100);
  const drawPct = Math.round(p.draw_prob * 100);
  const awayPct = Math.max(100 - homePct - drawPct, 0);
  const maxImpact = Math.max(...p.top_features.map((f) => Math.abs(f.impact_pp)), 1);
  const homeFav = homePct >= awayPct;

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      <PageGradient />
      <MatchupHeader
        fixture={fixture.data}
        result={null}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        competitionName={competitionName}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <FadeCard
          flipped={flipped}
          front={
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <CardTitle title="Prediction" />
                <View style={styles.headerActions}>
                  <CardHeaderActions
                    onExplain={() => setFlipped(true)}
                    accessibilityLabel="Explain the match prediction"
                  />
                </View>
              </View>

              {/* Win probability in the STATS-ROW grammar (owner call
                  2026-07-13): centred muted label, 44×22 value boxes
                  flanking a 4pt centre-out diverging bar — favourite
                  box dark, leader green / lagger red. Home left, away
                  right, same convention the hero establishes. */}
              <View style={styles.section}>
                <StatRow
                  label="Win probability"
                  home={`${homePct}%`}
                  away={`${awayPct}%`}
                  homeFlex={homePct}
                  awayFlex={awayPct}
                  homeLeads={homeFav}
                  // Dead heat = both quiet, the app-wide draw law
                  // (and index-row parity).
                  tie={homePct === awayPct}
                />
                <Text style={styles.bandNote}>
                  Draw {Math.max(drawPct, 1) === drawPct ? drawPct : '<1'}% · ±{' '}
                  {p.confidence_band_pp} points at 90% confidence
                </Text>
              </View>

              {/* Predicted margin — same row skeleton; the winning
                  side's box carries the margin, the bar sweeps only
                  toward the winner. */}
              <View style={styles.section}>
                <StatRow
                  label="Predicted margin"
                  home={p.predicted_margin.median > 0 ? `+${Math.abs(p.predicted_margin.median)}` : '—'}
                  away={p.predicted_margin.median < 0 ? `+${Math.abs(p.predicted_margin.median)}` : '—'}
                  homeFlex={p.predicted_margin.median > 0 ? Math.abs(p.predicted_margin.median) : 0}
                  awayFlex={p.predicted_margin.median < 0 ? Math.abs(p.predicted_margin.median) : 0}
                  homeLeads={p.predicted_margin.median > 0}
                />
                <Text style={styles.bandNote}>
                  middle half of replays finish {p.predicted_margin.iqr_lower > 0 ? '+' : ''}
                  {p.predicted_margin.iqr_lower} to +{p.predicted_margin.iqr_upper}
                </Text>
              </View>

              {/* Drivers — one stat row each: the value box sits on
                  the side the input favours, bar sweeping toward it. */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>DRIVERS</Text>
                {p.top_features.map((f) => {
                  const towardHome = f.impact_pp >= 0;
                  const mag = Math.abs(f.impact_pp);
                  return (
                    <StatRow
                      key={f.label}
                      label={f.label}
                      home={towardHome ? `+${mag}` : ''}
                      away={towardHome ? '' : `+${mag}`}
                      homeFlex={towardHome ? (mag / maxImpact) * 100 : 0}
                      awayFlex={towardHome ? 0 : (mag / maxImpact) * 100}
                      // Colour is the FAVOURITE's perspective: a bar
                      // toward the favourite is green, against red.
                      homeLeads={homeFav}
                    />
                  );
                })}
              </View>

              {/* Fan-facing ML context (owner call 2026-07-13). The
                  figures are placeholder copy on synthetic data —
                  swap in the real training-set size and algorithm at
                  the Phase 6 BigQuery ML cutover (spec §2d). */}
              <Text style={styles.footerMeta}>
                Prediction from ML analysis of 1,000+ historical match data
                points using gradient-boosted decision trees — rankings, form,
                head-to-head and venue.
              </Text>
            </View>
          }
          back={
            <NarrativeBack
              title="Prediction"
              purpose={PREDICTION_ABOUT}
              onClose={() => setFlipped(false)}
            />
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: PAGE_BOTTOM_INSET,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    paddingBottom: Spacing.three,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: {
    position: 'relative',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerActions: {
    position: 'absolute',
    right: Spacing.three,
    top: Spacing.three,
  },
  section: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  sectionLabel: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    textTransform: 'uppercase',
    color: Colors.light.textSecondary,
  },

  // The fixture stats-pane row anatomy, verbatim.
  statBlock: { gap: 6 },
  statLabel: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  statBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  statValueBox: {
    width: 44,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValueBoxWin: { backgroundColor: Colors.light.textSecondary },
  statValueBoxEmpty: { backgroundColor: 'transparent' },
  statValue: {
    fontSize: TextSize.md,
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    color: Colors.light.textSecondary,
  },
  statValueTextWin: { color: Colors.light.textInverse },
  barTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  barHalfLeft: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    height: 4,
  },
  barHalfRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 4,
  },
  barCentreGap: { width: 2, height: 4 },
  barSeg: { borderRadius: 2, height: 4 },

  bandNote: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },

  footerMeta: {
    // Breathing room on every side (owner call) — the sentence reads
    // as its own quiet block under the drivers.
    paddingTop: Spacing.four,
    paddingBottom: Spacing.one,
    paddingHorizontal: Spacing.five,
    textAlign: 'center',
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.xs,
    lineHeight: 16,
    color: Colors.light.textSecondary,
  },
});
