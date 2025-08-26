'use client';

import {
  onIdTokenChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  User,
  getIdToken,
} from 'firebase/auth';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authClient } from '@/lib/firebase.client';

type AuthContextValue = {
  user: User | null;
  loading: boolean; // 최초 구독/토큰 갱신 중
  loginWithEmail: (email: string, pw: string) => Promise<void>;
  signupWithEmail: (email: string, pw: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 로그인 상태 감시 + 토큰 자동 갱신
  useEffect(() => {
    const unsub = onIdTokenChanged(authClient, async (u) => {
      setUser(u ?? null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const loginWithEmail = useCallback(
    async (email: string, pw: string) => {
      await signInWithEmailAndPassword(authClient, email.trim(), pw);
    },
    []
  );

  const signupWithEmail = useCallback(
    async (email: string, pw: string) => {
      await createUserWithEmailAndPassword(authClient, email.trim(), pw);
    },
    []
  );

  const loginWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(authClient, provider);
  }, []);

  const logout = useCallback(async () => {
    await signOut(authClient);
  }, []);

  const getToken = useCallback(
    async (forceRefresh = false) => {
      if (!user) return null;
      const t = await getIdToken(user, forceRefresh);
      return t ?? null;
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      loginWithEmail,
      signupWithEmail,
      loginWithGoogle,
      logout,
      getToken,
    }),
    [user, loading, loginWithEmail, signupWithEmail, loginWithGoogle, logout, getToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
