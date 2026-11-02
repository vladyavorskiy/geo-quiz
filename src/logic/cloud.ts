import { createClient, type Session } from '@supabase/supabase-js';
import type { Stats } from './progress';
import type { Settings } from './types';

/*
 * Облачное хранение прогресса в Supabase: одна строка в таблице `progress` на аккаунт
 * (схема — supabase/schema.sql). Ключи берутся из .env.local; без них облако просто выключено.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const supabase = url && key ? createClient(url, key) : null;

export interface CloudData {
  settings: Settings | null;
  stats: Stats;
}

export async function currentSession(): Promise<Session | null> {
  return (await supabase?.auth.getSession())?.data.session ?? null;
}

/** Прогресс из облака; null — записи ещё нет. */
export async function pull(): Promise<CloudData | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('progress').select('settings, stats').maybeSingle();
  if (error) throw error;
  return data ? { settings: data.settings, stats: data.stats ?? {} } : null;
}

export async function push(data: CloudData): Promise<void> {
  const session = await currentSession();
  if (!supabase || !session) return; // не вошли — храним только локально
  const { error } = await supabase
    .from('progress')
    .upsert({ user_id: session.user.id, settings: data.settings, stats: data.stats, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Отправка не чаще раза в 1.5 с: после серии ответов уходит одна запись. */
let timer: ReturnType<typeof setTimeout> | undefined;
export function schedulePush(get: () => CloudData) {
  if (!supabase) return;
  clearTimeout(timer);
  timer = setTimeout(() => push(get()).catch((e) => console.warn('Не удалось сохранить прогресс в облако:', e)), 1500);
}
