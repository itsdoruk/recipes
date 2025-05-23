import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { useAuth } from '@/lib/hooks/useAuth';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { cleanStepPrefix } from '@/lib/recipeUtils';
import RecipeCard from '@/components/RecipeCard';

type AIRecipe = {
  id: string;
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  image_url: string;
  cooking_time: string;
  user_id: string;
  cuisine_type?: string;
  diet_type?: string;
};

export default function AIRecipe() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [recipe, setRecipe] = useState<AIRecipe | null>(null);

  const generateRecipe = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt for the recipe');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate recipe');
      }

      const data = await response.json();
      
      // Create a recipe object with a temporary ID
      const newRecipe: AIRecipe = {
        id: uuidv4(),
        title: data.title || 'Untitled Recipe',
        description: data.description || '',
        ingredients: data.ingredients || [],
        instructions: data.instructions || [],
        image_url: data.image_url || '/placeholder-recipe.jpg',
        cooking_time: data.cooking_time || '30 minutes',
        user_id: 'ai',
        cuisine_type: data.cuisine_type || '',
        diet_type: data.diet_type || '',
      };
      
      setRecipe(newRecipe);
      
      // Store in localStorage for persistence
      localStorage.setItem(newRecipe.id, JSON.stringify(newRecipe));

    } catch (error) {
      console.error('Error generating recipe:', error);
      setError('Failed to generate recipe. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!recipe || !user) {
      setError('You must be logged in to save a recipe');
      return;
    }

    setIsSaving(true);
    setError(null);
    
    try {
      const supabase = getBrowserClient();
      
      // Create a new recipe entry in Supabase
      const { data, error: saveError } = await supabase
        .from('recipes')
        .insert([
          {
            title: recipe.title,
            description: recipe.description,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            image_url: recipe.image_url,
            cooking_time: recipe.cooking_time,
            user_id: user.id,
            source: 'AI Generated',
            cuisine_type: recipe.cuisine_type,
            diet_type: recipe.diet_type,
            recipe_type: 'ai'
          }
        ])
        .select()
        .single();
      
      if (saveError) throw saveError;
      
      router.push(`/recipe/${data.id}`);
    } catch (error) {
      console.error('Error saving recipe:', error);
      setError('Failed to save recipe');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTryAgain = () => {
    setRecipe(null);
    setError(null);
  };

  if (authLoading) {
    return <div className="flex justify-center items-center min-h-screen">loading...</div>;
  }

  if (!user) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="p-8 rounded-2xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
          <h1 className="text-2xl mb-4">AI Recipe Generator</h1>
          <p className="mb-4">Please log in to use the AI recipe generator.</p>
          <button
            onClick={() => router.push('/login?redirectTo=/ai-recipe')}
            className="h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity rounded-lg"
          >
            Log In
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="p-8 rounded-2xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <h1 className="text-2xl mb-4">AI Recipe Generator</h1>
        
        {!recipe ? (
          <div className="space-y-6">
            <p className="mb-4">Describe what kind of recipe you want to generate:</p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., a healthy vegetarian pasta dish with mushrooms and spinach"
              className="w-full h-32 px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent hover:opacity-80 transition-opacity rounded-lg"
            />
            
            <button
              onClick={generateRecipe}
              disabled={isLoading || !prompt.trim()}
              className="w-full h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50 rounded-lg"
            >
              {isLoading ? 'Generating...' : 'Generate Recipe'}
            </button>
            
            {error && (
              <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <p className="text-red-500">{error}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <RecipeCard
              id={recipe.id}
              title={recipe.title}
              description={recipe.description}
              image_url={recipe.image_url}
              created_at={new Date().toISOString()}
              user_id={recipe.user_id}
              cuisine_type={recipe.cuisine_type}
              diet_type={recipe.diet_type}
              cooking_time={recipe.cooking_time}
              recipeType="ai"
            />
            <div className="flex space-x-4">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="h-10 px-6 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50 rounded-lg"
              >
                {isSaving ? 'Saving...' : 'Save Recipe'}
              </button>
              <button
                onClick={handleTryAgain}
                disabled={isLoading}
                className="h-10 px-6 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50 rounded-lg"
              >
                Try Again
              </button>
            </div>
            {error && (
              <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <p className="text-red-500">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
} 