import { useEffect, useState } from 'react';
import { getAIRecipes } from '@/lib/recipeUtils';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/hooks/useAuth';

export const AIRecipeCard = () => {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { refreshSession } = useAuth();

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { recipes: fetchedRecipes, error: fetchError } = await getAIRecipes();
        
        if (fetchError) {
          console.error('[AIRecipeCard] Error fetching recipes:', fetchError);
          
          if (fetchError.message.includes('Session expired')) {
            // Try to refresh the session
            const refreshed = await refreshSession();
            if (!refreshed) {
              setError('Session expired. Please sign in again.');
              router.push('/login');
              return;
            }
            // Retry fetching recipes after session refresh
            const { recipes: retryRecipes, error: retryError } = await getAIRecipes();
            if (retryError) {
              setError(retryError.message);
              return;
            }
            setRecipes(Array.isArray(retryRecipes) ? retryRecipes : []);
            return;
          }
          
          setError(fetchError.message);
          return;
        }
        
        // Ensure we're setting an array
        setRecipes(Array.isArray(fetchedRecipes) ? fetchedRecipes : []);
      } catch (error) {
        console.error('[AIRecipeCard] Unexpected error:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch recipes');
        setRecipes([]); // Ensure we set an empty array on error
      } finally {
        setLoading(false);
      }
    };

    fetchRecipes();
  }, [router, refreshSession]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">{error}</p>
        <button 
          onClick={() => router.push('/login')}
          className="mt-2 text-blue-500 hover:text-blue-700"
        >
          Sign in to view recipes
        </button>
      </div>
    );
  }

  if (!Array.isArray(recipes) || recipes.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">No AI recipes available yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {recipes.map((recipe) => (
        <div key={recipe.id} className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-lg font-semibold mb-2">{recipe.title}</h3>
          <p className="text-gray-600 mb-4">{recipe.description}</p>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">
              {new Date(recipe.created_at).toLocaleDateString()}
            </span>
            <button 
              onClick={() => router.push(`/recipes/${recipe.id}`)}
              className="text-blue-500 hover:text-blue-700"
            >
              View Recipe
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}; 