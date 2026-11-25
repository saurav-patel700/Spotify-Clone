import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile } from '@soundsphere/shared';
import { apiClient, ApiClientError } from '@/lib/apiClient';

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  isHydrating: boolean;
  isSubmitting: boolean;
  authError: string | null;

  hydrateSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (
    displayName: string,
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (
    email: string
  ) => Promise<{ ok: boolean; message?: string; resetToken?: string; error?: string }>;
  confirmPasswordReset: (
    token: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  updateProfile: (updates: {
    displayName: string;
    preferredFocusMinutes: number;
    preferredBreakMinutes: number;
    preferredLongBreakMinutes: number;
  }) => Promise<{ ok: boolean; error?: string }>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isHydrating: false,
      isSubmitting: false,
      authError: null,

      hydrateSession: async () => {
        const token = get().accessToken;
        if (!token) {
          set({ user: null, isHydrating: false });
          return;
        }
        set({ isHydrating: true });
        try {
          const res = await apiClient.getMe();
          set({ user: res.user, isHydrating: false, authError: null });
        } catch (err) {
          if (err instanceof ApiClientError && err.status === 401) {
            set({ user: null, accessToken: null, isHydrating: false });
          } else {
            set({ isHydrating: false });
          }
        }
      },

      signIn: async (email, password) => {
        set({ isSubmitting: true, authError: null });
        try {
          const res = await apiClient.login({ email, password });
          set({
            user: res.user,
            accessToken: res.accessToken,
            isSubmitting: false,
            authError: null,
          });
          return { ok: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Sign in failed.';
          set({ isSubmitting: false, authError: message });
          return { ok: false, error: message };
        }
      },

      signUp: async (displayName, email, password) => {
        set({ isSubmitting: true, authError: null });
        try {
          const res = await apiClient.signup({ displayName, email, password });
          set({
            user: res.user,
            accessToken: res.accessToken,
            isSubmitting: false,
            authError: null,
          });
          return { ok: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Account creation failed.';
          set({ isSubmitting: false, authError: message });
          return { ok: false, error: message };
        }
      },

      signOut: async () => {
        try {
          if (get().accessToken) {
            await apiClient.logout();
          }
        } catch {
          // Proceed clearing local session even if server unreachable
        }
        set({ user: null, accessToken: null, authError: null });
      },

      requestPasswordReset: async (email) => {
        set({ isSubmitting: true, authError: null });
        try {
          const res = await apiClient.forgotPassword(email);
          set({ isSubmitting: false });
          return { ok: true, message: res.message, resetToken: res.resetToken };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unable to request reset.';
          set({ isSubmitting: false, authError: message });
          return { ok: false, error: message };
        }
      },

      confirmPasswordReset: async (token, newPassword) => {
        set({ isSubmitting: true, authError: null });
        try {
          await apiClient.resetPassword(token, newPassword);
          set({ isSubmitting: false });
          return { ok: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Password reset failed.';
          set({ isSubmitting: false, authError: message });
          return { ok: false, error: message };
        }
      },

      updateProfile: async (updates) => {
        set({ isSubmitting: true, authError: null });
        try {
          const res = await apiClient.updateMe(updates);
          set({ user: res.user, isSubmitting: false });
          return { ok: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Profile update failed.';
          set({ isSubmitting: false, authError: message });
          return { ok: false, error: message };
        }
      },
    }),
    {
      name: 'soundsphere-auth-v2',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
    }
  )
);
