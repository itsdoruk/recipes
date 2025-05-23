import { useStarredRecipes } from '@/hooks/useStarredRecipes';
import { RecipeType } from '@/lib/recipeUtils';

interface StarButtonProps {
  recipeId: string;
  recipeType: RecipeType;
  className?: string;
}

export default function StarButton({ recipeId, recipeType, className = '' }: StarButtonProps) {
  const { isStarred, toggleStar, isPending } = useStarredRecipes();

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleStar(recipeId, recipeType);
  };

  const isCurrentlyStarred = isStarred(recipeId, recipeType);
  const isCurrentlyPending = isPending(recipeId, recipeType);

  return (
    <button
      onClick={handleClick}
      disabled={isCurrentlyPending}
      className={`p-1 rounded-full hover:opacity-80 transition-opacity flex items-center justify-center ${
        isCurrentlyPending ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
      aria-label={isCurrentlyStarred ? 'Unstar recipe' : 'Star recipe'}
    >
      {isCurrentlyPending ? (
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900 dark:border-white" />
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={isCurrentlyStarred ? 'currentColor' : 'none'}
          stroke="currentColor"
          className="w-5 h-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      )}
    </button>
  );
} 