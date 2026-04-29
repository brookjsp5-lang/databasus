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

export interface Workspace {
  id: number;
  name: string;
  description?: string;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  role?: string;
}

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loading: boolean;
  error: string | null;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (workspace: Workspace) => void;
  removeWorkspace: (id: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaces: [],
      currentWorkspace: null,
      loading: false,
      error: null,
      setWorkspaces: (workspaces) => set({ workspaces }),
      setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
      addWorkspace: (workspace) =>
        set((state) => ({
          workspaces: [...state.workspaces, workspace],
        })),
      updateWorkspace: (workspace) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspace.id ? workspace : w
          ),
        })),
      removeWorkspace: (id) =>
        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.id !== id),
          currentWorkspace:
            state.currentWorkspace?.id === id ? null : state.currentWorkspace,
        })),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'workspace-storage',
      partialize: (state) => ({
        currentWorkspace: state.currentWorkspace,
      }),
    }
  )
);

interface AppState {
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  loading: false,
  setLoading: (loading) => set({ loading }),
}));
