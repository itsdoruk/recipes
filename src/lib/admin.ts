import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { getBrowserClient } from './supabase/browserClient';
import { withBypassRLS } from './supabase/adminOperations';

// Cache admin status for 5 minutes
const ADMIN_CACHE_DURATION = 5 * 60 * 1000;
const adminCache = new Map<string, { isAdmin: boolean; timestamp: number }>();

export async function checkAdminStatus(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;

  // Check cache first
  const cached = adminCache.get(userId);
  if (cached && Date.now() - cached.timestamp < ADMIN_CACHE_DURATION) {
    return cached.isAdmin;
  }

  try {
    const supabase = getBrowserClient();

    // Check the user's admin status
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }

    const isAdmin = !!data?.is_admin;
    
    // Update cache
    adminCache.set(userId, {
      isAdmin,
      timestamp: Date.now()
    });

    return isAdmin;
  } catch (error) {
    console.error('Error in checkAdminStatus:', error);
    return false;
  }
}

export function clearAdminCache(userId?: string) {
  if (userId) {
    adminCache.delete(userId);
  } else {
    adminCache.clear();
  }
}

export async function requireAdmin(userId: string | undefined): Promise<boolean> {
  if (!userId) {
    throw new Error('No user ID provided');
  }
  
  const isAdmin = await checkAdminStatus(userId);
  if (!isAdmin) {
    throw new Error('Unauthorized: Admin access required');
  }
  return true;
}

// Helper function to verify admin status with retries
export async function verifyAdminWithRetry(
  userId: string | undefined,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<boolean> {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const isAdmin = await checkAdminStatus(userId);
      if (isAdmin) return true;
      
      // If not admin, wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
      retries++;
    } catch (error) {
      console.error(`Admin verification attempt ${retries + 1} failed:`, error);
      retries++;
      if (retries === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return false;
}

// Helper function to handle admin-only operations
export async function withAdminCheck<T>(
  userId: string | undefined,
  operation: () => Promise<T>
): Promise<T> {
  await requireAdmin(userId);
  return operation();
}

// Helper function to perform operations with RLS bypassed
export async function withAdminBypassRLS<T>(
  userId: string | undefined,
  operation: (supabase: any) => Promise<T>
): Promise<T> {
  if (!userId) {
    throw new Error('No user ID provided');
  }
  
  const isAdmin = await checkAdminStatus(userId);
  if (!isAdmin) {
    throw new Error('Unauthorized: Admin access required');
  }
  
  // Get Supabase client
  const supabase = getBrowserClient();
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  try {
    // Try to use RLS bypass
    const result = await withBypassRLS(userId, operation);
    
    // If result is null, try a direct approach as a fallback
    if (result === null) {
      console.warn('RLS bypass failed, attempting direct operation with admin RLS policies');
      return await operation(supabase);
    }
    
    return result;
  } catch (error) {
    console.error('Error in withAdminBypassRLS:', error);
    // One more attempt without trying to bypass RLS, relying on existing RLS policies
    try {
      return await operation(supabase);
    } catch (fallbackError) {
      console.error('Fallback operation also failed:', fallbackError);
      throw new Error('Failed to perform admin operation: ' + 
        (error instanceof Error ? error.message : String(error)));
    }
  }
} 