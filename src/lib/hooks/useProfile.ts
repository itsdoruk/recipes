import { useEffect, useState } from 'react';
import { useUser } from './useUser';
import { getBrowserClient } from '../supabase/browserClient';
import { Profile } from '@/types/supabase';

export function useProfile() {
  const user = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        console.log('useProfile: Fetching profile for user:', user.id);
        const supabase = getBrowserClient();
        
        // Try to get the existing profile
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (fetchError) {
          console.log('useProfile: Error fetching profile:', fetchError);
          
          // If profile doesn't exist, create one
          if (fetchError.code === 'PGRST116') {
            console.log('useProfile: Profile not found, creating new profile');
            
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({
                user_id: user.id,
                username: `user_${user.id.slice(0, 8)}`,
                is_private: false,
                show_email: false,
                banned: false,
                ban_count: 0,
                warnings: 0
              })
              .select()
              .single();
              
            if (createError) {
              console.error('useProfile: Error creating profile:', createError);
              setError('Failed to create profile');
              setProfile(null);
            } else {
              console.log('useProfile: New profile created:', newProfile);
              setProfile(newProfile);
            }
          } else {
            console.error('useProfile: Unknown error:', fetchError);
            setError('Failed to fetch profile');
            setProfile(null);
          }
        } else {
          console.log('useProfile: Profile fetched successfully:', data);
          setProfile(data);
        }
      } catch (error) {
        console.error('useProfile: Exception in profile fetch:', error);
        setError('Exception in profile fetch');
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  return { profile, isLoading, error };
} 