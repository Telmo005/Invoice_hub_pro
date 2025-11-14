'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, Session, User } from '@supabase/supabase-js';

let sessionCache: Session | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1000 * 60 * 5;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const mountedRef = useRef(true);
  const authCheckInProgressRef = useRef(false);
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Reuse a global client if one already exists to avoid multiple GoTrueClient
  // instances in the same browser context which can lead to the warning:
  // "Multiple GoTrueClient instances detected in the same browser context.".
  // We store the client on `window.__supabase_client` so different hooks/modules
  // can reuse the same underlying client.
  const supabaseRef = useRef<any | null>(null);
  if (!supabaseRef.current) {
    if (typeof window !== 'undefined' && (window as any).__supabase_client) {
      supabaseRef.current = (window as any).__supabase_client;
    } else {
      supabaseRef.current = supabase;
      if (typeof window !== 'undefined') {
        (window as any).__supabase_client = supabaseRef.current;
      }
    }
  }
  const client = supabaseRef.current;

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
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;

      sessionCache = session;
      cacheTimestamp = now;
      
      return session;
    } catch {
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
      } catch {
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
      const { data, error } = await supabase.auth.signInWithPassword(credentials);
      
      if (error) throw error;

      sessionCache = data.session;
      cacheTimestamp = Date.now();
      
      router.refresh();
      return data.user;
    } catch (error) {
      sessionCache = null;
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
      
      router.push('/login');
    } catch (error) {
      throw error;
    }
  }, [supabase, router]);

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