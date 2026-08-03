// Profiles Service — account approval (admin-only, enforced by RLS via is_admin())
import { supabase } from './supabase';

export interface Profile {
  id: string;
  email: string | null;
  approved: boolean;
  isAdmin: boolean;
  createdAt: Date;
}

function rowToProfile(row: any): Profile {
  return {
    id: row.id,
    email: row.email,
    approved: row.approved,
    isAdmin: row.is_admin,
    createdAt: new Date(row.created_at),
  };
}

// Só retorna todas as contas se quem chamar for admin — pra qualquer outra
// conta, a policy "Users can read own profile" restringe a resposta só à sua própria linha.
export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(rowToProfile);
}

export async function setApproval(userId: string, approved: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ approved }).eq('id', userId);
  if (error) throw error;
}
