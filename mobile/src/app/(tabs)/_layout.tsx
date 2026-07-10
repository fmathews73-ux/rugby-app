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
        // Active tab sits in the black identity register ("where you
        // are" is content, not chrome); inactive stays in the grey
        // functional register with the header avatar.
        tabBarActiveTintColor: Colors.light.text,
        tabBarInactiveTintColor: Colors.light.textSecondary,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          // A touch of air between the bar's top border and the icons.
          paddingTop: 4,
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
          // Tab grammar (owner call 2026-07-09): the Fixtures tab
          // ALWAYS lands on the fixtures list — a drill left on the
          // stack is popped when the tab blurs, so re-entering from
          // any tab starts fresh.
          popToTopOnBlur: true,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="teams"
        options={{
          title: 'Teams',
          // Same tab grammar as Fixtures (owner call 2026-07-10): the
          // Teams tab ALWAYS re-enters on the directory — any drill
          // left on the stack pops when the tab blurs, so the back
          // button walks a fresh hierarchy, never stale history.
          popToTopOnBlur: true,
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
      {/* Rankings removed from the footer (owner call 2026-07-09);
          href: null keeps the route alive for deep links while hiding
          the tab — world-rank data still surfaces on hero rows. */}
      <Tabs.Screen name="rankings" options={{ href: null }} />
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
