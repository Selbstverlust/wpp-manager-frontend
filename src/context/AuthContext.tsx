'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import api from '../lib/api';
import { clearStoredAuth, getStoredAuth, setStoredAuth, StoredAuth } from '../lib/auth-storage';
import { User, Subscription } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  subscription: Subscription | null;
  isPremium: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [authState, setAuthState] = useState<StoredAuth | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async (token: string) => {
    try {
      const response = await api.get<Subscription>('/subscriptions/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSubscription(response.data);
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
      setSubscription(null);
    }
  }, []);

  useEffect(() => {
    const stored = getStoredAuth();
    if (stored) {
      setAuthState(stored);
      fetchSubscription(stored.token);
    }
    setLoading(false);
  }, [fetchSubscription]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<{ accessToken: string; user: User }>('/auth/login', {
        email,
        password
      });

      setStoredAuth(data.accessToken, data.user);
      setAuthState({ token: data.accessToken, user: data.user });
      await fetchSubscription(data.accessToken);
      router.push('/dashboard');
    },
    [router, fetchSubscription]
  );

  const register = useCallback(
    async (email: string, name: string, password: string) => {
      const { data } = await api.post<{ accessToken: string; user: User }>('/auth/register', {
        email,
        name,
        password
      });

      setStoredAuth(data.accessToken, data.user);
      setAuthState({ token: data.accessToken, user: data.user });
      await fetchSubscription(data.accessToken);
      router.push('/dashboard');
    },
    [router, fetchSubscription]
  );

  const logout = useCallback(() => {
    clearStoredAuth();
    setAuthState(null);
    setSubscription(null);
    router.push('/login');
  }, [router]);

  const refreshSubscription = useCallback(async () => {
    if (authState?.token) {
      await fetchSubscription(authState.token);
    }
  }, [authState?.token, fetchSubscription]);

  const isPremium = useMemo(() => {
    return subscription?.isPremium ?? false;
  }, [subscription]);

  const value: AuthContextValue = useMemo(
    () => ({
      user: authState?.user ?? null,
      token: authState?.token ?? null,
      subscription,
      isPremium,
      loading,
      login,
      register,
      logout,
      refreshSubscription,
    }),
    [authState, subscription, isPremium, loading, login, register, logout, refreshSubscription]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
};
