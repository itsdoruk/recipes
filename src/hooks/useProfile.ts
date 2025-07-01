import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Profile } from '@/types/supabase';

// Global cache for profiles
const profileCache = new Map<string, { profile: Profile | null; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds cache duration

export function useProfile() {
  const session = useSession();
  const supabase = useSupabaseClient();
  const user = session?.user;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  
  // Add fetch lock and last fetch time
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const FETCH_COOLDOWN = 5000; // 5 seconds cooldown between fetches

  // Function to fetch the profile data
  const fetchProfile = useCallback(async (force = false) => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      setIsVerified(false);
      return;
    }

    // Check cache first
    const cached = profileCache.get(user.id);
    const now = Date.now();
    if (!force && cached && (now - cached.timestamp < CACHE_DURATION)) {
      console.log('Using cached profile for user:', user.id);
      setProfile(cached.profile);
      setIsLoading(false);
      return;
    }

    // Check if we're already fetching or if we need to respect cooldown
    if (!force && (isFetchingRef.current || (now - lastFetchTimeRef.current < FETCH_COOLDOWN))) {
      console.log('Skipping profile fetch - fetch in progress or cooldown active');
      return;
    }

    try {
      isFetchingRef.current = true;
      lastFetchTimeRef.current = now;
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
          profileCache.set(user.id, { profile: newProfile, timestamp: now });
        } else {
          setError('Failed to fetch profile');
          setProfile(null);
          return;
        }
      } else {
        setProfile(data);
        profileCache.set(user.id, { profile: data, timestamp: now });
      }
    } catch (error) {
      console.error('Error in useProfile:', error);
      setError('An error occurred while fetching profile');
      setProfile(null);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [user, supabase]);

  // Handle profile fetching with debounce
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      setIsVerified(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchProfile();
    }, 100); // Small debounce to prevent rapid refetches

    return () => clearTimeout(timeoutId);
  }, [user, fetchProfile]);

  // Clear cache when user changes
  useEffect(() => {
    if (!user) {
      profileCache.clear();
    }
  }, [user]);

  return { profile, isLoading, error, isVerified, refreshProfile: () => fetchProfile(true) };
} 