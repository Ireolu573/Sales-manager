import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing Supabase environment variables. Check your .env file.');
}

function createSafeStorage(): Storage {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    return window.localStorage
  }

  const memoryStorage = new Map<string, string>()

  return {
    getItem(key: string) {
      return memoryStorage.has(key) ? memoryStorage.get(key) ?? null : null
    },
    setItem(key: string, value: string) {
      memoryStorage.set(key, value)
    },
    removeItem(key: string) {
      memoryStorage.delete(key)
    },
    clear() {
      memoryStorage.clear()
    },
    key(index: number) {
      return Array.from(memoryStorage.keys())[index] ?? null
    },
    get length() {
      return memoryStorage.size
    }
  } as Storage
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: createSafeStorage(),
    persistSession: true,
    autoRefreshToken: true,
  }
});
