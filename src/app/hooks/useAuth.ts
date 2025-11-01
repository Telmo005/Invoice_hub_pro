// hooks/useAuth.ts
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Session } from '@supabase/supabase-js';
import { logAuthEvent } from '@/lib/security/audit-log';

export function useAuth() {
  const [user, setUser] = useState<Session['user'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClientComponentClient();

  const getCurrentSession = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }, [supabase]);

  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      try {
        const session = await getCurrentSession();
        setUser(session?.user ?? null);
        
        await logAuthEvent({
          event: 'auth_session_check',
          metadata: { userId: session?.user?.id }
        });
      } catch (error) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      
      await logAuthEvent({
        event: `auth_state_change_${event}`,
        metadata: { userId: session?.user?.id }
      });
    });

    return () => subscription.unsubscribe();
  }, [getCurrentSession, supabase]);

  const login = useCallback(async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword(credentials);
      
      if (error) throw error;
      
      await logAuthEvent({
        event: 'auth_login_success',
        metadata: { userId: data.user?.id }
      });
      
      return data.user;
    } catch (error) {
      await logAuthEvent({
        event: 'auth_login_failed',
        metadata: { error: (error as Error).message }
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  const logout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) throw error;
      
      await logAuthEvent({
        event: 'auth_logout',
        metadata: { userId: user?.id }
      });
      
      router.push('/login');
    } catch (error) {
      await logAuthEvent({
        event: 'auth_logout_failed',
        metadata: { error: (error as Error).message }
      });
      throw error;
    }
  }, [supabase, router, user]);

  return { user, isLoading, login, logout, getSession: getCurrentSession };
}