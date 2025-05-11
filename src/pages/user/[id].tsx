import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/auth';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Head from 'next/head';
import Link from 'next/link';
import StarButton from '@/components/StarButton';
import RecipeCard from '@/components/RecipeCard';
import Avatar from '@/components/Avatar';
import Modal from '@/components/Modal';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import ReportModal from '@/components/ReportModal';
import ReportButton from '@/components/ReportButton';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Recipe {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  created_at: string;
  recipe_type: 'ai' | 'spoonacular' | 'user';
  user_id: string;
  cuisine_type?: string | null;
  cooking_time?: string | null;
  diet_type?: string | null;
}

interface Profile {
  user_id: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_private: boolean;
  show_email: boolean;
  banned: boolean;
  ban_type: 'temporary' | 'permanent' | 'warning' | null;
  ban_reason: string | null;
  ban_expiry: string | null;
  ban_count: number;
  last_ban_date: string | null;
  warnings: number;
}

interface StarredRecipe {
  recipe_id: string;
  recipe_type: 'ai' | 'spoonacular' | 'user';
}

interface Follow {
  following_id: string;
}

interface Follower {
  follower_id: string;
}

// Create a client-side only component
const UserProfileContent = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [supabase, setSupabase] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [starredRecipes, setStarredRecipes] = useState<Recipe[]>([]);
  const [following, setFollowing] = useState<Profile[]>([]);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequestPending, setIsRequestPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followError, setFollowError] = useState<string | null>(null);
  const [showUnfollowModal, setShowUnfollowModal] = useState(false);
  const [isUnfollowing, setIsUnfollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize Supabase client on the client side
  useEffect(() => {
    const initSupabase = async () => {
      try {
        const { getBrowserClient } = await import('@/lib/supabase/browserClient');
        setSupabase(getBrowserClient());
      } catch (error) {
        console.error('Error initializing Supabase:', error);
        setFollowError('Failed to initialize client');
        setLoading(false);
      }
    };
    initSupabase();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id || !supabase) return;

      // Validate UUID format
      if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
        console.error('Invalid profile ID format:', id);
        setFollowError('Invalid profile ID');
        setLoading(false);
        return;
      }

      setLoading(true);
      setFollowError(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Fetching profile for ID:', id);
        
        // Fetch profile data with more detailed logging
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', id)
          .maybeSingle();

        console.log('Profile fetch result:', { profileData, profileError });

        if (profileError) {
          console.error('Profile fetch error:', profileError);
          if (profileError.code === 'PGRST116') {
            // No rows found, try to create profile
            const { data: authUser, error: authError } = await supabase
              .from('auth.users')
              .select('id')
              .eq('id', id)
              .maybeSingle();

            console.log('Auth user check:', { authUser, authError });

            if (authUser) {
              // User exists in auth but no profile, create one
              const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert({
                  user_id: id,
                  username: `user_${id.slice(0, 8)}`,
                  is_private: false,
                  show_email: false
                })
                .select()
                .single();

              console.log('Profile creation result:', { newProfile, createError });

              if (createError) {
                console.error('Error creating profile:', createError);
                throw createError;
              }

              setProfile(newProfile);
              setLoading(false);
              return;
            }
          }
          throw profileError;
        }

        if (!profileData) {
          console.log('No profile found for ID:', id);
          setFollowError('Profile not found');
          setLoading(false);
          return;
        }

        // Check if user is banned
        if (profileData.ban_expires_at) {
          const banExpiresAt = new Date(profileData.ban_expires_at);
          const isBanExpired = banExpiresAt < new Date();
          if (!isBanExpired) {
            setFollowError('This user has been banned');
            setLoading(false);
            return;
          }
        }

        setProfile(profileData);
        console.log('Profile set successfully:', profileData);

        // Check if user is blocked
        if (session?.user) {
          console.log('Checking block status for user:', session.user.id);
          const { data: blockedData, error: blockedError } = await supabase
            .from('blocked_users')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('blocked_user_id', id)
            .maybeSingle();

          console.log('Block check result:', { blockedData, blockedError });

          if (blockedError) {
            console.error('Error checking block status:', blockedError);
          }

          setIsBlocked(!!blockedData);

          // Check if current user is blocked by profile owner
          const { data: isBlockedByUser, error: blockedByError } = await supabase
            .from('blocked_users')
            .select('id')
            .eq('user_id', id)
            .eq('blocked_user_id', session.user.id)
            .maybeSingle();
          
          console.log('Blocked by user check:', { isBlockedByUser, blockedByError });

          if (blockedByError) {
            console.error('Error checking if blocked by user:', blockedByError);
          }

          if (isBlockedByUser) {
            setFollowError('You have been blocked by this user');
            setLoading(false);
            return;
          }
        }

        // Fetch recipes
        const { data: recipesData, error: recipesError } = await supabase
          .from('recipes')
          .select('*')
          .eq('user_id', id)
          .order('created_at', { ascending: false });

        if (recipesError) throw recipesError;
        setRecipes(recipesData || []);

        // Fetch starred recipes
        const { data: starredData } = await supabase
          .from('starred_recipes')
          .select('recipe_id, recipe_type')
          .eq('user_id', id);

        if (starredData?.length) {
          const recipes = await Promise.all(
            starredData.map(async (star: StarredRecipe) => {
              if (star.recipe_type === 'user') {
                const { data } = await supabase
                  .from('recipes')
                  .select('*')
                  .eq('id', star.recipe_id)
                  .single();
                return data;
              }
              return null;
            })
          );
          setStarredRecipes(recipes.filter(Boolean));
        }

        // Fetch followers (users who follow this profile)
        const { data: followersData } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', id);

        let followersProfiles: Profile[] = [];
        if (followersData?.length) {
          const followerIds = followersData.map((f: any) => f.follower_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('user_id', followerIds);
          followersProfiles = profiles || [];
        }
        setFollowers(followersProfiles);

        // Fetch following (users this profile follows)
        const { data: followingData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', id);

        let followingProfiles: Profile[] = [];
        if (followingData?.length) {
          const followingIds = followingData.map((f: any) => f.following_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('user_id', followingIds);
          followingProfiles = profiles || [];
        }
        setFollowing(followingProfiles);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching profile:', error);
        setFollowError('Failed to load profile');
        setLoading(false);
      }
    };

    const setupBlockSubscription = () => {
      if (!supabase || !id || !user) return;

      const blockChannel = supabase
        .channel('block-status')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'blocked_users',
          filter: `user_id=eq.${id},blocked_user_id=eq.${user.id}`
        }, async (payload: RealtimePostgresChangesPayload<any>) => {
          if (payload.eventType === 'DELETE') {
            setFollowError(null);
            // Fetch profile again after unblock
            try {
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', id)
                .maybeSingle();

              if (profileError) throw profileError;
              setProfile(profileData);
              setLoading(false);
            } catch (error) {
              console.error('Error fetching profile after unblock:', error);
              setFollowError('Failed to load profile');
              setLoading(false);
            }
          } else if (payload.eventType === 'INSERT') {
            setFollowError('You have been blocked by this user');
          }
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'blocked_users',
          filter: `user_id=eq.${user.id},blocked_user_id=eq.${id}`
        }, async (payload: RealtimePostgresChangesPayload<any>) => {
          if (payload.eventType === 'DELETE') {
            // When current user unblocks the profile owner
            setFollowError(null);
            try {
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', id)
                .maybeSingle();

              if (profileError) throw profileError;
              setProfile(profileData);
              setLoading(false);
            } catch (error) {
              console.error('Error fetching profile after unblock:', error);
              setFollowError('Failed to load profile');
              setLoading(false);
            }
          }
        })
        .subscribe((status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'CLOSED' | 'TIMED_OUT') => {
          if (status === 'CHANNEL_ERROR') {
            console.error('Error subscribing to block status channel');
          }
        });

      return blockChannel;
    };

    fetchProfile();
    const blockChannel = setupBlockSubscription();

    return () => {
      if (blockChannel) {
        supabase?.removeChannel(blockChannel);
      }
    };
  }, [id, user, supabase]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleFollow = async () => {
    if (!user || !id || !supabase) return;
    setFollowError(null);
    console.log('Follow button clicked');
    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', id);
        setIsFollowing(false);
      } else if (profile?.is_private) {
        // Send follow request
        const { error: followRequestError } = await supabase
          .from('follow_requests')
          .insert({
            requester_id: user.id,
            target_id: id,
            status: 'pending'
          });
        if (followRequestError) {
          setFollowError('Error sending follow request: ' + followRequestError.message);
          console.error('Error sending follow request:', followRequestError);
          return;
        }
        setIsRequestPending(true);
        // Send notification for follow request
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: id,
            type: 'follow_request',
            actor_id: user.id
          });
        if (notificationError) {
          setFollowError('Error sending follow request notification: ' + notificationError.message);
          console.error('Error sending follow request notification:', notificationError);
        }
      } else {
        const { error: followError } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: id
          });
        if (followError) {
          setFollowError('Error following user: ' + followError.message);
          console.error('Error following user:', followError);
          return;
        }
        setIsFollowing(true);
        // Send notification for follow
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: id,
            type: 'follow',
            actor_id: user.id
          });
        if (notificationError) {
          setFollowError('Error sending follow notification: ' + notificationError.message);
          console.error('Error sending follow notification:', notificationError);
        }
      }
      setShowDropdown(false);
    } catch (error: any) {
      setFollowError(error.message || 'Unknown error');
      console.error('error toggling follow:', error);
    }
  };

  const canViewContent = () => {
    if (!profile) return false;
    if (!profile.is_private) return true;
    if (!user) return false;
    if (user.id === id) return true;
    return isFollowing;
  };

  const handleUnfollow = async () => {
    if (!user || !id || !supabase) return;
    setFollowError(null);
    console.log('Unfollow button clicked');
    try {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', id);
      setIsFollowing(false);
      setShowUnfollowModal(false);
    } catch (error) {
      console.error('Error unfollowing user:', error);
      setFollowError('Failed to unfollow user');
    }
  };

  const handleBlock = async () => {
    if (!user || !id || !supabase) return;
    try {
      if (isBlocked) {
        // Unblock user
        await supabase
          .from('blocked_users')
          .delete()
          .eq('user_id', user.id)
          .eq('blocked_user_id', id);
        setIsBlocked(false);
      } else {
        // Block user
        await supabase
          .from('blocked_users')
          .insert({
            user_id: user.id,
            blocked_user_id: id
          });
        setIsBlocked(true);

        // If following, unfollow
        if (isFollowing) {
          await supabase
            .from('follows')
            .delete()
            .eq('follower_id', user.id)
            .eq('following_id', id);
          setIsFollowing(false);
        }
      }
      setShowBlockModal(false);
    } catch (error) {
      console.error('Error toggling block:', error);
      setFollowError('Failed to update block status');
    }
  };

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 py-8">loading...</div>;
  }

  if (!profile) {
    return <div className="max-w-2xl mx-auto px-4 py-8">profile not found</div>;
  }

  // If user is blocked or has been blocked, show minimal profile
  if (isBlocked || followError === 'You have been blocked by this user') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border border-gray-200 dark:border-gray-800 flex items-center justify-center">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username || 'avatar'} className="object-cover w-full h-full" />
              ) : (
                <span className="text-2xl font-bold text-gray-300">{profile.username?.[0]?.toUpperCase() || 'A'}</span>
              )}
            </div>
            <div>
              <div className="font-semibold text-xl">{profile.username || '[recipes] user'}</div>
              <div className="text-sm text-gray-500">
                {isBlocked ? 'blocked user' : 'this user has blocked you'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{profile.username || '[recipes] user'} | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8 rounded-2xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-full overflow-hidden flex items-center justify-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>
              <Avatar avatar_url={profile.avatar_url} username={profile.username} size={64} />
            </div>
            <div>
              <h1 className="text-2xl">
                {profile.username || '[recipes] user'} {profile.is_private && '🔒'}
              </h1>
              {profile.bio && <p className="text-gray-500 dark:text-gray-400">{profile.bio}</p>}
            </div>
            {user && user.id !== id && (
              <div className="relative flex items-center gap-2" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity rounded-lg"
                  disabled={isRequestPending}
                >
                  {isFollowing ? 'unfollow' : isRequestPending ? 'requested' : 'follow'}
                </button>
                <ReportButton recipeId={profile.user_id} recipeType="user" />
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-64 border border-gray-200 dark:border-gray-800 shadow-lg z-50 rounded-xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                      <p className="text-sm text-gray-500 dark:text-gray-400" style={{ fontFamily: 'inherit' }}>
                        {profile?.username ? `@${profile.username.toLowerCase()}` : '[recipes] user'}
                      </p>
                    </div>
                    <div className="py-1" role="menu" aria-orientation="vertical">
                      <button
                        onClick={handleFollow}
                        className="w-full text-left px-4 py-2 text-base font-normal hover:opacity-80 transition-opacity rounded-lg"
                        style={{ color: 'inherit', fontFamily: 'inherit' }}
                        role="menuitem"
                      >
                        {isFollowing ? 'unfollow' : isRequestPending ? 'cancel request' : 'follow'}
                      </button>
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          setShowBlockModal(true);
                        }}
                        className="w-full text-left px-4 py-2 text-base font-normal hover:opacity-80 transition-opacity rounded-lg"
                        style={{ color: isBlocked ? 'var(--accent)' : 'var(--danger)', fontFamily: 'inherit' }}
                        role="menuitem"
                      >
                        {isBlocked ? 'unblock' : 'block'}
                      </button>
                    </div>
                  </div>
                )}
                {followError && <p className="text-red-500 text-sm mt-2">{followError}</p>}
              </div>
            )}
          </div>

          <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
            <Link href={`/followers?id=${id}`} className="hover:opacity-80 transition-opacity">
              <span className="font-medium">{followers.length}</span> followers
            </Link>
            <Link href={`/following?id=${id}`} className="hover:opacity-80 transition-opacity">
              <span className="font-medium">{following.length}</span> following
            </Link>
          </div>

          {canViewContent() ? (
            <>
              <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
                <h2 className="text-xl mb-4">recipes</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recipes.length > 0 ? (
                    recipes.map((recipe) => (
                      <RecipeCard
                        key={recipe.id}
                        id={recipe.id}
                        title={recipe.title}
                        description={recipe.description}
                        image_url={recipe.image_url}
                        user_id={recipe.user_id}
                        created_at={recipe.created_at}
                        cuisine_type={recipe.cuisine_type}
                        cooking_time={recipe.cooking_time}
                        diet_type={recipe.diet_type}
                      />
                    ))
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">no recipes yet</p>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
                <h2 className="text-xl mb-4">starred recipes</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {starredRecipes.length > 0 ? (
                    starredRecipes.map((recipe) => (
                      <RecipeCard
                        key={recipe.id}
                        id={recipe.id}
                        title={recipe.title}
                        description={recipe.description}
                        image_url={recipe.image_url}
                        user_id={recipe.user_id}
                        created_at={recipe.created_at}
                        cuisine_type={recipe.cuisine_type}
                        cooking_time={recipe.cooking_time}
                        diet_type={recipe.diet_type}
                        link={recipe.recipe_type === 'ai' ? `/internet-recipe/${recipe.id}` : `/recipe/${recipe.id}`}
                      />
                    ))
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">no starred recipes yet</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
             
            </div>
          )}
        </div>
      </main>

      {/* Block Modal */}
      <Modal
        isOpen={showBlockModal}
        onRequestClose={() => setShowBlockModal(false)}
        contentLabel="Block User"
        className="fixed inset-0 flex items-center justify-center z-50"
        overlayClassName="fixed inset-0 bg-black/50"
        ariaHideApp={false}
      >
        <div className="p-8 shadow-2xl max-w-lg w-full border rounded-xl" style={{ background: 'var(--background)', borderColor: 'var(--outline)', color: 'var(--foreground)' }}>
          <h2 className="text-2xl font-bold mb-4">{isBlocked ? 'Unblock User' : 'Block User'}</h2>
          <p className="mb-6">
            {isBlocked
              ? 'Are you sure you want to unblock this user? You will be able to see their content and interact with them again.'
              : 'Are you sure you want to block this user? You will no longer see their content or be able to interact with them.'}
          </p>
          <div className="flex justify-end gap-4">
            <button
              onClick={() => setShowBlockModal(false)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity rounded-lg"
              style={{ color: 'var(--foreground)', background: 'var(--background)' }}
            >
              cancel
            </button>
            <button
              onClick={handleBlock}
              className="px-4 py-2 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity rounded-lg"
              style={{ color: isBlocked ? 'var(--accent)' : 'var(--danger)', background: 'var(--background)' }}
            >
              {isBlocked ? 'unblock' : 'block'}
            </button>
          </div>
        </div>
      </Modal>
      <ReportModal
        isOpen={showReportModal}
        onRequestClose={() => setShowReportModal(false)}
        reportedUserId={id as string}
      />
    </>
  );
};

// Export a dynamically imported version of the component
export default dynamic(() => Promise.resolve(UserProfileContent), {
  ssr: false
}); 