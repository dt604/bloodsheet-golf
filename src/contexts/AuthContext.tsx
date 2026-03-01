import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  fullName: string;
  avatarUrl?: string;
  handicap: number;
  is_admin: boolean;
  createdAt: string;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  signUp: (email: string, password: string, fullName: string, handicap?: number, avatarUrl?: string, grintId?: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInAsGuest: () => Promise<string | null>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Pick<Profile, 'fullName' | 'handicap' | 'avatarUrl'>>) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const profilePromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Profile fetch timeout')), 3000));

        const { data } = await Promise.race([profilePromise, timeoutPromise]) as any;

        if (data) {
          setProfile({
            id: data.id,
            fullName: data.full_name,
            avatarUrl: data.avatar_url ?? undefined,
            handicap: data.handicap,
            is_admin: data.is_admin ?? false,
            createdAt: data.created_at,
          });
          return;
        }
      } catch (e) {
        console.warn(`Profile fetch attempt ${i + 1} failed:`, e);
      }
      if (i < retries - 1) await new Promise(r => setTimeout(r, 600));
    }
  }

  useEffect(() => {
    async function initAuth() {
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Auth init timeout')), 5000));

        const { data: { session } } = await Promise.race([sessionPromise, timeout]) as any;

        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user && !session.user.is_anonymous) {
          await fetchProfile(session.user.id);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('Auth Event:', _event);
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user && !session.user.is_anonymous) {
          await fetchProfile(session.user.id).catch(e => console.error('onAuthStateChange profile fetch failed:', e));
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string, fullName: string, handicap: number = 0, avatarUrl?: string, grintId?: string): Promise<string | null> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          handicap,
          avatar_url: avatarUrl,
          grint_id: grintId
        }
      },
    });
    return error?.message ?? null;
  }

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }

  async function signInAsGuest(): Promise<string | null> {
    const { error } = await supabase.auth.signInAnonymously();
    return error?.message ?? null;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function sendPasswordReset(email: string): Promise<string | null> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return error?.message ?? null;
  }

  async function updatePassword(password: string): Promise<string | null> {
    const { error } = await supabase.auth.updateUser({ password });
    return error?.message ?? null;
  }

  async function signInWithGoogle(): Promise<string | null> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    return error?.message ?? null;
  }

  async function updateProfile(data: Partial<Pick<Profile, 'fullName' | 'handicap' | 'avatarUrl'>>) {
    if (!user) return;
    const updates: Record<string, unknown> = {};
    if (data.fullName !== undefined) updates.full_name = data.fullName;
    if (data.handicap !== undefined) updates.handicap = data.handicap;
    if (data.avatarUrl !== undefined) updates.avatar_url = data.avatarUrl;
    await supabase.from('profiles').update(updates).eq('id', user.id);
    setProfile((prev) => prev ? { ...prev, ...data } : prev);
  }

  const isGuest = !!(user?.is_anonymous);

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, isGuest, signUp, signIn, signInAsGuest, signOut, updateProfile, sendPasswordReset, updatePassword, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
