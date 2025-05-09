import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';

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
        router.push('/login');
        return;
      }

      try {
        // Get users who are following the current user
        const { data: followersData } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', user.id);

        if (followersData?.length) {
          // Get profiles of followers
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('user_id', followersData.map(f => f.follower_id));
          setFollowers(profiles || []);
        }
      } catch (error) {
        console.error('Error fetching followers:', error);
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
              followers.map((profile) => (
                <Link
                  key={profile.user_id}
                  href={`/user/${profile.user_id}`}
                  className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity"
                >
                  <div className="relative w-12 h-12 rounded-full overflow-hidden flex items-center justify-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                    {profile.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt={profile.username || 'avatar'}
                        width={48}
                        height={48}
                        className="object-cover aspect-square"
                      />
                    ) : (
                      <span className="text-xl">{profile.username?.[0]?.toLowerCase() || 'a'}</span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg">
                      {profile.username || 'anonymous'} {profile.is_private && '🔒'}
                    </h2>
                    {profile.bio && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{profile.bio}</p>
                    )}
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400">no followers yet</p>
            )}
          </div>
        </div>
      </main>
    </>
  );
} 