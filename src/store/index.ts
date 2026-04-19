import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);

interface AppState {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  currentWorkspaceId: number | null;
  setCurrentWorkspaceId: (id: number | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      loading: false,
      setLoading: (loading) => set({ loading }),
      currentWorkspaceId: null,
      setCurrentWorkspaceId: (id) => set({ currentWorkspaceId: id }),
    }),
    {
      name: 'app-storage',
    }
  )
);