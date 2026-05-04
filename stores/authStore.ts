import { create } from 'zustand';

type AuthState = {
  isSignedIn: boolean;
  isLoaded: boolean;
  setLoaded: (loaded: boolean) => void;
  setSignedIn: (value: boolean) => void;
};

// Thin wrapper — Clerk state is the source of truth via useAuth/useUser hooks.
// This store is only used for components that can't use hooks (e.g. Axios interceptor).
export const useAuthStore = create<AuthState>((set) => ({
  isSignedIn: false,
  isLoaded: false,
  setLoaded: (loaded) => set({ isLoaded: loaded }),
  setSignedIn: (value) => set({ isSignedIn: value }),
}));
