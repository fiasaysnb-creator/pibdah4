import { useEffect, useRef } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

export function useSupabaseRealtimeRefresh(
  channelName: string,
  tables: readonly string[],
  refresh: () => void | Promise<void>,
  options: { realtime?: boolean; refreshOnFocus?: boolean } = {},
) {
  const refreshRef = useRef(refresh);
  const tablesKey = JSON.stringify(tables);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const realtimeEnabled = options.realtime !== false;

    let timer: number | undefined;
    const scheduleRefresh = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void Promise.resolve(refreshRef.current()).catch((error) => {
          console.warn(`[Realtime] Refresh failed for ${channelName}:`, error);
        });
      }, 150);
    };

    let channel: ReturnType<typeof supabase.channel> | undefined;
    if (realtimeEnabled) {
      channel = supabase.channel(channelName);
      for (const table of JSON.parse(tablesKey) as string[]) {
        channel = channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          scheduleRefresh,
        );
      }

      channel.subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[Realtime] Subscription unavailable for ${channelName}:`, error);
        }
      });
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };
    if (options.refreshOnFocus !== false) window.addEventListener('focus', scheduleRefresh);
    window.addEventListener('online', scheduleRefresh);
    if (options.refreshOnFocus !== false) {
      document.addEventListener('visibilitychange', refreshWhenVisible);
    }

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener('focus', scheduleRefresh);
      window.removeEventListener('online', scheduleRefresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [channelName, tablesKey, options.realtime, options.refreshOnFocus]);
}
