import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useUser } from '@supabase/auth-helpers-react';
import { getSupabaseClient } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';
import Avatar from '@/components/Avatar';
import UserCard from '@/components/UserCard';

interface Profile {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_private: boolean;
}

export default function FollowingPage() {
  const router = useRouter();
  const { id } = router.query; // Get the user ID from the query parameters
  const user = useUser();
  const [following, setFollowing] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // First check if user is loaded (either logged in or not)
    if (user === undefined) {
      // Still loading user, don't do anything yet
      return;
    }
    
    setAuthChecked(true);
    
    // If no ID is provided and we have a user, use the current user's ID
    const userId = id || (user ? user.id : null);
    
    if (!userId) {
      // If no user ID is available, let the middleware handle the redirect
      console.log('No user ID available for following page');
      return;
    }
    
    // Set a timeout to prevent infinite loading
    timeoutRef.current = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError("Loading timed out. Please try refreshing the page.");
      }
    }, 10000); // 10 seconds timeout
    
    const fetchFollowing = async () => {
      try {
        console.log('Fetching following for user:', userId);
        
        // Use a single optimized query to get both profile and following data
        const supabase = getSupabaseClient();
        
        // Fetch profile data
        const profilePromise = supabase
          .from('profiles')
          .select('username')
          .eq('user_id', userId)
          .single();
          
        // Fetch following IDs
        const followingIdsPromise = supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId);
        
        // Run both queries in parallel
        const [profileResult, followingIdsResult] = await Promise.all([
          profilePromise,
          followingIdsPromise
        ]);
        
        // Handle profile data
        if (profileResult.data) {
          setProfileUsername(profileResult.data.username);
        }
        
        // Handle following data
        if (followingIdsResult.error) {
          throw followingIdsResult.error;
        }
        
        if (followingIdsResult.data?.length) {
          // Get profiles of followed users
          const followingIds = followingIdsResult.data.map((f: { following_id: string }) => f.following_id);
          
          // Fetch profiles with a single query
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .in('user_id', followingIds);
          
          if (profilesError) {
            throw profilesError;
          }

          setFollowing(profiles || []);
        } else {
          setFollowing([]);
        }
      } catch (err: any) {
        console.error('Error fetching following:', err);
        setError(err.message || 'Failed to load following data');
        setFollowing([]);
      } finally {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        setLoading(false);
      }
    };
    
    if (userId) {
      fetchFollowing();
    }
  }, [user, id]);

  // Show optimized loading state
  if (!authChecked || (loading && (id || user))) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/3 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border border-gray-200 dark:border-gray-800 p-4 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-1/2 mb-2 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4 animate-pulse"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>following | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl">
              {profileUsername ? `${profileUsername}'s following` : 'following'}
            </h1>
          </div>

          {error ? (
            <div className="p-4 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <p className="text-red-500">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-2 text-sm px-4 py-2 bg-red-100 dark:bg-red-900/30 rounded-lg hover:opacity-90"
              >
                refresh page
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {following.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {following.map((profile) => (
                    <UserCard key={profile.user_id} user={profile} />
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">not following anyone yet</p>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
} 