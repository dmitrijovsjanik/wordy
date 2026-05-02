import { create } from 'zustand';
import type { User } from '@/types/api';
import { authInit, authVkInit, authDev, getMe, setToken, getToken, removeToken, updateSettings } from '@/lib/api';
import { platformBridge } from '@/lib/platform-bridge';

type UserState = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  init: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  toggleRepeatMastered: () => Promise<void>;
  setTtsVoice: (voice: string) => Promise<void>;
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

      // Authenticate based on platform
      const platform = platformBridge.platform;
      const initData = platformBridge.getInitData();

      let res;
      if (platform === 'telegram' && initData) {
        res = await authInit(initData);
      } else if (platform === 'vk' && initData) {
        res = await authVkInit(initData);
      } else {
        res = await authDev();
      }

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

  setTtsVoice: async (voice: string) => {
    const current = useUserStore.getState().user;
    if (!current) return;
    const prevVoice = current.ttsVoice;
    set({ user: { ...current, ttsVoice: voice } });
    try {
      await updateSettings({ ttsVoice: voice });
    } catch {
      set({ user: { ...current, ttsVoice: prevVoice } });
      throw new Error('PREMIUM_REQUIRED');
    }
  },

  logout: () => {
    removeToken();
    set({ user: null, isAuthenticated: false });
  },
}));
