import { getSupabaseClient } from '@/lib/supabase';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { Profile } from '@/types/supabase';

// Helper function to handle role policy errors
async function handleRolePolicyError<T>(
  identifier: string | string[],
  fallbackQuery: () => Promise<{ data: T | null; error: any }>
): Promise<T | null> {
  console.error('Role policy error detected, trying fallback query');
  const { data, error } = await fallbackQuery();
  
  if (error) {
    console.error('Error in fallback query:', error);
    return null;
  }
  
  return data;
}

/**
 * Fetches a user profile by user ID with optimized query
 * @param userId The user ID to fetch the profile for
 * @returns The profile data or null if not found
 */
export async function fetchProfileById(userId: string) {
  try {
    if (!userId) return null;
    
    // Use a single query with joins to get profile and counts
    const { data: profile, error: profileError } = await getBrowserClient()
      .from('profiles')
      .select(`
        *,
        followers:follows!following_id(count),
        following:follows!follower_id(count)
      `)
      .eq('user_id', userId)
      .single();
      
    if (profileError) {
      // Handle specific error cases
      if (profileError.code === 'PGRST116') {
        return null; // Profile not found
      }
      if (profileError.code === '42P17') {
        // Try a simpler query without joins as fallback
        const fallbackProfile = await handleRolePolicyError(userId, () => 
          getBrowserClient()
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single()
        );
        
        if (!fallbackProfile) {
          return {
            user_id: userId,
            username: null,
            avatar_url: null,
            bio: null,
            is_private: false,
            show_email: false,
            followers_count: 0,
            following_count: 0
          };
        }
        
        return {
          ...fallbackProfile,
          followers_count: 0,
          following_count: 0
        };
      }
      console.error('Error fetching profile by ID:', profileError);
      throw profileError;
    }

    // Extract counts from the joined data
    const followers_count = profile.followers?.[0]?.count || 0;
    const following_count = profile.following?.[0]?.count || 0;

    // Remove the joined data and add the counts
    const { followers, following, ...profileData } = profile;
    return {
      ...profileData,
      followers_count,
      following_count
    };
  } catch (error) {
    console.error('Exception in fetchProfileById:', error);
    // Return a minimal profile object instead of throwing
    return {
      user_id: userId,
      username: null,
      avatar_url: null,
      bio: null,
      is_private: false,
      show_email: false,
      followers_count: 0,
      following_count: 0
    };
  }
}

/**
 * Fetches multiple profiles by user IDs with optimized query
 * @param userIds Array of user IDs to fetch profiles for
 * @returns Map of user IDs to profile data
 */
export async function fetchProfilesByIds(userIds: string[]) {
  try {
    if (!userIds?.length) return {};
    
    // Use a single query with joins to get profiles and counts
    const { data: profiles, error: profilesError } = await getBrowserClient()
      .from('profiles')
      .select(`
        *,
        followers:follows!following_id(count),
        following:follows!follower_id(count)
      `)
      .in('user_id', userIds);
      
    if (profilesError) {
      if (profilesError.code === '42P17') {
        // Try a simpler query without joins as fallback
        const fallbackProfiles = await handleRolePolicyError<Profile[]>(userIds, () =>
          getBrowserClient()
            .from('profiles')
            .select('*')
            .in('user_id', userIds)
        );
        
        if (!fallbackProfiles) return {};
        
        // Create profile map with zero counts
        return fallbackProfiles.reduce((acc: Record<string, Profile>, profile: Profile) => {
          acc[profile.user_id] = {
            ...profile,
            followers_count: 0,
            following_count: 0
          };
          return acc;
        }, {});
      }
      console.error('Error fetching profiles by IDs:', profilesError);
      throw profilesError;
    }

    // Create profile map with counts
    const profileMap = profiles.reduce((acc: Record<string, Profile>, profile: any) => {
      const { followers, following, ...profileData } = profile;
      acc[profile.user_id] = {
        ...profileData,
        followers_count: followers?.[0]?.count || 0,
        following_count: following?.[0]?.count || 0
      };
      return acc;
    }, {});
    
    return profileMap;
  } catch (error) {
    console.error('Exception in fetchProfilesByIds:', error);
    // Return empty map instead of throwing
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
    
    const { data, error } = await getBrowserClient()
      .from('profiles')
      .select(`
        *,
        followers:follows!following_id(count),
        following:follows!follower_id(count)
      `)
      .eq('username', username)
      .single();
      
    if (error) {
      if (error.code === '42P17') {
        // Try a simpler query without joins as fallback
        const fallbackProfile = await handleRolePolicyError(username, () =>
          getBrowserClient()
            .from('profiles')
            .select('*')
            .eq('username', username)
            .single()
        );
        
        if (!fallbackProfile) return null;
        
        return {
          ...fallbackProfile,
          followers_count: 0,
          following_count: 0
        };
      }
      console.error('Error fetching profile by username:', error);
      return null;
    }

    // Extract counts from the joined data
    const followers_count = data.followers?.[0]?.count || 0;
    const following_count = data.following?.[0]?.count || 0;

    // Remove the joined data and add the counts
    const { followers, following, ...profileData } = data;
    return {
      ...profileData,
      followers_count,
      following_count
    };
  } catch (error) {
    console.error('Exception in fetchProfileByUsername:', error);
    return null;
  }
}

