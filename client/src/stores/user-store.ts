import { create } from 'zustand';
import type { User } from '@/types/api';
import { authInit, authDev, getMe, setToken, getToken, removeToken, updateSettings } from '@/lib/api';
import { telegram } from '@/lib/telegram';

type UserState = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  init: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  toggleRepeatMastered: () => Promise<void>;
  logout: () => void;
};

export const useUserStore = create<UserState>()((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  init: async () => {
    set({ isLoading: true, error: null });

    try {
      // If we already have a token, try to use it
      const existingToken = getToken();
      if (existingToken) {
        const user = await getMe();
        set({ user, isAuthenticated: true, isLoading: false });
        return;
      }

      // Authenticate
      const initData = telegram.initData;
      const res = initData
        ? await authInit(initData)
        : await authDev();

      setToken(res.token);
      const user = await getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      removeToken();
      set({ isAuthenticated: false, isLoading: false, error: 'Не удалось войти' });
    }
  },

  refreshProfile: async () => {
    try {
      const user = await getMe();
      set({ user });
    } catch {
      // silent — profile refresh is non-critical
    }
  },

  toggleRepeatMastered: async () => {
    const current = useUserStore.getState().user;
    if (!current) return;
    const newValue = !current.repeatMastered;
    set({ user: { ...current, repeatMastered: newValue } });
    try {
      await updateSettings({ repeatMastered: newValue });
    } catch {
      set({ user: { ...current, repeatMastered: !newValue } });
    }
  },

  logout: () => {
    removeToken();
    set({ user: null, isAuthenticated: false });
  },
}));
