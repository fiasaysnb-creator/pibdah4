import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import supabase from '../lib/supabaseClient';

interface DashboardStats {
  projects: number;
  activeProjects: number;
  clients: number;
  activeClients: number;
  leads: number;
  discussionLeads: number;
  followUpLeads: number;
  teamMembers: number;
  transactions: number;
  revenue: number;
  expense: number;
}

export const useDashboardStats = (options: { enabled?: boolean } = {}) => {
  const [hasAuthenticatedSession, setHasAuthenticatedSession] = useState(false);

  useEffect(() => {
    let isActive = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isActive) setHasAuthenticatedSession(Boolean(session));
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isActive) return;
      if (error) {
        setHasAuthenticatedSession(false);
        return;
      }
      setHasAuthenticatedSession(Boolean(data.session));
    }).catch(() => {
      if (isActive) setHasAuthenticatedSession(false);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  return useQuery({
    queryKey: ['dashboardStats'],
    enabled: options.enabled !== false && hasAuthenticatedSession,
    queryFn: async (): Promise<DashboardStats> => {
      const { data, error } = await supabase.rpc('get_dashboard_stats');
      if (error) throw error;

      const stats = data as Record<keyof DashboardStats, number | string>;
      return {
        projects: Number(stats.projects || 0),
        activeProjects: Number(stats.activeProjects || 0),
        clients: Number(stats.clients || 0),
        activeClients: Number(stats.activeClients || 0),
        leads: Number(stats.leads || 0),
        discussionLeads: Number(stats.discussionLeads || 0),
        followUpLeads: Number(stats.followUpLeads || 0),
        teamMembers: Number(stats.teamMembers || 0),
        transactions: Number(stats.transactions || 0),
        revenue: Number(stats.revenue || 0),
        expense: Number(stats.expense || 0),
      };
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
};
