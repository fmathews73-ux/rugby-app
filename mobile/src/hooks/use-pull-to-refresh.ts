import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Pull-to-refresh wiring for TanStack Query screens. Refetches every
 * ACTIVE query (whatever the current screen is actually subscribed to)
 * rather than invalidating the whole cache, so a pull on Home doesn't
 * force refetches for unmounted screens.
 *
 * Usage:
 *   const { refreshing, onRefresh } = usePullToRefresh();
 *   <ScrollView refreshControl={
 *     <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
 *   } />
 */
export function usePullToRefresh(): {
  refreshing: boolean;
  onRefresh: () => void;
} {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    queryClient
      .refetchQueries({ type: 'active' })
      .finally(() => setRefreshing(false));
  }, [queryClient]);

  return { refreshing, onRefresh };
}
