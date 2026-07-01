import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * Five-tab IA (PRD §4). Reduced from six after the UITabBar overflow-into-"More"
 * problem — iOS collapses the 5th tab onwards into a system "More" menu, which
 * buried Rankings (a PRD-called-out differentiator) behind an ellipsis.
 *
 * Stats is deferred out of the tab bar and will resurface as a Team-detail
 * sub-route once register #12 (KPI field list) lands. That leaves 5 primary
 * tabs that fit iOS's constraint.
 *
 * Icons are SF Symbols on iOS; Android drawable identifiers are stubbed and
 * will be verified once we run on that platform.
 */
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house" drawable="ic_home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="fixtures">
        <NativeTabs.Trigger.Label>Fixtures</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" drawable="ic_calendar" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="standings">
        <NativeTabs.Trigger.Label>Standings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.number" drawable="ic_list" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="teams">
        <NativeTabs.Trigger.Label>Teams</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.3" drawable="ic_people" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="rankings">
        <NativeTabs.Trigger.Label>Rankings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="trophy" drawable="ic_trophy" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