/**
 * Searches for profiles by username with optimized query
 * @param query The search query
 * @param limit Maximum number of results to return
 * @param excludeUserId Optional user ID to exclude from results
 * @returns Array of matching profiles
 */
export async function searchProfiles(query: string, limit = 10, excludeUserId?: string) {
  try {
    if (!query) return [];
    
    // Build the base query with joins
    let profileQuery = getBrowserClient()
      .from('profiles')
      .select(`
        *,
        followers:follows!following_id(count),
        following:follows!follower_id(count)
      `)
      .ilike('username', `%${query}%`)
      .limit(limit);
      
    if (excludeUserId) {
      profileQuery = profileQuery.neq('user_id', excludeUserId);
    }
    
    const { data: profiles, error: profilesError } = await profileQuery;
    
    if (profilesError) {
      if (profilesError.code === '42P17') {
        // Try a simpler query without joins as fallback
        let fallbackQuery = getBrowserClient()
          .from('profiles')
          .select('*')
          .ilike('username', `%${query}%`)
          .limit(limit);
          
        if (excludeUserId) {
          fallbackQuery = fallbackQuery.neq('user_id', excludeUserId);
        }
        
        const fallbackProfiles = await handleRolePolicyError<Profile[]>(query, () => fallbackQuery);
        
        if (!fallbackProfiles) return [];
        
        return fallbackProfiles.map((profile: Profile) => ({
          ...profile,
          followers_count: 0,
          following_count: 0
        }));
      }
      console.error('Error searching profiles:', profilesError);
      throw profilesError;
    }

    if (!profiles?.length) return [];

    // Transform the results to include counts
    return profiles.map((profile: any) => {
      const { followers, following, ...profileData } = profile;
      return {
        ...profileData,
        followers_count: followers?.[0]?.count || 0,
        following_count: following?.[0]?.count || 0
      };
    });
  } catch (error) {
    console.error('Exception in searchProfiles:', error);
    return [];
  }
}

/**
 * Creates a new profile for a user
 * @param userId The user ID to create the profile for
 * @param username Optional username (will generate one if not provided)
 * @returns The created profile
 */
export async function createProfile(userId: string, username?: string) {
  try {
    if (!userId) throw new Error('User ID is required');
    
    const generatedUsername = username || `user_${userId.slice(0, 8)}`;
    
    const { data, error } = await getBrowserClient()
      .from('profiles')
      .insert({
        user_id: userId,
        username: generatedUsername,
        is_private: false,
        show_email: false,
        banned: false,
        ban_count: 0,
        warnings: 0,
        dietary_restrictions: [],
        cooking_skill_level: null
      })
      .select()
      .single();
      
    if (error) {
      console.error('Error creating profile:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Exception in createProfile:', error);
    throw error;
  }
}

export async function getProfilesByIds(userIds: string[]): Promise<Record<string, Profile>> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('user_id', userIds);

  if (error) throw error;
  const profileMap = data.reduce((acc: Record<string, Profile>, profile: Profile) => {
    acc[profile.user_id] = profile;
    return acc;
  }, {});

  return profileMap;
} 