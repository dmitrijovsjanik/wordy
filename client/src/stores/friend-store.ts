import { create } from 'zustand';
import type { FriendInfo, FriendRequestInfo } from '@/types/api';
import {
  getFriendsList,
  getMyFriendCode,
  getInviteToken,
  sendFriendRequest,
  getIncomingFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend as apiRemoveFriend,
  acceptInvite,
} from '@/lib/api';

type FriendState = {
  friends: FriendInfo[];
  requests: FriendRequestInfo[];
  requestCount: number;
  friendCode: string | null;
  inviteToken: string | null;
  isLoading: boolean;
  error: string | null;

  fetchFriends: () => Promise<void>;
  fetchRequests: () => Promise<void>;
  fetchFriendCode: () => Promise<void>;
  fetchInviteToken: () => Promise<void>;
  sendRequest: (code: string) => Promise<void>;
  acceptRequest: (id: number) => Promise<void>;
  declineRequest: (id: number) => Promise<void>;
  removeFriend: (friendId: number) => Promise<void>;
  acceptInviteByToken: (token: string) => Promise<void>;
};

export const useFriendStore = create<FriendState>()((set, get) => ({
  friends: [],
  requests: [],
  requestCount: 0,
  friendCode: null,
  inviteToken: null,
  isLoading: false,
  error: null,

  fetchFriends: async () => {
    set({ isLoading: true, error: null });
    try {
      const { friends } = await getFriendsList();
      set({ friends, isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Не удалось загрузить список друзей' });
    }
  },

  fetchRequests: async () => {
    try {
      const { requests, count } = await getIncomingFriendRequests();
      set({ requests, requestCount: count });
    } catch {
      // silent
    }
  },

  fetchFriendCode: async () => {
    try {
      const { friendCode } = await getMyFriendCode();
      set({ friendCode });
    } catch {
      // silent
    }
  },

  fetchInviteToken: async () => {
    try {
      const { token } = await getInviteToken();
      set({ inviteToken: token });
    } catch {
      // silent
    }
  },

  sendRequest: async (code: string) => {
    await sendFriendRequest(code);
  },

  acceptRequest: async (id: number) => {
    // Оптимистичное обновление
    const prev = get().requests;
    set({
      requests: prev.filter((r) => r.id !== id),
      requestCount: Math.max(0, get().requestCount - 1),
    });
    try {
      await acceptFriendRequest(id);
      // Перезагружаем список друзей
      get().fetchFriends();
    } catch {
      set({ requests: prev, requestCount: prev.length });
    }
  },

  declineRequest: async (id: number) => {
    const prev = get().requests;
    set({
      requests: prev.filter((r) => r.id !== id),
      requestCount: Math.max(0, get().requestCount - 1),
    });
    try {
      await declineFriendRequest(id);
    } catch {
      set({ requests: prev, requestCount: prev.length });
    }
  },

  removeFriend: async (friendId: number) => {
    const prev = get().friends;
    set({ friends: prev.filter((f) => f.id !== friendId) });
    try {
      await apiRemoveFriend(friendId);
    } catch {
      set({ friends: prev });
    }
  },

  acceptInviteByToken: async (token: string) => {
    await acceptInvite(token);
    get().fetchFriends();
  },
}));
