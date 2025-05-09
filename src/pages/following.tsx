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

export default function FollowingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [following, setFollowing] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFollowing = async () => {
      if (!user) {
        router.push('/login');
        return;
      }
      try {
        // Get users that the current user is following
        const { data: followingData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);
        if (followingData?.length) {
          // Get profiles of followed users
          const followingIds = followingData.map(f => f.following_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('user_id', followingIds);
          setFollowing(profiles || []);
        } else {
          setFollowing([]);
        }
      } catch (error) {
        console.error('Error fetching following:', error);
        setFollowing([]);
      } finally {
        setLoading(false);
      }
    };
    fetchFollowing();
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
        <title>following | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl">following</h1>
          </div>

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
        </div>
      </main>
    </>
  );
} 