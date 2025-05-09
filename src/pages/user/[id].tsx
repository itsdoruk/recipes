import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import Head from 'next/head';
import Link from 'next/link';
import StarButton from '@/components/StarButton';
import RecipeCard from '@/components/RecipeCard';

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
}

export default function UserProfile() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [starredRecipes, setStarredRecipes] = useState<Recipe[]>([]);
  const [following, setFollowing] = useState<Profile[]>([]);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequestPending, setIsRequestPending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', id)
        .single();
      setProfile(profileData);

      // Fetch user's recipes
      const { data: recipesData } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false });
      setRecipes(recipesData || []);

      // Fetch starred recipes
      const { data: starredData } = await supabase
        .from('starred_recipes')
        .select('recipe_id, recipe_type')
        .eq('user_id', id);

      if (starredData?.length) {
        const recipes = await Promise.all(
          starredData.map(async (star) => {
            if (star.recipe_type === 'user') {
              const { data } = await supabase
                .from('recipes')
                .select('*')
                .eq('id', star.recipe_id)
                .single();
              return data ? { ...data, recipe_type: 'user' } : null;
            } else if (star.recipe_type === 'ai') {
              // For AI recipes, we need to get them from localStorage
              if (typeof window !== 'undefined') {
                const local = localStorage.getItem(star.recipe_id);
                if (local) {
                  const recipe = JSON.parse(local);
                  return {
                    id: star.recipe_id,
                    title: recipe.title,
                    description: recipe.description,
                    image_url: recipe.image_url,
                    created_at: recipe.created_at,
                    recipe_type: 'ai'
                  };
                }
              }
              return null;
            } else if (star.recipe_type === 'spoonacular') {
              // For Spoonacular recipes, we need to fetch from the API
              try {
                const response = await fetch(`/api/recipe/${star.recipe_id}`);
                if (response.ok) {
                  const data = await response.json();
                  return {
                    id: star.recipe_id,
                    title: data.title,
                    description: data.description,
                    image_url: data.image,
                    created_at: data.dateAdded,
                    recipe_type: 'spoonacular'
                  };
                }
              } catch (error) {
                console.error('Error fetching Spoonacular recipe:', error);
              }
              return null;
            }
            return null;
          })
        );
        setStarredRecipes(recipes.filter(Boolean));
      }

      // Fetch following
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', id);

      if (followingData?.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', followingData.map(f => f.following_id));
        setFollowing(profiles || []);
      }

      // Fetch followers
      const { data: followersData } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', id);

      if (followersData?.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', followersData.map(f => f.follower_id));
        setFollowers(profiles || []);
      }

      // Check if current user is following this profile
      if (user) {
        const { data: isFollowingData } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', id)
          .single();
        setIsFollowing(!!isFollowingData);

        // Check if follow request is pending
        const { data: requestData } = await supabase
          .from('follow_requests')
          .select('id, status')
          .eq('requester_id', user.id)
          .eq('target_id', id)
          .eq('status', 'pending')
          .single();
        setIsRequestPending(!!requestData);
      }

      setLoading(false);
    };

    fetchProfile();
  }, [id, user]);

  const handleFollow = async () => {
    if (!user || !id) return;
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
          console.error('Error sending follow request:', followRequestError);
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
          console.error('Error sending follow request notification:', notificationError);
        }
      } else {
        await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: id
          });
        setIsFollowing(true);
        // Send notification for follow
        await supabase
          .from('notifications')
          .insert({
            user_id: id,
            type: 'follow',
            actor_id: user.id
          });
      }
    } catch (error) {
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

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 py-8">loading...</div>;
  }

  if (!profile) {
    return <div className="max-w-2xl mx-auto px-4 py-8">profile not found</div>;
  }

  return (
    <>
      <Head>
        <title>{profile.username || 'anonymous'} | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-full overflow-hidden flex items-center justify-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.username || 'avatar'} width={64} height={64} className="object-cover aspect-square" />
              ) : (
                <span className="text-2xl">{profile.username?.[0]?.toLowerCase() || 'a'}</span>
              )}
            </div>
            <div>
              <h1 className="text-2xl">
                {profile.username || 'anonymous'} {profile.is_private && '🔒'}
              </h1>
              {profile.bio && <p className="text-gray-500 dark:text-gray-400">{profile.bio}</p>}
            </div>
            {user && user.id !== id && (
              <button
                onClick={handleFollow}
                className="h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity"
                disabled={isRequestPending}
              >
                {isFollowing ? 'unfollow' : isRequestPending ? 'requested' : 'follow'}
              </button>
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
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400 mb-4">this profile is private</p>
                {user && user.id !== id && !isFollowing && (
                  <button
                    onClick={handleFollow}
                    className="h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity"
                    disabled={isRequestPending}
                  >
                    {isRequestPending ? 'requested' : 'follow to see recipes'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
} 