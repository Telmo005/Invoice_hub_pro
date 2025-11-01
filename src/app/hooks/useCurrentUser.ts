'use client';

import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

export const useCurrentUser = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const getCurrentUser = async () => {
      try {
        setIsLoading(true);
        const { data: { user }, error } = await supabase.auth.getUser();

        if (!mounted) return;

        if (error) throw error;
        setUser(user);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err : new Error('Erro ao carregar usuário'));
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
      }
    });

    getCurrentUser();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return { user, isLoading, error };
};