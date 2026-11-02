import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

const AUTH_TOKEN_KEY = 'revnow_token';
const AUTH_USER_KEY = 'revnow_user';

function getStoredAuth(): Pick<AuthState, 'token' | 'user'> {
  if (typeof window === 'undefined') return { token: null, user: null };

  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  const rawUser = window.localStorage.getItem(AUTH_USER_KEY);

  if (!token || !rawUser) return { token: null, user: null };

  try {
    return {
      token,
      user: JSON.parse(rawUser) as User,
    };
  } catch {
    return { token: null, user: null };
  }
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: getStoredAuth().token,
      user: getStoredAuth().user,
      setAuth: (token, user) => {
        window.localStorage.setItem(AUTH_TOKEN_KEY, token);
        window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        set({ token, user });
      },
      logout: () => {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
        window.localStorage.removeItem(AUTH_USER_KEY);
        set({ token: null, user: null });
        window.location.href = '/login';
      },
    }),
    {
      name: 'revnow_auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
