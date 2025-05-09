import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface StarButtonProps {
  recipeId: string;
  recipeType: 'ai' | 'spoonacular' | 'user';
  initialStarred?: boolean;
}

export default function StarButton({ recipeId, recipeType, initialStarred = false }: StarButtonProps) {
  const { user } = useAuth();
  const [isStarred, setIsStarred] = useState(initialStarred);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkStarred = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('starred_recipes')
        .select('id')
        .eq('user_id', user.id)
        .eq('recipe_id', recipeId)
        .eq('recipe_type', recipeType)
        .single();
      setIsStarred(!!data);
    };
    checkStarred();
  }, [user, recipeId, recipeType]);

  const handleStar = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      if (isStarred) {
        await supabase
          .from('starred_recipes')
          .delete()
          .eq('user_id', user.id)
          .eq('recipe_id', recipeId)
          .eq('recipe_type', recipeType);
      } else {
        await supabase
          .from('starred_recipes')
          .insert({
            user_id: user.id,
            recipe_id: recipeId,
            recipe_type: recipeType
          });
      }
      setIsStarred(!isStarred);
    } catch (error) {
      console.error('error toggling star:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <button
      onClick={handleStar}
      disabled={isLoading}
      className="h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50"
    >
      {isStarred ? '★' : '☆'}
    </button>
  );
} 