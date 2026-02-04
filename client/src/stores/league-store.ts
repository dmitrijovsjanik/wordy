import { create } from 'zustand';
import type {
  UserLeagueProgress,
  UserSeasonStats,
  LeagueSeason,
  LeaderboardEntry,
  LeagueNotification,
} from '@/types/api';
import {
  getLeagueStatus,
  getLeaderboard,
  getLeagueNotifications,
  markLeagueNotificationsRead,
} from '@/lib/api';

type LeagueState = {
  progress: UserLeagueProgress | null;
  stats: UserSeasonStats | null;
  season: LeagueSeason | null;
  position: { position: number; total: number } | null;
  leaderboard: LeaderboardEntry[];
  notifications: LeagueNotification[];
  isLoading: boolean;
  error: string | null;

  fetchStatus: () => Promise<void>;
  fetchLeaderboard: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markRead: (ids: number[]) => Promise<void>;
  updateLp: (totalLp: number) => void;
  reset: () => void;
};

export const useLeagueStore = create<LeagueState>()((set, get) => ({
  progress: null,
  stats: null,
  season: null,
  position: null,
  leaderboard: [],
  notifications: [],
  isLoading: false,
  error: null,

  fetchStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await getLeagueStatus();
      set({
        progress: res.progress,
        stats: res.stats,
        season: res.season,
        position: res.position,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false, error: 'Не удалось загрузить статус лиги' });
    }
  },

  fetchLeaderboard: async () => {
    try {
      const res = await getLeaderboard();
      set({ leaderboard: res.entries });
    } catch {
      // silent
    }
  },

  fetchNotifications: async () => {
    try {
      const res = await getLeagueNotifications();
      set({ notifications: res.notifications });
    } catch {
      // silent
    }
  },

  markRead: async (ids) => {
    const prev = get().notifications;
    set({ notifications: prev.filter((n) => !ids.includes(n.id)) });
    try {
      await markLeagueNotificationsRead(ids);
    } catch {
      set({ notifications: prev });
    }
  },

  updateLp: (totalLp) => {
    const stats = get().stats;
    if (stats) {
      set({ stats: { ...stats, leaguePoints: totalLp } });
    }
  },

  reset: () => {
    set({
      progress: null,
      stats: null,
      season: null,
      position: null,
      leaderboard: [],
      notifications: [],
      isLoading: false,
      error: null,
    });
  },
}));
