import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

/**
 * Creates a Supabase admin client that bypasses RLS using service_role key
 * IMPORTANT: This should only be used in server-side code (API routes)
 * Never expose your service role key in client-side code
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase URL or service role key is not defined in environment variables');
  }
  
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Executes database operations with RLS bypassed using service role key
 * Only use this in API routes, never in client-side code
 *
 * @param operation Function that performs database operations with admin privileges
 * @returns Result of the operation
 */
export async function withServiceRoleBypass<T>(
  operation: (supabase: ReturnType<typeof createAdminClient>) => Promise<T>
): Promise<T> {
  const adminClient = createAdminClient();
  return operation(adminClient);
}

/**
 * Example usage in an API route:
 * 
 * export default async function handler(req, res) {
 *   try {
 *     const result = await withServiceRoleBypass(async (supabase) => {
 *       const { data, error } = await supabase
 *         .from('user_profiles')
 *         .select('*');
 *       
 *       if (error) throw error;
 *       return data;
 *     });
 *     
 *     return res.status(200).json(result);
 *   } catch (error) {
 *     return res.status(500).json({ error: error.message });
 *   }
 * }
 */
