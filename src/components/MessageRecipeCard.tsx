import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import Avatar from './Avatar';
import { parseRecipeId } from '@/lib/recipeIdUtils';

interface MessageRecipeCardProps {
  recipeId: string;
  recipeType: 'user' | 'ai' | 'spoonacular';
}

export default function MessageRecipeCard({ recipeId, recipeType }: MessageRecipeCardProps) {
  const [recipe, setRecipe] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  console.log('MessageRecipeCard props:', { recipeId, recipeType });

  useEffect(() => {
    const fetchRecipe = async () => {
      if (!recipeId) return;

      try {
        setIsLoading(true);
        setError(null);

        const { source } = parseRecipeId(recipeId);
        let data;

        if (source === 'spoonacular') {
          const response = await fetch(`/api/recipes/${recipeId}`);
          if (!response.ok) throw new Error('Failed to fetch recipe');
          data = await response.json();
        } else if ((source as string) === 'internet') {
          const response = await fetch(`/api/recipes/${recipeId}`);
          if (!response.ok) throw new Error('Failed to fetch recipe');
          data = await response.json();
        } else {
          // Fetch user recipe from Supabase
          const { data: recipeData, error: recipeError } = await getBrowserClient()
            .from('recipes')
            .select('*')
            .eq('id', recipeId)
            .single();

          if (recipeError) throw recipeError;
          data = recipeData;
        }

        setRecipe(data);

        // Fetch profile for user recipes
        if (data && data.user_id && data.user_id !== 'spoonacular' && data.user_id !== 'internet' && data.user_id !== 'ai') {
          const { data: profileData, error: profileError } = await getBrowserClient()
            .from('profiles')
            .select('username, avatar_url')
            .eq('user_id', data.user_id)
            .single();
          setProfile(profileError ? null : profileData);
        } else if (data && data.user_id) {
          setProfile({ 
            username: data.user_id === 'spoonacular' ? 'Internet Recipe' : 
                     data.user_id === 'ai' ? 'AI Recipe' : data.user_id, 
            avatar_url: null 
          });
        }
      } catch (err) {
        console.error('Error fetching recipe:', err);
        setError('Failed to load recipe');
      } finally {
        setIsLoading(false);
      }
    };

    if (recipeId) {
      fetchRecipe();
    }
  }, [recipeId, recipeType]);

  // Format description text
  const formatDescription = (text: string | null | undefined) => {
    if (!text) return '';
    // Remove HTML tags if any
    const cleanText = text.replace(/<[^>]*>/g, '');
    // Limit to 150 characters
    return cleanText.length > 150 ? cleanText.substring(0, 150) + '...' : cleanText;
  };

  if (isLoading) {
    return (
      <div className="block border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity rounded-xl overflow-hidden opacity-60 pointer-events-none select-none h-[400px] flex flex-col" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="relative w-full h-48 flex-shrink-0 bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 flex flex-col p-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="block border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden h-[400px] flex flex-col" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="flex-1 flex flex-col p-4 justify-center items-center">
          <p className="text-red-500">{error || 'Recipe not found'}</p>
        </div>
      </div>
    );
  }

  // Clean the recipe ID for the URL
  const recipeUrl = `/recipe/${recipeId}`;

  const cardContent = (
    <div className="h-[400px] flex flex-col rounded-xl overflow-hidden border border-outline" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {recipe.image_url || recipe.image ? (
        <div className="relative w-full h-48 flex-shrink-0">
          <Image
            src={recipe.image_url || recipe.image || ''}
            alt={recipe.title}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className="w-full h-48 flex-shrink-0" style={{ background: "var(--background)" }}>
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No image available
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg line-clamp-1" style={{ color: "var(--foreground)" }}>{recipe.title}</h2>
        </div>
        <p className="text-sm mb-4 line-clamp-2" style={{ color: "var(--foreground)" }}>
          {formatDescription(recipe.description || recipe.summary)}
        </p>
        <div className="mt-auto flex items-center gap-3 pt-4 border-t" style={{ borderColor: "var(--outline)" }}>
          {profile?.avatar_url ? (
            <Avatar avatar_url={profile.avatar_url} username={profile.username} size={32} />
          ) : (
            <Avatar username={profile?.username} size={32} />
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
              {profile?.username || '[recipes] user'}
            </span>
            <div className="flex items-center gap-2">
              {recipe.cooking_time && (
                <p className="text-xs" style={{ color: "var(--foreground)" }}>
                  {recipe.cooking_time}
                </p>
              )}
              {recipe.readyInMinutes && (
                <p className="text-xs" style={{ color: "var(--foreground)" }}>
                  {recipe.readyInMinutes} mins
                </p>
              )}
              <p className="text-xs" style={{ color: "var(--foreground)" }}>
                {recipe.created_at ? new Date(recipe.created_at).toLocaleDateString() : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const cardClass =
    "block border border-outline hover:opacity-80 transition-opacity rounded-xl overflow-hidden";

  return (
    <Link href={recipeUrl} className={cardClass} style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {cardContent}
    </Link>
  );
} 