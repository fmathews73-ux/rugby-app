import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useHealth, useLatestRanking, useTeams } from '@/api/hooks';
import { Colors, Spacing } from '@/constants/theme';

/**
 * Home. Hero-card layout: bold coloured left panel with a large white icon,
 * white right panel with a small eyebrow label + punchy headline + optional
 * subtitle + pill CTA. Same skeleton for each card — one component drives the
 * pair. Real IA per PRD §4.3 is "General description / landing" with content
 * blocks still `[INPUT NEEDED #19]`; this hero-card shape is the working
 * placeholder.
 */

const PANEL_COLOR_A = '#4F46E5'; // indigo — Live / activity
const PANEL_COLOR_B = '#0F766E'; // teal — Rankings / trophy

export default function HomeScreen() {
  const router = useRouter();
  const health = useHealth();
  const ranking = useLatestRanking();
  const teams = useTeams();

  const teamById = useMemo(() => {
    const m = new Map<string, { name: string; flag_code: string; short_name: string }>();
    for (const t of teams.data ?? []) m.set(t.id, t);
    return m;
  }, [teams.data]);

  const topRankedTeam = ranking.data ? teamById.get(ranking.data.rows[0]?.team_id ?? '') : undefined;
  const topRankRow = ranking.data?.rows[0];

  const entities = health.data?.entities;
  const fixturesLine =
    entities !== undefined
      ? `${entities.competitions} competitions · ${entities.teams} teams · ${entities.fixtures} fixtures`
      : 'Loading…';

  const rankingsLine =
    topRankedTeam !== undefined && topRankRow !== undefined
      ? `Rank 1 · ${topRankRow.points} pts`
      : ranking.isLoading
        ? 'Loading…'
        : 'No snapshot yet';

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Rugby App</Text>
        <Text style={styles.subtitle}>Men’s international rugby, all in one place.</Text>

        <HeroCard
          panelColor={PANEL_COLOR_A}
          iconName="pulse"
          eyebrow="Live in the app"
          heading="Men’s international rugby"
          body={fixturesLine}
          ctaLabel="Fixtures"
          onPress={() => router.push('/fixtures')}
        />

        <HeroCard
          panelColor={PANEL_COLOR_B}
          iconName="trophy"
          eyebrow="World Rugby men’s"
          heading={topRankedTeam?.name ?? '—'}
          body={rankingsLine}
          ctaLabel="Rankings"
          onPress={() => router.push('/rankings')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Hero card ───────────────────────────────────────────────────────────────

function HeroCard({
  panelColor,
  iconName,
  eyebrow,
  heading,
  body,
  ctaLabel,
  onPress,
}: {
  panelColor: string;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  eyebrow: string;
  heading: string;
  body: string;
  ctaLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={[styles.cardLeft, { backgroundColor: panelColor }]}>
        <Ionicons name={iconName} size={54} color="#FFFFFF" />
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.heading} numberOfLines={2}>
          {heading}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {body}
        </Text>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
          <Text style={styles.ctaLabel}>{ctaLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  scroll: { padding: Spacing.four, gap: Spacing.four, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.light.text },
  subtitle: { fontSize: 14, color: Colors.light.textSecondary },

  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    // subtle iOS-style shadow
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardLeft: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    minHeight: 180,
  },
  cardRight: {
    flex: 2,
    padding: Spacing.four,
    gap: 8,
    justifyContent: 'center',
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    lineHeight: 26,
  },
  body: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
    paddingBottom: 4,
  },

  cta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.light.text,
    marginTop: 4,
  },
  ctaPressed: { backgroundColor: Colors.light.backgroundElement },
  ctaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    letterSpacing: 0.2,
  },
});
