import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl ? 'Set' : 'Not set');
console.log('Supabase Anon Key:', supabaseAnonKey ? 'Set' : 'Not set');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
  global: {
    headers: {
      'x-application-name': 'my-neighborhood-app'
    }
  }
});

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