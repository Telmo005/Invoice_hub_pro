'use client'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'
import { ROUTES } from '@/config/routes'

type AuthContextType = {
  supabase: SupabaseClient<Database>
  user: any
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
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClientComponentClient<Database>()
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setIsLoading(false)

      if (event === 'SIGNED_IN') {
        router.refresh()
      }
    })

    return () => {
      subscription?.unsubscribe()
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
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.push(ROUTES.HOME) // Redireciona para a página inicial
      router.refresh()
    } catch (error) {
      console.error('Error signing out:', error)
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