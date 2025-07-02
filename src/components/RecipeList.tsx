import { useState, useEffect } from 'react';
import RecipeCard from './RecipeCard';

interface Recipe {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  created_at: string | null;
  user_id: string;
  username: string;
  likes_count: number;
  comments_count: number;
  is_liked?: boolean;
  cuisine_type?: string | null;
  diet_type?: string | null;
  cooking_time?: string | null;
}

interface RecipeListProps {
  recipes: Recipe[];
  onLike?: (recipeId: string) => void;
  onComment?: (recipeId: string) => void;
}

export default function RecipeList({ recipes, onLike, onComment }: RecipeListProps) {
  const [error, setError] = useState<string | null>(null);
  const [fontSizeClass, setFontSizeClass] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const updateFontSize = () => {
        const bodyClass = document.body.className;
        const match = bodyClass.match(/font-size-(normal|large|xlarge)/);
        setFontSizeClass(match ? match[0] : '');
      };
      updateFontSize();
      window.addEventListener('storage', updateFontSize);
      window.addEventListener('resize', updateFontSize);
      return () => {
        window.removeEventListener('storage', updateFontSize);
        window.removeEventListener('resize', updateFontSize);
      };
    }
  }, []);

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded relative" role="alert">
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  if (!recipes.length) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No recipes found</p>
      </div>
    );
  }

  return (
    <div key={fontSizeClass} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          id={recipe.id}
          title={recipe.title || ''}
          description={recipe.description || ''}
          image_url={recipe.image_url || ''}
          created_at={recipe.created_at || new Date().toISOString()}
          user_id={recipe.user_id}
          username={recipe.username}
          likes_count={recipe.likes_count}
          comments_count={recipe.comments_count}
          is_liked={recipe.is_liked}
          cuisine_type={recipe.cuisine_type}
          diet_type={recipe.diet_type}
          cooking_time={recipe.cooking_time}
          onLike={() => onLike?.(recipe.id)}
          onComment={() => onComment?.(recipe.id)}
          recipeType="user"
        />
      ))}
    </div>
  );
} 