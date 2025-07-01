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
}

export default function FollowersPage() {
  const router = useRouter();
  const { id } = router.query; // Get the user ID from the query parameters
  const currentUser = useUser();
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
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
    // First check if user authentication state is loaded
    if (currentUser === undefined) {
      // Still loading user, don't do anything yet
      return;
    }
    
    setAuthChecked(true);
    
    // If no ID is provided and we have a user, use the current user's ID
    const userId = id || (currentUser ? currentUser.id : null);
    
    if (!userId) {
      // If no user ID is available, let the middleware handle the redirect
      console.log('No user ID available for followers page');
      return;
    }

    // Set a timeout to prevent infinite loading
    timeoutRef.current = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        setError("Loading timed out. Please try refreshing the page.");
      }
    }, 10000); // 10 seconds timeout

    const fetchFollowers = async () => {
      try {
        console.log('Fetching followers for user:', userId);
        
        // Use a single optimized query to get both profile and followers data
        const supabase = getSupabaseClient();
        
        // Fetch profile data
        const profilePromise = supabase
          .from('profiles')
          .select('username')
          .eq('user_id', userId)
          .single();
          
        // Fetch follower IDs
        const followerIdsPromise = supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', userId);
        
        // Run both queries in parallel
        const [profileResult, followerIdsResult] = await Promise.all([
          profilePromise,
          followerIdsPromise
        ]);
        
        // Handle profile data
        if (profileResult.data) {
          setProfileUsername(profileResult.data.username);
        }
        
        // Handle follower data
        if (followerIdsResult.error) {
          throw followerIdsResult.error;
        }
        
        if (followerIdsResult.data?.length) {
          // Get profiles of followers
          const followerIds = followerIdsResult.data.map((f: { follower_id: string }) => f.follower_id);
          
          // Fetch profiles with a single query
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .in('user_id', followerIds);
          
          if (profilesError) {
            throw profilesError;
          }

          setFollowers(profiles || []);
        } else {
          setFollowers([]);
        }
      } catch (err: any) {
        console.error('Error fetching followers:', err);
        setError(err.message || 'Failed to load followers data');
        setFollowers([]);
      } finally {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        setIsLoading(false);
      }
    };
    
    if (userId) {
      fetchFollowers();
    }
  }, [id, currentUser]);

  // Show optimized loading state
  if (!authChecked || (isLoading && (id || currentUser))) {
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
        <title>followers | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl">
              {profileUsername ? `${profileUsername}'s followers` : 'followers'}
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
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => <UserCard.Skeleton key={i} />)}
                </div>
              ) : followers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {followers.map((profile) => (
                    <UserCard key={profile.user_id} user={profile} />
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">no followers yet</p>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
} 