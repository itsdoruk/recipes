import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl ? 'Set' : 'Not set');
console.log('Supabase Anon Key:', supabaseAnonKey ? 'Set' : 'Not set');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

// Create a singleton instance of the Supabase client
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

export const getSupabaseClient = () => {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
        // Add reconnection options
        reconnectAfterMs: (retryCount: number) => Math.min(1000 * Math.pow(2, retryCount), 30000),
        // Add connection timeout
        timeout: 10000,
      },
      global: {
        headers: {
          'x-application-name': 'my-neighborhood-app',
        },
      },
    });

    // Add error handling for realtime connection
    const channel = supabaseInstance.channel('system');
    
    channel
      .on('system', { event: 'disconnected' }, () => {
        console.warn('Supabase realtime disconnected');
      })
      .on('system', { event: 'connected' }, () => {
        console.log('Supabase realtime connected');
      })
      .subscribe((status: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR') => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to realtime updates');
        } else if (status === 'CLOSED') {
          console.warn('Realtime subscription closed');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Realtime channel error');
        }
      });
  }

  return supabaseInstance;
};

// Export a default instance for backward compatibility
export const supabase = getSupabaseClient();

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
  status: 'under review' | 'resolved';
  created_at: string;
}

export async function submitReport(report: Omit<Report, 'id' | 'created_at' | 'status'>) {
  const { data, error } = await supabase
    .from('reports')
    .insert({
      ...report,
      status: 'under review'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getReports(status?: Report['status']) {
  const query = supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}