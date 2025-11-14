'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState, useRef } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { ROUTES } from '@/config/routes'

type AuthContextType = {
  supabase: SupabaseClient
  user: User | null
  isLoading: boolean
  signInWithOAuth: (provider: 'google' | 'facebook', redirectTo?: string) => Promise<void>
  signOut: () => Promise<void>
}

const Context = createContext<AuthContextType | undefined>(undefined)

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const [supabase] = useState(() => 
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  )

  // Debounce refs to avoid multiple rapid router navigations/refreshes
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerRefresh = () => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = setTimeout(() => {
      try {
        router.refresh();
      } finally {
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      }
    }, 150);
  };

  const triggerPushHome = (path = ROUTES.HOME) => {
    if (pushTimerRef.current) return;
    pushTimerRef.current = setTimeout(() => {
      try {
        router.push(path);
      } finally {
        if (pushTimerRef.current) {
          clearTimeout(pushTimerRef.current);
          pushTimerRef.current = null;
        }
      }
    }, 150);
  };

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
      } catch (error) {
        console.error('Error getting initial session:', error)
      } finally {
        setIsLoading(false)
      }
    }

    getInitialSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setIsLoading(false)

      if (event === 'SIGNED_IN') {
        triggerRefresh();
      } else if (event === 'SIGNED_OUT') {
        triggerRefresh();
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, supabase])

  const signInWithOAuth = async (provider: 'google' | 'facebook', redirectTo?: string) => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect_to=${redirectTo || ROUTES.DASHBOARD}`,
        },
      })
      if (error) throw error
    } catch (error) {
      console.error('Error signing in:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      // Use debounced navigation/refresh to avoid duplicate requests
      triggerPushHome(ROUTES.HOME)
      triggerRefresh()
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  }

  return (
    <Context.Provider value={{ supabase, user, isLoading, signInWithOAuth, signOut }}>
      {children}
    </Context.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(Context)
  if (context === undefined) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}