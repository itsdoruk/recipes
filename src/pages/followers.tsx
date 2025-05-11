import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
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

export default function FollowersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFollowers = async () => {
      if (!user) {
        console.log('No user found, redirecting to login');
        router.push('/login');
        return;
      }
      try {
        console.log('Fetching followers for user:', user.id);
        // Get users who are following the current user
        const { data: followersData, error: followersError } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', user.id);
        
        console.log('Followers data:', followersData);
        console.log('Followers error:', followersError);

        if (followersError) {
          throw followersError;
        }

        if (followersData?.length) {
          // Get profiles of followers
          const followerIds = followersData.map(f => f.follower_id);
          console.log('Follower IDs:', followerIds);
          
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .in('user_id', followerIds);
          
          console.log('Profiles data:', profiles);
          console.log('Profiles error:', profilesError);

          if (profilesError) {
            throw profilesError;
          }

          setFollowers(profiles || []);
        } else {
          console.log('No followers data found');
          setFollowers([]);
        }
      } catch (error) {
        console.error('Error fetching followers:', error);
        setFollowers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchFollowers();
  }, [user, router]);

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="">loading...</p>
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
            <h1 className="text-2xl">followers</h1>
          </div>

          <div className="space-y-4">
            {followers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {followers.map((profile) => (
                  <UserCard key={profile.user_id} user={profile} />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">no followers yet</p>
            )}
          </div>
        </div>
      </main>
    </>
  );
} 