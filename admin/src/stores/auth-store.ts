import { create } from 'zustand';
import {
  adminLoginTelegram,
  setAdminToken,
  getAdminToken,
  removeAdminToken,
  getAdminInfo,
  setAdminInfo,
} from '@/lib/api';
import type { AdminInfo } from '@/types/admin';

type AuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  admin: AdminInfo | null;
  init: () => void;
  loginWithTelegram: (data: Record<string, string>) => Promise<void>;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  isAuthenticated: false,
  isLoading: true,
  error: null,
  admin: null,

  init: () => {
    const token = getAdminToken();
    const admin = getAdminInfo();
    set({ isAuthenticated: !!token, admin, isLoading: false });
  },

  loginWithTelegram: async (data: Record<string, string>) => {
    set({ isLoading: true, error: null });
    try {
      const { token, admin } = await adminLoginTelegram(data);
      setAdminToken(token);
      setAdminInfo(admin);
      set({ isAuthenticated: true, admin, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Ошибка входа',
      });
    }
  },

  logout: () => {
    removeAdminToken();
    set({ isAuthenticated: false, admin: null });
  },
}));
