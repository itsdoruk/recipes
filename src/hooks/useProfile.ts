import { useState, useEffect, useCallback } from 'react';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Profile } from '@/types/supabase';

export function useProfile() {
  const session = useSession();
  const supabase = useSupabaseClient();
  const user = session?.user;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch the profile data
  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      console.log('Fetching profile for user:', user.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        // If profile doesn't exist, create one
        if (error.code === 'PGRST116') {
          console.log('Profile not found, creating new profile...');
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              user_id: user.id,
              username: `user_${user.id.slice(0, 8)}`,
              is_private: false,
              show_email: false,
              bio: null,
              banned: false,
              ban_type: null,
              ban_reason: null,
              ban_expiry: null,
              ban_count: 0,
              last_ban_date: null,
              warnings: 0,
              is_admin: false
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating profile:', createError);
            setError('Failed to create profile');
            throw createError;
          }

          console.log('New profile created:', newProfile);
          setProfile(newProfile);
          setIsLoading(false);
          return;
        }
        setError('Failed to fetch profile');
        throw error;
      }

      if (!data) {
        console.log('No profile data returned, creating new profile...');
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            username: `user_${user.id.slice(0, 8)}`,
            is_private: false,
            show_email: false,
            bio: null,
            banned: false,
            ban_type: null,
            ban_reason: null,
            ban_expiry: null,
            ban_count: 0,
            last_ban_date: null,
            warnings: 0,
            is_admin: false
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          setError('Failed to create profile');
          throw createError;
        }

        console.log('New profile created:', newProfile);
        setProfile(newProfile);
      } else {
        console.log('Profile fetched successfully:', data);
        setProfile(data);
      }
    } catch (error) {
      console.error('Error in useProfile:', error);
      setError('An error occurred while fetching profile');
    } finally {
      setIsLoading(false);
    }
  }, [user, supabase]);

  // Public method to refresh the profile
  const refreshProfile = useCallback(async () => {
    setIsLoading(true);
    await fetchProfile();
  }, [fetchProfile]);

  // Handle profile fetching
  useEffect(() => {
    // Skip if we don't have user
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    console.log('useProfile: User detected', { userId: user.id });

    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log('Profile loading timeout reached');
        setIsLoading(false);
        setError('Loading timed out. Please refresh the page.');
      }
    }, 5000); // 5 second timeout

    fetchProfile();
    
    return () => clearTimeout(timeout);
  }, [user, fetchProfile]);

  return { profile, isLoading, error, refreshProfile };
} 