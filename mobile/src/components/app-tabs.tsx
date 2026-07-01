import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * Six-tab IA per PRD §4: Home · Fixtures · Standings · Teams · Stats ·
 * Power Rankings. Icons are SF Symbols on iOS (`sf` prop); Android drawables
 * are the same identifier — Android styling comes in a later stage when we
 * verify on that platform.
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

      <NativeTabs.Trigger name="stats">
        <NativeTabs.Trigger.Label>Stats</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar" drawable="ic_chart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="rankings">
        <NativeTabs.Trigger.Label>Rankings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="trophy" drawable="ic_trophy" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
