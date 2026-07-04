import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { AppHeader } from '@/components/app-header';
import { Colors } from '@/constants/theme';

/**
 * Standard expo-router `<Tabs>` — battle-tested with a parent Stack, unlike
 * `expo-router/unstable-native-tabs`. Uses Ionicons for cross-platform
 * consistency; on iOS the tab bar renders close to the previous native look.
 *
 * `header: AppHeader` renders the persistent header (PRD §4.1) at the top of
 * every tab screen. `headerShown: true` is required for it to appear.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: () => <AppHeader />,
        // Flat pure-white tab bar matching the AppHeader. Hairline
        // divider (`borderTopColor`) provides the visual separation from
        // the page bg instead of a colour contrast — same technical /
        // restrained pattern used in Stripe, Linear, Grafana.
        tabBarActiveTintColor: Colors.light.text,
        tabBarInactiveTintColor: Colors.light.textSecondary,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="fixtures"
        options={{
          title: 'Fixtures',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="teams"
        options={{
          title: 'Teams',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="standings"
        options={{
          title: 'Standings',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'list' : 'list-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rankings"
        options={{
          title: 'Rankings',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="predictor"
        options={{
          title: 'Predictor',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
