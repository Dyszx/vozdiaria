// Entries Service — CRUD for voice note entries in Supabase (Postgres + Storage)
import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

export interface Entry {
  id?: string;
  text: string;
  audioUrl: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  createdAt: Date;
  duration: number; // em segundos
  edited: boolean;
  userId: string;
  deletedAt: Date | null;
}

export interface Category {
  id?: string;
  name: string;
  color: string;
  icon: string;
  userId: string;
}

// Default categories
export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'userId'>[] = [
  { name: 'Trabalho', color: '#6C63FF', icon: 'briefcase' },
  { name: 'Pessoal', color: '#43D9AD', icon: 'person' },
  { name: 'Estudos', color: '#FFB347', icon: 'school' },
];

function rowToEntry(row: any): Entry {
  return {
    id: row.id,
    text: row.text,
    audioUrl: row.audio_url,
    categoryId: row.category_id ?? '',
    categoryName: row.category_name,
    categoryColor: row.category_color,
    createdAt: new Date(row.created_at),
    duration: row.duration,
    edited: row.edited,
    userId: row.user_id,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  };
}

function rowToCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    userId: row.user_id,
  };
}

// Upload audio to Supabase Storage
export async function uploadAudio(localUri: string, userId: string): Promise<string> {
  const fileName = `audio_${userId}_${Date.now()}.m4a`;
  const path = `${userId}/${fileName}`;

  const base64 = await new File(localUri).base64();

  const { error: uploadError } = await supabase.storage
    .from('audios')
    .upload(path, decode(base64), { contentType: 'audio/m4a' });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('audios').getPublicUrl(path);
  return data.publicUrl;
}

// Create a new entry
export async function createEntry(
  entry: Omit<Entry, 'id'>,
  localAudioUri: string
): Promise<string> {
  const audioUrl = await uploadAudio(localAudioUri, entry.userId);

  const { data, error } = await supabase
    .from('entries')
    .insert({
      text: entry.text,
      audio_url: audioUrl,
      category_id: entry.categoryId,
      category_name: entry.categoryName,
      category_color: entry.categoryColor,
      created_at: entry.createdAt.toISOString(),
      duration: entry.duration,
      edited: entry.edited,
      user_id: entry.userId,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

// Get entries for a user, optionally filtered by date range
export async function getEntries(
  userId: string,
  startDate?: Date,
  endDate?: Date,
  categoryId?: string
): Promise<Entry[]> {
  let q = supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (startDate) q = q.gte('created_at', startDate.toISOString());
  if (endDate) q = q.lte('created_at', endDate.toISOString());
  if (categoryId) q = q.eq('category_id', categoryId);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map(rowToEntry);
}

// Update entry text (after manual edit)
export async function updateEntryText(entryId: string, newText: string): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .update({ text: newText, edited: true })
    .eq('id', entryId);

  if (error) throw error;
}

// Reassign an entry to a different category
export async function updateEntryCategory(entryId: string, category: Category): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .update({
      category_id: category.id,
      category_name: category.name,
      category_color: category.color,
    })
    .eq('id', entryId);

  if (error) throw error;
}

// Move entry to trash (soft delete)
export async function deleteEntry(entry: Entry): Promise<void> {
  if (!entry.id) return;
  const { error } = await supabase
    .from('entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', entry.id);
  if (error) throw error;
}

// Get entries currently in the trash
export async function getDeletedEntries(userId: string): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(rowToEntry);
}

// Restore an entry from the trash
export async function restoreEntry(entryId: string): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .update({ deleted_at: null })
    .eq('id', entryId);
  if (error) throw error;
}

// Permanently delete an entry (and its audio file)
export async function permanentlyDeleteEntry(entry: Entry): Promise<void> {
  if (!entry.id) return;

  const path = extractStoragePath(entry.audioUrl);
  if (path) {
    await supabase.storage.from('audios').remove([path]);
  }

  const { error } = await supabase.from('entries').delete().eq('id', entry.id);
  if (error) throw error;
}

function extractStoragePath(publicUrl: string): string | null {
  const marker = '/audios/';
  const idx = publicUrl.indexOf(marker);
  return idx === -1 ? null : publicUrl.slice(idx + marker.length);
}

// Get categories for user
export async function getCategories(userId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []).map(rowToCategory);
}

// Create default categories for new user
export async function createDefaultCategories(userId: string): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .insert(DEFAULT_CATEGORIES.map((cat) => ({ ...cat, user_id: userId })));

  if (error) throw error;
}

// Add new category
export async function addCategory(category: Omit<Category, 'id'>): Promise<string> {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: category.name,
      color: category.color,
      icon: category.icon,
      user_id: category.userId,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

// Delete a category. Notes that used it keep their saved category name/color
// (already stored on the entry itself) but stop being tied to a live category.
export async function deleteCategory(categoryId: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', categoryId);
  if (error) throw error;
}
