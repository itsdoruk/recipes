import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { getBrowserClient } from '@/lib/supabase/browserClient';

type RecipeType = 'user' | 'spoonacular' | 'ai' | 'recipe';

interface StarredRecipe {
  recipe_id: string;
  recipe_type: RecipeType;
  created_at: string;
}

interface BlockedUser {
  blocked_user_id: string;
}

export function useStarredRecipes(userId?: string) {
  const { user: currentUser } = useAuth();
  const [starredRecipes, setStarredRecipes] = useState<StarredRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingStars, setPendingStars] = useState<Set<string>>(new Set());
  const subscriptionRef = useRef<any>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;

  const fetchStarredRecipes = useCallback(async () => {
    const effectiveUserId = userId || currentUser?.id;
    if (!effectiveUserId) {
      setStarredRecipes([]);
      setIsLoading(false);
      return;
    }

    try {
      const supabase = getBrowserClient();
      
      // Get blocked users
      const { data: blockedUsers, error: blockedError } = await supabase
        .from('blocked_users')
        .select('blocked_user_id')
        .eq('user_id', effectiveUserId);

      if (blockedError) {
        console.error('Error fetching blocked users:', blockedError);
        throw blockedError;
      }

      const blockedUserIds = new Set(blockedUsers?.map((b: BlockedUser) => b.blocked_user_id) || []);

      // Fetch starred recipes
      const { data, error: fetchError } = await supabase
        .from('starred_recipes')
        .select('recipe_id, recipe_type, created_at')
        .eq('user_id', effectiveUserId);

      if (fetchError) {
        console.error('Error fetching starred recipes:', fetchError);
        throw fetchError;
      }

      // Filter out recipes from blocked users
      const filteredRecipes = data?.filter((recipe: StarredRecipe) => {
        if (recipe.recipe_type === 'user') {
          return !blockedUserIds.has(recipe.recipe_id);
        }
        return true;
      }) || [];

      setStarredRecipes(filteredRecipes);
      setError(null);
      retryCountRef.current = 0; // Reset retry count on success
    } catch (error) {
      console.error('Error fetching starred recipes:', error);
      
      // Implement retry logic
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        const delay = RETRY_DELAY * Math.pow(2, retryCountRef.current - 1);
        console.log(`Retrying fetch in ${delay}ms (attempt ${retryCountRef.current}/${MAX_RETRIES})`);
        
        setTimeout(() => {
          fetchStarredRecipes();
        }, delay);
      } else {
        setError(error instanceof Error ? error.message : 'Failed to fetch starred recipes');
        setStarredRecipes([]);
        retryCountRef.current = 0; // Reset retry count
      }
    } finally {
      if (retryCountRef.current === 0) {
        setIsLoading(false);
      }
    }
  }, [userId, currentUser]);

  // Set up realtime subscription
  useEffect(() => {
    const effectiveUserId = userId || currentUser?.id;
    if (!effectiveUserId) return;

    const supabase = getBrowserClient();
    
    // Clean up existing subscription if it exists
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    // Set up new subscription
    subscriptionRef.current = supabase
      .channel('starred_recipes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'starred_recipes',
        filter: `user_id=eq.${effectiveUserId}`
      }, async (payload: any) => {
        console.log('Starred recipes update:', payload);
        
        try {
          // Get current blocked users
          const { data: blockedUsers } = await supabase
            .from('blocked_users')
            .select('blocked_user_id')
            .eq('user_id', effectiveUserId);

          const blockedUserIds = new Set(blockedUsers?.map((b: BlockedUser) => b.blocked_user_id) || []);

          if (payload.eventType === 'INSERT') {
            // Check if the recipe is from a blocked user
            if (payload.new.recipe_type === 'user' && blockedUserIds.has(payload.new.recipe_id)) {
              return; // Don't add recipes from blocked users
            }
            setStarredRecipes(prev => [...prev, {
              recipe_id: payload.new.recipe_id,
              recipe_type: payload.new.recipe_type,
              created_at: payload.new.created_at
            }]);
          } else if (payload.eventType === 'DELETE') {
            setStarredRecipes(prev => prev.filter(
              r => !(r.recipe_id === payload.old.recipe_id && r.recipe_type === payload.old.recipe_type)
            ));
          }
        } catch (error) {
          console.error('Error handling realtime update:', error);
        }
      })
      .subscribe((status: string) => {
        console.log('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to starred recipes changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error subscribing to starred recipes changes');
          // Attempt to resubscribe after a delay
          setTimeout(() => {
            if (subscriptionRef.current) {
              subscriptionRef.current.unsubscribe();
              subscriptionRef.current = null;
            }
            // The effect will run again and set up a new subscription
          }, RETRY_DELAY);
        }
      });

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [userId, currentUser]);

  const toggleStar = useCallback(async (recipeId: string, recipeType: RecipeType) => {
    if (!currentUser) {
      setError('Please sign in to star recipes');
      return;
    }

    const supabase = getBrowserClient();
    const starKey = `${recipeId}-${recipeType}`;
    
    if (pendingStars.has(starKey)) return;

    try {
      // Optimistically update the UI
      setPendingStars(prev => new Set(prev).add(starKey));
      const isCurrentlyStarred = starredRecipes.some(r => r.recipe_id === recipeId && r.recipe_type === recipeType);
      
      setStarredRecipes(prev => {
        if (isCurrentlyStarred) {
          return prev.filter(r => !(r.recipe_id === recipeId && r.recipe_type === recipeType));
        } else {
          return [...prev, { recipe_id: recipeId, recipe_type: recipeType, created_at: new Date().toISOString() }];
        }
      });

      if (isCurrentlyStarred) {
        // Delete the star
        const { error: deleteError } = await supabase
          .from('starred_recipes')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('recipe_id', recipeId)
          .eq('recipe_type', recipeType);

        if (deleteError) throw deleteError;
      } else {
        // Add the star
        const { error: insertError } = await supabase
          .from('starred_recipes')
          .insert({
            user_id: currentUser.id,
            recipe_id: recipeId,
            recipe_type: recipeType
          });

        if (insertError) throw insertError;
      }

      setError(null);
    } catch (error) {
      console.error('Error toggling star:', error);
      setError(error instanceof Error ? error.message : 'Failed to update star status');
      
      // Revert optimistic update
      await fetchStarredRecipes();
    } finally {
      setPendingStars(prev => {
        const next = new Set(prev);
        next.delete(starKey);
        return next;
      });
    }
  }, [currentUser, starredRecipes, fetchStarredRecipes]);

  const isStarred = useCallback((recipeId: string, recipeType: RecipeType) => {
    return starredRecipes.some(r => r.recipe_id === recipeId && r.recipe_type === recipeType);
  }, [starredRecipes]);

  const isPending = useCallback((recipeId: string, recipeType: RecipeType) => {
    return pendingStars.has(`${recipeId}-${recipeType}`);
  }, [pendingStars]);

  useEffect(() => {
    fetchStarredRecipes();
  }, [fetchStarredRecipes]);

  return {
    starredRecipes,
    isLoading,
    error,
    toggleStar,
    isStarred,
    isPending,
    refreshStarredRecipes: fetchStarredRecipes
  };
} 