'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, Session, User } from '@supabase/supabase-js';
import { logAuthEvent } from '@/lib/security/audit-log';

// Cache de sessão em memória
let sessionCache: Session | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutos

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const mountedRef = useRef(true);
  const authCheckInProgressRef = useRef(false);
  
  // ✅ CORREÇÃO: Usar createClient em vez de createBrowserClient
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const getCurrentSession = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && sessionCache && (now - cacheTimestamp) < CACHE_DURATION) {
      return sessionCache;
    }

    if (authCheckInProgressRef.current) {
      return sessionCache;
    }

    authCheckInProgressRef.current = true;

    try {
      console.time('Supabase Auth Session Check');
      const { data: { session }, error } = await supabase.auth.getSession();
      console.timeEnd('Supabase Auth Session Check');
      
      if (error) throw error;

      sessionCache = session;
      cacheTimestamp = now;
      
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      sessionCache = null;
      return null;
    } finally {
      authCheckInProgressRef.current = false;
    }
  }, [supabase]);

  useEffect(() => {
    mountedRef.current = true;

    const initializeAuth = async () => {
      if (!mountedRef.current) return;

      setIsLoading(true);
      try {
        const session = await getCurrentSession();
        
        if (mountedRef.current) {
          setUser(session?.user ?? null);
        }

        await logAuthEvent({
          event: 'auth_session_check',
          metadata: { userId: session?.user?.id, cached: !!sessionCache }
        });
      } catch (error) {
        if (mountedRef.current) {
          setUser(null);
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    let stateChangeTimeout: NodeJS.Timeout;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        clearTimeout(stateChangeTimeout);
        
        stateChangeTimeout = setTimeout(async () => {
          if (!mountedRef.current) return;

          sessionCache = session;
          cacheTimestamp = Date.now();
          
          setUser(session?.user ?? null);

          await logAuthEvent({
            event: `auth_state_change_${event}`,
            metadata: { userId: session?.user?.id }
          });

          if (event === 'SIGNED_IN') {
            router.refresh();
          } else if (event === 'SIGNED_OUT') {
            sessionCache = null;
            router.push('/login');
          } else if (event === 'TOKEN_REFRESHED') {
            sessionCache = session;
          }
        }, 100);
      }
    );

    return () => {
      mountedRef.current = false;
      clearTimeout(stateChangeTimeout);
      subscription.unsubscribe();
    };
  }, [getCurrentSession, supabase, router]);

  const login = useCallback(async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    try {
      console.time('Supabase Auth Login');
      const { data, error } = await supabase.auth.signInWithPassword(credentials);
      console.timeEnd('Supabase Auth Login');
      
      if (error) throw error;

      sessionCache = data.session;
      cacheTimestamp = Date.now();

      await logAuthEvent({
        event: 'auth_login_success',
        metadata: { userId: data.user?.id }
      });
      
      router.refresh();
      return data.user;
    } catch (error) {
      sessionCache = null;
      
      await logAuthEvent({
        event: 'auth_login_failed',
        metadata: { error: (error as Error).message }
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [supabase, router]);

  const logout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) throw error;

      sessionCache = null;
      cacheTimestamp = 0;
      
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

  const refreshSession = useCallback(async () => {
    return await getCurrentSession(true);
  }, [getCurrentSession]);

  return { 
    user, 
    isLoading, 
    login, 
    logout, 
    getSession: getCurrentSession,
    refreshSession
  };
}