import { useState } from 'react';
import { useStarredRecipes } from '@/hooks/useStarredRecipes';
import { getBrowserClient } from '@/lib/supabase/browserClient';

export type RecipeType = 'user' | 'spoonacular' | 'ai' | 'recipe';

interface StarButtonProps {
  recipeId: string;
  recipeType: RecipeType;
  isStarred?: boolean;
  onToggle?: (isStarred: boolean) => void;
}

export default function StarButton({ recipeId, recipeType, isStarred: initialIsStarred, onToggle }: StarButtonProps) {
  const { isStarred, toggleStar, isPending } = useStarredRecipes();
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    if (isLoading || isPending(recipeId, recipeType)) return;
    setIsLoading(true);

    try {
      await toggleStar(recipeId, recipeType);
      if (onToggle) {
        onToggle(!isStarred(recipeId, recipeType));
      }
    } catch (error) {
      console.error('Error toggling star:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading || isPending(recipeId, recipeType)}
      className="p-2 transition-all duration-300 hover:scale-125 hover:opacity-80 active:scale-95"
      aria-label={isStarred(recipeId, recipeType) ? 'Remove from starred' : 'Add to starred'}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`h-6 w-6 transition-colors duration-200 ${isStarred(recipeId, recipeType) ? 'fill-yellow-400 text-yellow-400' : 'fill-none text-gray-400 hover:text-yellow-400'}`}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
    </button>
  );
} 