'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Session, User } from '@supabase/supabase-js';
import getSupabaseClient from '@/lib/supabase-client';

let sessionCache: Session | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1000 * 60 * 5;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const mountedRef = useRef(true);
  const authCheckInProgressRef = useRef(false);
  
  // Get the Supabase client instance (singleton pattern)
  const client = getSupabaseClient();

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
      const { data: { session }, error } = await client!.auth.getSession();
      
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
  }, [client]);

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
    
    const { data: { subscription } } = client!.auth.onAuthStateChange(
      async (event: string, session: Session | null) => {
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
  }, [getCurrentSession, client, router]);

  const login = useCallback(async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    try {
      const { data, error } = await client!.auth.signInWithPassword(credentials);
      
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
  }, [client, router]);

  const logout = useCallback(async () => {
    try {
      const { error } = await client!.auth.signOut();
      
      if (error) throw error;

      sessionCache = null;
      cacheTimestamp = 0;
      
      router.push('/login');
    } catch (error) {
      throw error;
    }
  }, [client, router]);

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