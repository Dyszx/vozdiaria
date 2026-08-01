// Auth Context — Supabase Authentication state
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { getCategories, createDefaultCategories } from '../services/entries';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  linkEmailPassword: (email: string, password: string) => Promise<void>;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  linkEmailPassword: async () => {},
  signInWithEmailPassword: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ensureDefaultCategories = async (sessionUser: User) => {
      const categories = await getCategories(sessionUser.id);
      if (categories.length === 0) {
        await createDefaultCategories(sessionUser.id);
      }
    };

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        // App pessoal, sem tela de login: cria uma sessão anônima automaticamente.
        const { error } = await supabase.auth.signInAnonymously();
        if (error) console.error('Anonymous sign in error:', error);
        return;
      }
      setUser(session.user);
      setLoading(false);
      await ensureDefaultCategories(session.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session: Session | null) => {
        setUser(session?.user ?? null);
        setLoading(false);
        if (session?.user) await ensureDefaultCategories(session.user);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    // Note: OAuth com deep link precisa de configuração extra no Expo
    // (scheme em app.json + expo-web-browser). Configure em Authentication >
    // Providers > Google no painel Supabase antes de habilitar este fluxo.
    try {
      await supabase.auth.signInWithOAuth({ provider: 'google' });
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem('groq_api_key');
    // Sem tela de login, gera uma nova sessão anônima na hora para o app continuar usável.
    // Nota: isso perde acesso às notas da sessão anterior (são vinculadas ao user_id anônimo antigo).
    await supabase.auth.signInAnonymously();
  };

  // Transforma a conta anônima atual em uma conta permanente (mesmo user_id,
  // mesmas notas — não perde nada). Por padrão o Supabase manda um e-mail de
  // confirmação; a conta só fica "não-anônima" depois que o link é confirmado.
  const linkEmailPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.updateUser({ email, password });
    if (error) throw error;
  };

  // Entra numa conta permanente já existente (ex: depois de reinstalar o app
  // ou trocar de aparelho), substituindo a sessão anônima atual.
  const signInWithEmailPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signInWithGoogle, signOut, linkEmailPassword, signInWithEmailPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
