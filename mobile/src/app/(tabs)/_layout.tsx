import AppTabs from '@/components/app-tabs';

/**
 * Layout for the tab group. Just delegates to the AppTabs component so that
 * `<NativeTabs>` sits at the top of this route segment. `_layout.tsx` files
 * in Expo Router are picked up automatically per folder.
 */
export default function TabsLayout() {
  return <AppTabs />;
}
