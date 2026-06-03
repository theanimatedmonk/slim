import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { identifyUser, resetAnalytics, track } from '../lib/analytics.js';
import { supabase } from '../lib/supabase.js';
import { setAccessToken } from '../services/api.js';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAccessToken(data.session?.access_token ?? null);
      const user = data.session?.user;
      if (user) {
        identifyUser(user.id);
      }
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setAccessToken(nextSession?.access_token ?? null);

      const user = nextSession?.user;
      if (event === 'SIGNED_IN' && user) {
        identifyUser(user.id);
        track('Sign In Completed', { provider: 'google' });
      } else if (event === 'SIGNED_OUT') {
        track('Sign Out');
        resetAnalytics();
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    track('Sign In Started', { provider: 'google' });
    const redirectTo = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setAccessToken(null);
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      signInWithGoogle,
      signOut,
    }),
    [session, loading, signInWithGoogle, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
