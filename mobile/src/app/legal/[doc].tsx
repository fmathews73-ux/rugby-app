import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageGradient } from '@/components/page-gradient';
import { Colors, PAGE_BOTTOM_INSET, Spacing, TextSize, TextTracking } from '@/constants/theme';

/**
 * Legal documents — Privacy Policy and Terms of Service, reachable
 * from the Account page. DRAFT status is deliberate and prominent:
 * final text depends on the publisher entity (register #26) and the
 * Phase 5/6 feature set (auth, push, subscription), and must pass
 * legal review before any store submission. The drafts below describe
 * only what the app actually does today — nothing invented.
 */

interface LegalSection {
  heading: string;
  body: string;
}

const PRIVACY: { title: string; sections: LegalSection[] } = {
  title: 'Privacy Policy',
  sections: [
    {
      heading: 'Summary',
      body: 'This app is currently a development preview. It does not ask for your name, email address, or any account details, and it does not use advertising or third-party analytics.',
    },
    {
      heading: 'What is stored on your device',
      body: 'Your favourite-team selection and basic app preferences are stored locally on your device only. They are not transmitted to us and are deleted when you delete the app.',
    },
    {
      heading: 'What the app requests from our servers',
      body: 'The app fetches match, team and player statistics from our own servers. Like virtually all internet services, those servers keep standard technical request logs (such as IP address and request time) for security and reliability. These logs are not used to identify or profile you.',
    },
    {
      heading: 'What we do not do',
      body: 'We do not sell data. We do not share data with advertisers. We do not track you across other apps or websites. The app contains no betting or gambling integrations.',
    },
    {
      heading: 'Planned features',
      body: 'Future versions may add optional accounts, push notifications and a paid subscription tier. Each of these will involve additional data handling (for example, an email address for sign-in, or a device token for notifications), and this policy will be updated — and re-presented to you — before those features go live.',
    },
    {
      heading: 'Children',
      body: 'The app is not directed at children under 13, and we do not knowingly collect personal information from anyone.',
    },
    {
      heading: 'Changes and contact',
      body: 'We will update this policy as the product develops and note the date of the latest revision here. A contact address for privacy enquiries will be published before public release.',
    },
  ],
};

const TERMS: { title: string; sections: LegalSection[] } = {
  title: 'Terms of Service',
  sections: [
    {
      heading: 'Acceptance',
      body: 'By using this app you agree to these terms. If you do not agree, please do not use the app. These terms will be finalised before public release; the version you are reading is a draft covering the development preview.',
    },
    {
      heading: 'The service',
      body: 'The app provides rugby union statistics, visualisations and analysis for personal, non-commercial use. It is an independent product and is not affiliated with, endorsed by, or connected to any rugby union, governing body, team or player.',
    },
    {
      heading: 'Data accuracy',
      body: 'Statistics and analysis may be delayed, incomplete or inaccurate, and are provided for information and entertainment only. During development the app displays clearly-labelled synthetic (fictional) data. Player names shown in development builds are fictional.',
    },
    {
      heading: 'Not betting advice',
      body: 'Nothing in this app is betting, gambling or financial advice. Predictions and analytical framings are editorial interpretations of statistics, nothing more.',
    },
    {
      heading: 'Intellectual property',
      body: 'The app’s design, text and visualisations belong to the publisher. National flags are used as public identifiers of national teams. Team and competition names are the property of their respective owners and are used only to identify the matches being described.',
    },
    {
      heading: 'Acceptable use',
      body: 'You agree not to scrape, redistribute or resell the app’s data or content, interfere with the service, or attempt to access non-public parts of it.',
    },
    {
      heading: 'Subscriptions',
      body: 'A paid tier may be introduced in a future version. Pricing, billing and cancellation terms will be added to these terms and presented in the app before any purchase is possible.',
    },
    {
      heading: 'Liability',
      body: 'The app is provided “as is”, without warranties of any kind. To the maximum extent permitted by law, the publisher is not liable for any loss arising from use of the app or reliance on its content.',
    },
    {
      heading: 'Changes and contact',
      body: 'These terms will be updated as the product develops, with the latest revision date noted here. A contact address will be published before public release.',
    },
  ],
};

export default function LegalScreen() {
  const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const content = doc === 'terms' ? TERMS : PRIVACY;

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageGradient />
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.headerSlot, pressed && styles.pressedDim]}>
          <Ionicons name="chevron-back-circle-outline" size={28} color={Colors.light.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle}>{content.title}</Text>
        <View style={styles.headerSlot} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Draft banner — must stay until legal review (register #26). */}
        <View style={styles.draftBanner}>
          <Ionicons name="construct-outline" size={14} color={Colors.light.textSecondary} />
          <Text style={styles.draftText}>
            Draft · July 2026 · pending legal review before public release
          </Text>
        </View>

        <View style={styles.card}>
          {content.sections.map((s, i) => (
            <View key={s.heading} style={[styles.section, i === 0 && styles.sectionFirst]}>
              <Text style={styles.sectionHeading}>{s.heading}</Text>
              <Text style={styles.sectionBody}>{s.body}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerSlot: { minWidth: 44 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    textTransform: 'uppercase',
    color: Colors.light.textSecondary,
  },
  pressedDim: { opacity: 0.5 },

  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: PAGE_BOTTOM_INSET,
    gap: Spacing.three,
  },

  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  draftText: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  section: {
    gap: Spacing.one,
  },
  sectionFirst: {},
  sectionHeading: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    textTransform: 'uppercase',
    color: Colors.light.textSecondary,
  },
  sectionBody: {
    fontFamily: 'WorkSans_400Regular',
    fontSize: TextSize.md,
    lineHeight: 21,
    color: Colors.light.text,
  },
});
