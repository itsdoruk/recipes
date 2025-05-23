import { getSupabaseClient } from '@/lib/supabase';

/**
 * Fetches a user profile by user ID
 * @param userId The user ID to fetch the profile for
 * @returns The profile data or null if not found
 */
export async function fetchProfileById(userId: string) {
  try {
    if (!userId) return null;
    
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
      
    if (error) {
      console.error('Error fetching profile by ID:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Exception in fetchProfileById:', error);
    return null;
  }
}

/**
 * Fetches multiple profiles by user IDs
 * @param userIds Array of user IDs to fetch profiles for
 * @returns Map of user IDs to profile data
 */
export async function fetchProfilesByIds(userIds: string[]) {
  try {
    if (!userIds || userIds.length === 0) return {};
    
    // Filter out empty or invalid IDs
    const validUserIds = userIds.filter(id => id && typeof id === 'string');
    
    if (validUserIds.length === 0) return {};
    
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .select('*')
      .in('user_id', validUserIds);
      
    if (error) {
      console.error('Error fetching profiles by IDs:', error);
      return {};
    }
    
    // Create a map of user ID to profile
    const profileMap = data.reduce((acc: Record<string, any>, profile) => {
      acc[profile.user_id] = profile;
      return acc;
    }, {});
    
    return profileMap;
  } catch (error) {
    console.error('Exception in fetchProfilesByIds:', error);
    return {};
  }
}

/**
 * Fetches a profile by username
 * @param username The username to fetch the profile for
 * @returns The profile data or null if not found
 */
export async function fetchProfileByUsername(username: string) {
  try {
    if (!username) return null;
    
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();
      
    if (error) {
      console.error('Error fetching profile by username:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Exception in fetchProfileByUsername:', error);
    return null;
  }
}

/**
 * Searches for profiles by username (partial match)
 * @param query The search query
 * @param limit Maximum number of results to return
 * @param excludeUserId Optional user ID to exclude from results
 * @returns Array of matching profiles
 */
export async function searchProfiles(query: string, limit = 10, excludeUserId?: string) {
  try {
    if (!query) return [];
    
    let profileQuery = getSupabaseClient()
      .from('profiles')
      .select('*')
      .ilike('username', `%${query}%`)
      .limit(limit);
      
    // Exclude user if specified
    if (excludeUserId) {
      profileQuery = profileQuery.neq('user_id', excludeUserId);
    }
    
    const { data, error } = await profileQuery;
    
    if (error) {
      console.error('Error searching profiles:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Exception in searchProfiles:', error);
    return [];
  }
} 