import { createBrowserClient } from '@supabase/ssr'
import { safeLocalStorage } from '../safeLocalStorage'

const isBrowser = typeof window !== 'undefined'

const customStorage = isBrowser
  ? {
      getItem: (key: string): string | null => {
        try {
          return safeLocalStorage.getItem(key)
        } catch (error) {
          console.error('Error reading from localStorage:', error)
          return null
        }
      },
      setItem: (key: string, value: string): void => {
        try {
          safeLocalStorage.setItem(key, value)
        } catch (error) {
          console.error('Error writing to localStorage:', error)
        }
      },
      removeItem: (key: string): void => {
        try {
          safeLocalStorage.removeItem(key)
        } catch (error) {
          console.error('Error removing from localStorage:', error)
        }
      }
    }
  : undefined

let supabase: ReturnType<typeof createBrowserClient> | null = null

// Create a mock client for server-side rendering
const createMockClient = () => ({
  auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    getSession: () => Promise.resolve({ data: { session: null } }),
    signOut: () => Promise.resolve({ error: null })
  },
  from: () => ({
    select: () => ({
      order: () => ({
        eq: () => Promise.resolve({ data: [], error: null })
      })
    }),
    insert: () => ({
      select: () => ({
        single: () => Promise.resolve({ data: null, error: null })
      })
    })
  })
})

export const getBrowserClient = () => {
  if (!isBrowser) {
    return createMockClient() as any
  }

  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: customStorage
      },
      global: {
        headers: {
          'x-application-name': 'my-neighborhood-app'
        }
      }
    } as any)
  }

  return supabase
}

export type Recipe = {
  id?: string;
  title: string;
  ingredients: string[];
  instructions: string[];
  image_url?: string;
  created_at?: string;
  user_id?: string;
};

export interface Report {
  id: string;
  recipe_id: string;
  recipe_type: 'user' | 'ai' | 'spoonacular';
  user_id: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'resolved';
  created_at: string;
}

export async function submitReport(report: Omit<Report, 'id' | 'created_at' | 'status'>) {
  const supabase = getBrowserClient()
  const { data, error } = await supabase
    .from('reports')
    .insert({
      ...report,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getReports(status?: Report['status']) {
  const supabase = getBrowserClient();
  let query = supabase
    .from('reports_with_profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (status) {
    query = query.eq('status', status);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export function removeChannel(channel: any) {
  if (channel) {
    try {
      channel.unsubscribe();
    } catch (error) {
      console.error('Error unsubscribing from channel:', error);
    }
  }
} 