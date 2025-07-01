import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@supabase/auth-helpers-react';
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
import ShareButton from '@/components/ShareButton';
import { GetServerSideProps } from 'next';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth-utils';
import { useStarredRecipes } from '@/hooks/useStarredRecipes';
import { parse as parseCookie } from 'cookie';
import { getSupabaseClient } from '@/lib/supabase';
import { useProfile } from '@/hooks/useProfile';
import { useFollowNotifications } from '@/hooks/useNotifications';

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
  username?: string;
}

interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  show_email: boolean;
  banned: boolean;
  ban_type: 'temporary' | 'permanent' | 'warning' | null;
  ban_reason: string | null;
  ban_expiry: string | null;
  ban_count: number;
  last_ban_date: string | null;
  warnings: number;
  followers_count?: number;
  following_count?: number;
  dietary_restrictions: string[] | null;
  cooking_skill_level: string | null;
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

interface UserProfileProps {
  initialProfile: Profile | null;
  initialRecipes: Recipe[];
  initialStarredRecipes: Recipe[];
  isPrivateBlocked: boolean;
}

export const config = {
  runtime: 'nodejs',
};

export default function UserProfile({ initialProfile, initialRecipes, initialStarredRecipes, isPrivateBlocked }: UserProfileProps) {
  const router = useRouter();
  const { id } = router.query;
  const clientUser = useUser();
  const { profile: currentUserProfile } = useProfile();
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [recipes, setRecipes] = useState(
    initialRecipes.map(recipe => ({
      ...recipe,
      username: initialProfile?.username || '[recipes] user',
    }))
  );
  const [starredRecipes, setStarredRecipes] = useState(
    initialStarredRecipes.map(recipe => ({
      ...recipe,
      username: recipe.recipe_type === 'user' ? initialProfile?.username || '[recipes] user' : undefined,
    }))
  );
  const [activeTab, setActiveTab] = useState<'recipes' | 'starred'>('recipes');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { starredRecipes: starredRaw, isLoading: starredLoading } = useStarredRecipes(profile?.user_id);
  const [starredDetails, setStarredDetails] = useState<any[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const supabase = getSupabaseClient();
  const { sendFollowNotification } = useFollowNotifications();

  // Client-side owner check
  const isOwnerClient = clientUser && profile && clientUser.id === profile.user_id;

  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!clientUser || !profile) return;

      try {
        const { data, error } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', clientUser.id)
          .eq('following_id', profile.user_id)
          .maybeSingle();

        if (error) throw error;
        setIsFollowing(!!data);
      } catch (error) {
        console.error('Error checking follow status:', error);
      }
    };

    checkFollowStatus();
  }, [clientUser, profile]);

  useEffect(() => {
    const checkBlockStatus = async () => {
      if (!clientUser || !profile) return;

      try {
        const { data, error } = await supabase
          .from('blocked_users')
          .select('*')
          .eq('user_id', clientUser.id)
          .eq('blocked_user_id', profile.user_id)
          .maybeSingle();

        if (error) throw error;
        setIsBlocked(!!data);
      } catch (error) {
        console.error('Error checking block status:', error);
      }
    };

    checkBlockStatus();
  }, [clientUser, profile]);

  const handleFollow = async () => {
    if (!clientUser || !profile) return;
    setIsLoading(true);

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', clientUser.id)
          .eq('following_id', profile.user_id);

        if (error) throw error;
        setIsFollowing(false);
      } else {
        const { error } = await supabase
          .from('follows')
          .insert([
            {
              follower_id: clientUser.id,
              following_id: profile.user_id,
            },
          ]);

        if (error) throw error;
        setIsFollowing(true);

        // Send regular follow notification (all accounts are public now)
        try {
          await sendFollowNotification(profile.user_id, clientUser.id);
        } catch (notificationError) {
          console.error('Error sending follow notification:', notificationError);
          // Don't fail the follow action if notification fails
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      setError('Failed to update follow status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!clientUser || !profile) return;
    setIsBlocking(true);

    try {
      if (isBlocked) {
        const { error } = await supabase
          .from('blocked_users')
          .delete()
          .eq('user_id', clientUser.id)
          .eq('blocked_user_id', profile.user_id);

        if (error) throw error;
        setIsBlocked(false);
        // Also remove them as a follower
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', profile.user_id)
          .eq('following_id', clientUser.id);
      } else {
        const { error } = await supabase
          .from('blocked_users')
          .insert([
            {
              user_id: clientUser.id,
              blocked_user_id: profile.user_id,
            },
          ]);

        if (error) throw error;
        setIsBlocked(true);
      }
      setIsBlockModalOpen(false);
    } catch (error) {
      console.error('Error toggling block:', error);
      setError('Failed to update block status. Please try again.');
    } finally {
      setIsBlocking(false);
    }
  };

  useEffect(() => {
    async function fetchDetails() {
      if (!starredRaw || starredRaw.length === 0) {
        setStarredDetails([]);
        return;
      }
      const results = await Promise.all(
        starredRaw.map(async (star) => {
          try {
            let url = '';
            if (star.recipe_type === 'spoonacular') {
              url = `/api/recipes/spoonacular-${star.recipe_id}`;
            } else if (star.recipe_type === 'ai') {
              url = `/api/recipes/${star.recipe_id}`;
            } else {
              url = `/api/recipes/${star.recipe_id}`;
            }
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            return { ...data, recipe_type: star.recipe_type };
          } catch (e) {
            return { id: star.recipe_id, recipe_type: star.recipe_type, error: true };
          }
        })
      );
      setStarredDetails(results);
    }
    if (activeTab === 'starred' && profile?.user_id) {
      fetchDetails();
    }
  }, [starredRaw, activeTab, profile?.user_id]);

  // Update the recipes section to use starredRecipes state
  const displayedRecipes = useMemo(() => {
    return activeTab === 'recipes' ? recipes : starredDetails;
  }, [activeTab, recipes, starredDetails]);

  // Client-side fallback fetch for recipes and starred recipes if owner and SSR arrays are empty
  useEffect(() => {
    if (
      isOwnerClient &&
      profile &&
      recipes.length === 0 &&
      starredRecipes.length === 0
    ) {
      const supabase = getSupabaseClient();
      const fetchData = async () => {
        // Fetch recipes
        const { data: userRecipes } = await supabase
          .from('recipes')
          .select('*')
          .eq('user_id', profile.user_id)
          .order('created_at', { ascending: false });

        // Fetch starred recipes
        const { data: starredRows } = await supabase
          .from('starred_recipes')
          .select('*')
          .eq('user_id', profile.user_id);

        let starredRecipesList = [];
        if (starredRows && starredRows.length > 0) {
          // Separate recipe IDs by type
          const userRecipeIds = starredRows.filter((r: any) => r.recipe_type === 'user').map((r: any) => r.recipe_id);
          const spoonacularRecipeIds = starredRows.filter((r: any) => r.recipe_type === 'spoonacular').map((r: any) => r.recipe_id);
          const aiRecipeIds = starredRows.filter((r: any) => r.recipe_type === 'ai').map((r: any) => r.recipe_id);

          // Fetch user recipes in one query
          if (userRecipeIds.length > 0) {
            const { data: userStarred } = await supabase
              .from('recipes')
              .select('*')
              .in('id', userRecipeIds);
            if (userStarred) {
              starredRecipesList.push(...userStarred.map((r: any) => ({ ...r, recipe_type: 'user' })));
            }
          }

          // Fetch spoonacular recipes in one query
          if (spoonacularRecipeIds.length > 0) {
            const { data: spoonacularStarred } = await supabase
              .from('spoonacular_recipes')
              .select('*')
              .in('id', spoonacularRecipeIds);
            if (spoonacularStarred) {
              starredRecipesList.push(...spoonacularStarred.map((r: any) => ({ ...r, recipe_type: 'spoonacular' })));
            }
          }

          // Fetch AI recipes one by one (API)
          for (const recipeId of aiRecipeIds) {
            try {
              const res = await fetch(`/api/recipes/${recipeId}`);
              if (res.ok) {
                const data = await res.json();
                starredRecipesList.push({
                  ...data,
                  recipe_type: 'ai',
                  user_id: data.user_id || profile.user_id
                });
              }
            } catch (error) {
              // Ignore errors for individual AI recipes
            }
          }

          // Sort starred recipes by created_at in descending order
          starredRecipesList.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }

        setRecipes(userRecipes || []);
        setStarredRecipes(starredRecipesList);
      };
      fetchData();
    }
  }, [isOwnerClient, profile, recipes.length, starredRecipes.length]);

  // Attach username fallback for starredDetails
  useEffect(() => {
    if (!profile) return;
    if (starredDetails && starredDetails.length > 0) {
      setStarredDetails(prev => prev.map(recipe =>
        recipe && !recipe.username && recipe.user_id
          ? { ...recipe, username: profile.username || '[recipes] user' }
          : recipe
      ));
    }
  }, [profile, starredDetails.length]);

  return (
    <>
      <Head>
        <title>{profile?.username || '[recipes] user'} | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8 rounded-2xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        ) : error ? (
          <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
            <p className="text-red-500">{error}</p>
          </div>
        ) : profile ? (
          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-full overflow-hidden flex items-center justify-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                <Avatar avatar_url={profile.avatar_url} username={profile.username} size={64} />
              </div>
              <div>
                <h1 className="text-2xl dark:text-white">
                  {profile.username || '[recipes] user'}
                </h1>
                {profile.bio && <p className="text-gray-500 dark:text-gray-400">{profile.bio}</p>}
                {(profile.dietary_restrictions && profile.dietary_restrictions.length > 0) && (
                  <div className="mt-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">dietary restrictions: </span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {profile.dietary_restrictions.join(', ')}
                    </span>
                  </div>
                )}
                {profile.cooking_skill_level && (
                  <div className="mt-1">
                    <span className="text-sm text-gray-500 dark:text-gray-400">cooking skill: </span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {profile.cooking_skill_level}
                    </span>
                  </div>
                )}
              </div>
              {clientUser && clientUser.id !== profile.user_id && (
                <div className="relative flex items-center gap-2" ref={dropdownRef}>
                  <button
                    onClick={handleFollow}
                    disabled={isLoading}
                    className="h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity rounded-lg"
                    style={{ color: 'white', background: 'var(--background)' }}
                  >
                    {isFollowing ? 'unfollow' : 'follow'}
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity rounded-lg"
                    >
                      •••
                    </button>
                    {showDropdown && (
                      <div className="absolute right-0 mt-2 w-64 border border-gray-200 dark:border-gray-800 shadow-lg z-50 rounded-xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                          <p className="text-sm text-gray-500 dark:text-gray-400" style={{ fontFamily: 'inherit' }}>
                            {profile?.username ? `@${profile.username.toLowerCase()}` : '[recipes] user'}
                          </p>
                        </div>
                        <div className="py-1" role="menu" aria-orientation="vertical">
                          <button
                            onClick={() => {
                              setShowDropdown(false);
                              setIsBlockModalOpen(true);
                            }}
                            className="w-full text-left px-4 py-2 text-base font-normal hover:opacity-80 transition-opacity rounded-lg"
                            style={{ color: 'white', fontFamily: 'inherit' }}
                            role="menuitem"
                          >
                            {isBlocked ? 'unblock' : 'block'}
                          </button>
                          <button
                            onClick={() => {
                              setShowDropdown(false);
                              setShowReportModal(true);
                            }}
                            className="w-full text-left px-4 py-2 text-base font-normal hover:opacity-80 transition-opacity rounded-lg"
                            style={{ color: 'white', fontFamily: 'inherit' }}
                            role="menuitem"
                          >
                            report
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
              <Link href={`/followers?id=${profile.user_id}`} className="hover:opacity-80 transition-opacity">
                <span className="font-medium">{profile.followers_count || 0}</span> followers
              </Link>
              <Link href={`/following?id=${profile.user_id}`} className="hover:opacity-80 transition-opacity">
                <span className="font-medium">{profile.following_count || 0}</span> following
              </Link>
            </div>

            <div className="flex gap-4 pt-8 border-t border-outline">
              <button
                className={`text-lg ${activeTab === 'recipes' ? 'text-accent dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                onClick={() => setActiveTab('recipes')}
                aria-pressed={activeTab === 'recipes'}
                tabIndex={0}
              >
                recipes
              </button>
              <button
                className={`text-lg ${activeTab === 'starred' ? 'text-accent dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                onClick={() => setActiveTab('starred')}
                aria-pressed={activeTab === 'starred'}
                tabIndex={0}
              >
                starred
              </button>
            </div>

            <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
              {activeTab === 'recipes' ? (
                recipes ? (
                  recipes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {recipes.map((recipe) => (
                        <div key={recipe.id} className="relative">
                          <div className="dark:text-white">
                            <RecipeCard
                              id={recipe.id}
                              title={recipe.title}
                              description={recipe.description}
                              image_url={recipe.image_url}
                              user_id={recipe.user_id}
                              created_at={recipe.created_at}
                              cuisine_type={recipe.cuisine_type}
                              cooking_time={recipe.cooking_time}
                              diet_type={recipe.diet_type}
                              recipeType={recipe.recipe_type === 'ai' ? 'ai' : recipe.recipe_type === 'spoonacular' ? 'spoonacular' : 'user'}
                              username={recipe.username || (profile?.username || '[recipes] user')}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">no recipes yet</p>
                  )
                ) : (
                  <div className="text-gray-500 dark:text-gray-400">loading recipes...</div>
                )
              ) : (
                starredLoading ? (
                  <div className="text-gray-500 dark:text-gray-400">loading starred recipes...</div>
                ) : starredDetails.length === 0 || starredDetails.filter(r => !r.error).length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">no starred recipes yet</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {starredDetails
                      .filter(recipe => !recipe.error)
                      .map(recipe => (
                        <div key={recipe.id} className="relative">
                          <div className="dark:text-white">
                            <RecipeCard
                              id={recipe.id}
                              title={recipe.title}
                              description={recipe.description}
                              image_url={recipe.image_url}
                              user_id={recipe.user_id}
                              created_at={recipe.created_at}
                              cuisine_type={recipe.cuisine_type}
                              cooking_time={recipe.cooking_time}
                              diet_type={recipe.diet_type}
                              recipeType={recipe.recipe_type === 'ai' ? 'ai' : recipe.recipe_type === 'spoonacular' ? 'spoonacular' : 'user'}
                              username={recipe.username || (profile?.username || '[recipes] user')}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
            <p className="text-red-500">Profile not found</p>
          </div>
        )}
      </main>

      <Modal
        isOpen={isBlockModalOpen}
        onRequestClose={() => setIsBlockModalOpen(false)}
        contentLabel="Block User"
        className="fixed inset-0 flex items-center justify-center z-50"
        overlayClassName="fixed inset-0 bg-black/50"
        ariaHideApp={false}
      >
        <div className="p-8 shadow-2xl max-w-lg w-full border rounded-xl" style={{ background: 'var(--background)', borderColor: 'var(--outline)', color: 'var(--foreground)' }}>
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'white' }}>{isBlocked ? 'unblock user' : 'block user'}</h2>
          <p className="mb-6">
            {(
              isBlocked
                ? 'Are you sure you want to unblock this user? You will be able to see their content and interact with them again.'
                : 'Are you sure you want to block this user? You will no longer see their content or be able to interact with them.'
            ).toLowerCase()}
          </p>
          <div className="flex justify-end gap-4">
            <button
              onClick={() => setIsBlockModalOpen(false)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity rounded-lg"
              style={{ color: 'white', background: 'var(--background)' }}
            >
              cancel
            </button>
            <button
              onClick={handleBlock}
              className="px-4 py-2 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity rounded-lg"
              style={{ color: 'white', background: 'var(--background)' }}
            >
              {isBlocked ? 'unblock' : 'block'}
            </button>
          </div>
        </div>
      </Modal>

      {showReportModal && profile && (
        <ReportButton
          recipeId={profile.user_id}
          recipeType="user"
          onReportSubmitted={() => setShowReportModal(false)}
          className="fixed z-50"
          showOnlyModal
          openOnMount
        />
      )}
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    // Use the context object directly for SSR session extraction
    const supabase = createPagesServerClient(context);
    const { id } = context.params as { id: string };

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return {
        notFound: true,
      };
    }

    // Fetch profile using user_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return {
        notFound: true,
      };
    }

    // Use the correct user_id for all subsequent queries
    const userId = id;

    // Fetch followers count
    const { count: followersCount, error: followersError } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId);

    if (followersError) {
      console.error('Error fetching followers count:', followersError);
    }

    // Fetch following count
    const { count: followingCount, error: followingError } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId);

    if (followingError) {
      console.error('Error fetching following count:', followingError);
    }

    // Update profile with counts
    const updatedProfile = {
      ...profile,
      followers_count: followersCount || 0,
      following_count: followingCount || 0
    };

    // All profiles are now public, so no need to check privacy settings
    console.log('[SSR Debug] Profile is public, allowing access');

    // Fetch user's recipes
    const { data: recipes, error: recipesError } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (recipesError) {
      console.error('Error fetching recipes:', recipesError);
      return {
        props: {
          initialProfile: updatedProfile,
          initialRecipes: [],
          initialStarredRecipes: [],
          isPrivateBlocked: false
        },
      };
    }

    // Debug: Log the userId being used for starred recipes
    console.log('[Profile Page][getServerSideProps] userId for starred recipes:', userId);

    // Fetch starred recipes using optimized SQL approach
    const { data: starredRows, error: starredRowsError } = await supabase
      .from('starred_recipes')
      .select('*')
      .eq('user_id', userId);

    // Debug: Log the fetched starredRows
    console.log('[Profile Page][getServerSideProps] starredRows:', starredRows);

    let starredRecipes: Recipe[] = [];
    if (!starredRowsError && starredRows) {
      // Separate recipe IDs by type
      const userRecipeIds = starredRows.filter((r: any) => r.recipe_type === 'user').map((r: any) => r.recipe_id);
      const spoonacularRecipeIds = starredRows.filter((r: any) => r.recipe_type === 'spoonacular').map((r: any) => r.recipe_id);
      const aiRecipeIds = starredRows.filter((r: any) => r.recipe_type === 'ai').map((r: any) => r.recipe_id);

      // Fetch user recipes in one query
      if (userRecipeIds.length > 0) {
        const { data: userRecipes, error: userRecipesError } = await supabase
          .from('recipes')
          .select('*')
          .in('id', userRecipeIds);
        if (userRecipesError) {
          console.error('Error fetching user starred recipes:', userRecipesError);
        } else if (userRecipes) {
          starredRecipes.push(...userRecipes.map((r: any) => ({ ...r, recipe_type: 'user' })));
        }
      }

      // Fetch spoonacular recipes in one query
      if (spoonacularRecipeIds.length > 0) {
        const { data: spoonacularRecipes, error: spoonacularRecipesError } = await supabase
          .from('spoonacular_recipes')
          .select('*')
          .in('id', spoonacularRecipeIds);
        if (spoonacularRecipesError) {
          console.error('Error fetching spoonacular starred recipes:', spoonacularRecipesError);
        } else if (spoonacularRecipes) {
          starredRecipes.push(...spoonacularRecipes.map((r: any) => ({ ...r, recipe_type: 'spoonacular' })));
        }
      }

      // Fetch AI recipes one by one (API)
      for (const recipeId of aiRecipeIds) {
        try {
          const aiResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/recipes/${recipeId}`);
          if (aiResponse.ok) {
            const data = await aiResponse.json();
            starredRecipes.push({
              ...data,
              recipe_type: 'ai' as const,
              user_id: data.user_id || userId
            });
          } else {
            console.error(`Failed to fetch AI recipe from API for id ${recipeId}:`, aiResponse.status, aiResponse.statusText);
          }
        } catch (error) {
          console.error(`Exception fetching AI recipe (id: ${recipeId}):`, error);
        }
      }

      // Sort starred recipes by created_at in descending order
      starredRecipes.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return {
        props: {
          initialProfile: updatedProfile,
          initialRecipes: recipes || [],
          initialStarredRecipes: starredRecipes,
          isPrivateBlocked: false
        },
      };
    } else {
      console.error('Error fetching starred recipes from starred_recipes table:', starredRowsError);
      return {
        props: {
          initialProfile: updatedProfile,
          initialRecipes: recipes || [],
          initialStarredRecipes: [],
          isPrivateBlocked: false
        },
      };
    }
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      notFound: true,
    };
  }
};