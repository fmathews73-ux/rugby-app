import { useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';

import type { Fixture, Result } from '@rugby-app/shared';

import { useFixtureResult, useTeams } from '@/api/hooks';
import { CardTitle } from '@/components/card-title';
import { FlipTrigger } from '@/components/flip-trigger';
import { MatrixChart } from '@/components/insights/matrix-chart';
import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { Colors, Spacing, TextSize } from '@/constants/theme';

/** One side's chart values from the match Result. */
export interface MatchPairAxes {
  x: number;
  /** Raw metric — negated before plotting when `yHigherIsBetter` is
   *  false, so "better" always plots upward (matrix convention). */
  y: number;
}

/**
 * Match-pair 2×2 (owner semantics 2026-07-09): THIS MATCH's numbers
 * for both sides, framed relative to EACH OTHER — crosshairs at the
 * pair's midpoints (Verdict's frame), so each quadrant reads "wins
 * this combination against the opponent". The tier plays no part
 * here; the same-named tier matrices live on the team surfaces and
 * Pre-Match. Unweighted dots (dot-size-as-margin is a tier-chart
 * device). Backs are About-only until match-pair narratives exist.
 */
export function MatchPairMatrix({
  fixture,
  title,
  purpose,
  accessibilityLabel,
  getAxes,
  yHigherIsBetter = true,
  quadrants,
  xCaption,
  yCaption,
  xUnit,
  yUnit,
  style,
}: {
  fixture: Fixture;
  title: string;
  purpose: string;
  accessibilityLabel: string;
  /** Extract each side's (x, raw y) from the Result. */
  getAxes: (result: Result, side: 'home' | 'away') => MatchPairAxes;
  yHigherIsBetter?: boolean;
  quadrants: { tr: string; tl: string; br: string; bl: string };
  xCaption: string;
  yCaption: string;
  xUnit?: string;
  yUnit?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const result = useFixtureResult(fixture.id, fixture.status);
  const teams = useTeams();
  const notStarted = fixture.status === 'scheduled';

  const points = (() => {
    if (!result.data) return [];
    const codeById = new Map((teams.data ?? []).map((t) => [t.id, t.short_name]));
    return (['home', 'away'] as const).map((side) => {
      const axes = getAxes(result.data!, side);
      const teamId = side === 'home' ? fixture.home_team_id : fixture.away_team_id;
      return {
        id: teamId,
        code: codeById.get(teamId) ?? teamId.toUpperCase(),
        x: axes.x,
        y: yHigherIsBetter ? axes.y : -axes.y,
      };
    });
  })();

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title={title}
          onClose={() => setInfoOpen(false)}
          purpose={<>{purpose}</>}
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
          <View style={styles.headerRow}>
            {/* Radar/2x2 rule: title centred on the chart's vertical
                axis. */}
            <View style={styles.titleCentreFill} pointerEvents="none">
              <CardTitle title={title} />
            </View>
            <Pressable
              onPress={() => setInfoOpen(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}>
              <FlipTrigger />
            </Pressable>
          </View>

          {notStarted ? (
            <Text style={styles.empty}>Populates once the match is under way.</Text>
          ) : result.isLoading && !result.data ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : points.length < 2 ? (
            <Text style={styles.empty}>No match data on file.</Text>
          ) : (
            <MatrixChart
              points={points}
              subjectId={fixture.home_team_id}
              subjectId2={fixture.away_team_id}
              subjectsOnly
              pairCentered
              quadrants={quadrants}
              xCaption={xCaption}
              yCaption={yCaption}
              xUnit={xUnit}
              yUnit={yUnit}
              sizeLabel=""
            />
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  cardFill: { flexGrow: 1 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.three,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerRow: {
    position: 'relative',
    justifyContent: 'flex-end',
    marginBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleCentreFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },
});
