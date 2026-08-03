// Auth Context — Supabase Authentication state
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { getCategories, createDefaultCategories } from '../services/entries';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  approved: boolean;
  isAdmin: boolean;
  signUpWithEmailPassword: (email: string, password: string) => Promise<void>;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  approved: false,
  isAdmin: false,
  signUpWithEmailPassword: async () => {},
  signInWithEmailPassword: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const ensureDefaultCategories = async (sessionUser: User) => {
      const categories = await getCategories(sessionUser.id);
      if (categories.length === 0) {
        await createDefaultCategories(sessionUser.id);
      }
    };

    // Sem linha em profiles (ainda não foi aprovado manualmente) conta como
    // não aprovado — fecha por padrão, nunca abre.
    const loadProfile = async (sessionUser: User) => {
      const { data } = await supabase
        .from('profiles')
        .select('approved, is_admin')
        .eq('id', sessionUser.id)
        .maybeSingle();
      setApproved(data?.approved ?? false);
      setIsAdmin(data?.is_admin ?? false);
    };

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await Promise.all([ensureDefaultCategories(session.user), loadProfile(session.user)]);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session: Session | null) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await Promise.all([ensureDefaultCategories(session.user), loadProfile(session.user)]);
        } else {
          setApproved(false);
          setIsAdmin(false);
        }
        setLoading(false);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const signUpWithEmailPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signInWithEmailPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem('groq_api_key');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        approved,
        isAdmin,
        signUpWithEmailPassword,
        signInWithEmailPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
