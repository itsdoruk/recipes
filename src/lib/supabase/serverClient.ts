import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { CookieOptions } from '@supabase/ssr';

// Create a singleton instance of the Supabase client for server-side operations
let supabaseServerInstance: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Returns a Supabase client for server-side operations
 * This should only be used in API routes and server-side code
 */
export const getServerClient = () => {
  if (!supabaseServerInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    supabaseServerInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: 'pkce'
      },
      global: {
        headers: {
          'x-application-name': 'my-neighborhood-app-server'
        }
      }
    });
  }

  return supabaseServerInstance;
};

// Define cookie handlers interface
interface CookieHandlers {
  get: (name: string) => string | undefined;
  set: (name: string, value: string, options?: CookieOptions) => void;
  remove: (name: string) => void;
}

/**
 * Creates a Supabase client with the provided cookies for server-side rendering
 * This is useful for SSR with authenticated requests
 */
export const createServerClientWithCookies = (cookies: CookieHandlers) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      storage: {
        getItem: (name) => cookies.get(name) || null,
        setItem: (name, value) => cookies.set(name, value),
        removeItem: (name) => cookies.remove(name)
      }
    },
    global: {
      headers: {
        'x-application-name': 'my-neighborhood-app-server'
      }
    }
  });
}; 