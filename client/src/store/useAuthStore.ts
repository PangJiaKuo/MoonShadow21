/**
 * 阶段 4：登录态 store。token 持久化到 localStorage，页面刷新后自动恢复并拉取用户信息。
 */
import { create } from 'zustand';
import type { UserProfile } from '@moon21/shared';
import { api } from '../net/api';

const STORAGE_KEY = 'moon21.auth.v1';

interface AuthStore {
  token: string | null;
  user: UserProfile | null;
  authError: string | null;
  /** 是否已从服务端拉取过用户信息（避免重复请求） */
  hydrated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  /** 用本地 token 拉取最新用户（含金币）；失败则登出 */
  hydrate: () => Promise<void>;
}

function persist(token: string | null, user: UserProfile | null) {
  if (token && user) localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
  else localStorage.removeItem(STORAGE_KEY);
}

function readStored(): { token: string; user: UserProfile } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token: string; user: UserProfile };
    return parsed.token && parsed.user ? parsed : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthStore>((set, get) => {
  const stored = typeof localStorage !== 'undefined' ? readStored() : null;
  return {
    token: stored?.token ?? null,
    user: stored?.user ?? null,
    authError: null,
    hydrated: !!stored,

    login: async (username, password) => {
      try {
        const res = await api.login({ username, password });
        persist(res.token, res.user);
        set({ token: res.token, user: res.user, authError: null, hydrated: true });
        return true;
      } catch (e) {
        set({ authError: (e as Error).message });
        return false;
      }
    },

    register: async (username, password) => {
      try {
        const res = await api.register({ username, password });
        persist(res.token, res.user);
        set({ token: res.token, user: res.user, authError: null, hydrated: true });
        return true;
      } catch (e) {
        set({ authError: (e as Error).message });
        return false;
      }
    },

    logout: () => {
      const token = get().token;
      if (token) api.logout(token).catch(() => undefined);
      persist(null, null);
      set({ token: null, user: null, authError: null, hydrated: true });
    },

    hydrate: async () => {
      const token = get().token;
      if (!token) return;
      try {
        const user = await api.me(token);
        persist(token, user);
        set({ user, authError: null, hydrated: true });
      } catch {
        persist(null, null);
        set({ token: null, user: null, hydrated: true });
      }
    },
  };
});
