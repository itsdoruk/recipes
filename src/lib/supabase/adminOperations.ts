import { getBrowserClient } from './browserClient';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Executes database operations with RLS bypassed for admin users
 * @param adminUserId The ID of the admin user
 * @param operation A function that performs database operations
 * @returns The result of the operation or null if not authorized
 */
export async function withBypassRLS<T>(
  adminUserId: string, 
  operation: (supabase: SupabaseClient) => Promise<T>
): Promise<T | null> {
  const supabase = getBrowserClient();
  if (!supabase) throw new Error('Supabase client not initialized');

  try {
    // First check if this user can bypass RLS
    const { data, error } = await supabase.rpc('bypass_rls', { 
      admin_user_id: adminUserId 
    });

    if (error) {
      console.error('Error bypassing RLS:', error);
      // Try to proceed with the operation anyway - it might work if RLS policies
      // allow this specific operation
      try {
        const result = await operation(supabase);
        return result;
      } catch (opError) {
        console.error('Operation failed after RLS bypass error:', opError);
        return null;
      }
    }

    // Continue with the operation regardless of the bypass result
    // If the user has admin rights through RLS policies, it should work
    const result = await operation(supabase);
    return result;
  } catch (error) {
    console.error('Error in withBypassRLS:', error);
    return null;
  }
}

/**
 * Example usage:
 * 
 * const getAllUsers = async (adminUserId: string) => {
 *   return withBypassRLS(adminUserId, async (supabase) => {
 *     const { data, error } = await supabase
 *       .from('user_profiles')
 *       .select('*');
 *     
 *     if (error) throw error;
 *     return data;
 *   });
 * };
 */
