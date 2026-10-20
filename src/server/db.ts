import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { HttpError } from './auth';
export function database() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(503, 'Database configuration is unavailable.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function requireOwned(table: 'user_cars' | 'garages' | 'mining_sessions', id: unknown, userId: string) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw new HttpError(400, 'Invalid item.');
  const { data, error } = await database().from(table).select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw new HttpError(503, 'Unable to check item ownership.');
  if (!data) throw new HttpError(404, 'Item not found.');
  return data;
}
