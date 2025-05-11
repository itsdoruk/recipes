import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Create a singleton instance of the Supabase client
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

export const getSupabaseClient = () => {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        },
        // Add reconnection options
        reconnectAfterMs: (retryCount: number) => Math.min(1000 * Math.pow(2, retryCount), 30000),
        // Add connection timeout
        timeout: 10000
      },
      global: {
        headers: {
          'x-application-name': 'my-neighborhood-app'
        }
      }
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to realtime updates');
        } else if (status === 'CLOSED') {
          console.warn('Realtime subscription closed');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Realtime channel error');
        }
      });

    // // Set a connection timeout
    // const connectionTimeout = setTimeout(() => {
    //   if (channel.state === 'CLOSED') {
    //     console.log('WebSocket connection timeout, attempting to reconnect...');
    //     channel.subscribe();
    //   }
    // }, 10000); // 10 second timeout

    // // Clean up timeout on successful connection
    // channel.on('system', { event: 'connected' }, () => {
    //   clearTimeout(connectionTimeout);
    // });

    // // Handle page visibility changes
    // if (typeof window !== 'undefined') {
    //   document.addEventListener('visibilitychange', () => {
    //     if (document.visibilityState === 'visible') {
    //       console.log('Page visible, checking WebSocket connection...');
    //       if (channel.state === 'CLOSED') {
    //         channel.subscribe();
    //       }
    //     }
    //   });
    // }
  }

  return supabaseInstance;
};

// Export the singleton instance
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
  user_id: string;
  reported_user_id?: string;
  recipe_id?: string;
  recipe_type?: 'user' | 'spoonacular' | 'ai';
  reason: string;
  details?: string;
  status: 'pending' | 'reviewed' | 'resolved';
  created_at: string;
}

export async function submitReport(report: Omit<Report, 'id' | 'created_at' | 'status'>) {
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