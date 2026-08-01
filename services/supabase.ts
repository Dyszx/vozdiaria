// Supabase Configuration
// ========================
// Passos para configurar:
// 1. Acesse https://supabase.com e crie um projeto novo (gratuito)
// 2. Vá em Project Settings > API
// 3. Copie a "Project URL" e a chave "anon public" abaixo
// 4. Rode o SQL em supabase/schema.sql no SQL Editor do painel Supabase
//    (cria as tabelas, RLS e o bucket de áudio)
// 5. Em Authentication > Providers, ative o método de login desejado (Google, etc.)

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fvfjvqkxbzqchqncschx.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2Zmp2cWt4YnpxY2hxbmNzY2h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1NDUyNTQsImV4cCI6MjEwMTEyMTI1NH0.QzFyf2Zsn7cCyC36F9ZdlDtigcEYEm2G0h_6IP0qLTk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export default supabase;
1