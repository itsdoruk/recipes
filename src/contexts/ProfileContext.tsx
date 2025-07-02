import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Profile } from '@/types/supabase';

interface ProfileContextType {
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  isVerified: boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const supabase = useSupabaseClient();
  const user = session?.user;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  const fetchProfile = useCallback(async (force = false) => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      setIsVerified(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Fetching profile for user:', user.id);
      
      // First check if user is verified
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      
      const isUserVerified = authUser?.email_confirmed_at != null;
      setIsVerified(isUserVerified);

      // Then fetch profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        // If profile doesn't exist, create one
        if (error.code === 'PGRST116') {
          console.log('Profile not found, creating new profile...');
          
          // Only create profile if user is verified
          if (!isUserVerified) {
            setError('Please verify your email before creating a profile');
            setProfile(null);
            setIsLoading(false);
            return;
          }

          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              user_id: user.id,
              username: user.user_metadata?.username || `user_${user.id.slice(0, 8)}`,
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
              is_admin: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              dietary_restrictions: [],
              cooking_skill_level: null
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating profile:', createError);
            setError('Failed to create profile');
            setProfile(null);
            return;
          }
          setProfile(newProfile);
        } else {
          setError('Failed to fetch profile');
          setProfile(null);
          return;
        }
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error in ProfileContext:', error);
      setError('An error occurred while fetching profile');
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [user, supabase]);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Update local state immediately
      setProfile(data);
      
      console.log('Profile updated successfully:', data);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }, [user, supabase]);

  const refreshProfile = useCallback(async () => {
    await fetchProfile(true);
  }, [fetchProfile]);

  // Handle profile fetching
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      setIsVerified(false);
      return;
    }

    fetchProfile();
  }, [user, fetchProfile]);

  // Set up real-time subscription for profile changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`profile-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('Profile updated via real-time:', payload.new);
        setProfile(payload.new as Profile);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  const value = {
    profile,
    isLoading,
    error,
    refreshProfile,
    updateProfile,
    isVerified
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfileContext() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfileContext must be used within a ProfileProvider');
  }
  return context;
} 