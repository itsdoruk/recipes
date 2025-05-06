import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import { marked } from 'marked';

const CUISINE_TYPES = [
  'italian',
  'mexican',
  'asian',
  'american',
  'mediterranean',
];

const DIET_TYPES = [
  'vegetarian',
  'vegan',
  'gluten-free',
  'ketogenic',
  'paleo',
];

const COOKING_TIMES = [
  { label: 'Quick (15 mins or less)', value: 15 },
  { label: 'Medium (30 mins or less)', value: 30 },
  { label: 'Long (1 hour or less)', value: 60 },
];

interface Recipe {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  user_id: string;
  created_at: string;
  cuisine_type: string | null;
  cooking_time: string | null;
  diet_type: string | null;
}

export default function DiscoverPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [preferences, setPreferences] = useState({
    cuisine: '',
    diet: '',
    maxTime: 0,
  });

  const getAiRecommendation = async (prefs: typeof preferences) => {
    try {
      const response = await fetch('https://ai.hackclub.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a friendly cooking assistant. Keep recommendations short and sweet. Use markdown formatting:
- Use **bold** for recipe names and key points
- Use *italic* for emphasis
- Use \`code\` for cooking times and measurements
- Use - for bullet points
- Use > for tips and notes
- Use # for section headers
- Use [link text](url) for links
- Format your response in markdown and in lowercase.`
            },
            {
              role: 'user',
              content: `Give me a quick recommendation for recipes with these preferences: ${prefs.cuisine ? `Cuisine: ${prefs.cuisine}, ` : ''}${prefs.diet ? `Diet: ${prefs.diet}, ` : ''}${prefs.maxTime ? `Time: ${prefs.maxTime} minutes or less` : 'No time limit'}. Keep it brief and use markdown formatting for better readability.`
            }
          ]
        })
      });

      const data = await response.json();
      // Convert markdown to HTML using marked
      const formattedResponse = marked(data.choices[0].message.content);
      setAiResponse(formattedResponse);
    } catch (err) {
      console.error('Error getting AI recommendation:', err);
    }
  };

  const handleNext = () => {
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Get AI recommendation first
      await getAiRecommendation(preferences);

      // Build the query for local recipes
      let supabaseQuery = supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });

      // Add cuisine type filter if provided
      if (preferences.cuisine) {
        supabaseQuery = supabaseQuery.eq('cuisine_type', preferences.cuisine);
      }

      // Add diet type filter if provided
      if (preferences.diet) {
        supabaseQuery = supabaseQuery.eq('diet_type', preferences.diet);
      }

      // Add cooking time filter if provided
      if (preferences.maxTime) {
        supabaseQuery = supabaseQuery.lte('cooking_time_value', preferences.maxTime);
      }

      // Execute the query
      const { data: localRecipes, error: localError } = await supabaseQuery;

      if (localError) throw localError;

      // Search Spoonacular if we have preferences
      let spoonacularRecipes: Recipe[] = [];
      if (preferences.cuisine || preferences.diet || preferences.maxTime) {
        try {
          const queryParams = new URLSearchParams();
          if (preferences.cuisine) queryParams.append('cuisine', preferences.cuisine);
          if (preferences.diet) queryParams.append('diet', preferences.diet);
          if (preferences.maxTime) queryParams.append('maxReadyTime', preferences.maxTime.toString());
          queryParams.append('number', '10');

          const response = await fetch(
            `https://api.spoonacular.com/recipes/complexSearch?apiKey=${process.env.NEXT_PUBLIC_SPOONACULAR_API_KEY}&${queryParams.toString()}`
          );
          const data = await response.json();
          
          // Check if the response is valid and contains results
          if (data && Array.isArray(data.results)) {
            // Generate a UUID for each Spoonacular recipe
            const { v4: uuidv4 } = require('uuid');
            
            spoonacularRecipes = data.results.map((recipe: any) => {
              // Create a unique ID combining Spoonacular ID with a UUID
              const uniqueId = `spoonacular-${recipe.id}-${uuidv4()}`;
              
              return {
                id: uniqueId,
                title: recipe.title,
                description: recipe.summary?.replace(/<[^>]*>/g, '') || '',
                image_url: recipe.image,
                user_id: 'spoonacular',
                created_at: new Date().toISOString(),
                cuisine_type: preferences.cuisine || null,
                cooking_time: recipe.readyInMinutes ? `${recipe.readyInMinutes} mins` : null,
                diet_type: preferences.diet || null,
                readyInMinutes: recipe.readyInMinutes || null,
                // Add additional fields that might be needed
                ingredients: recipe.extendedIngredients?.map((ing: any) => ing.original) || [],
                instructions: recipe.analyzedInstructions?.[0]?.steps?.map((step: any) => step.step) || [],
                servings: recipe.servings || null,
                sourceUrl: recipe.sourceUrl || null
              };
            });
          } else {
            console.warn('Invalid response from Spoonacular:', data);
            spoonacularRecipes = [];
          }
        } catch (err) {
          console.error('Error fetching from Spoonacular:', err);
        }
      }

      // Combine and sort recipes
      const allRecipes = [...(localRecipes || []), ...spoonacularRecipes].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setRecipes(allRecipes);
    } catch (err) {
      console.error('Error searching recipes:', err);
      setError('Failed to find recipes');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>discover | [recipes]</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="font-mono text-2xl">discover to [recipes]</h1>
            {user && (
              <Link
                href="/profile"
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono"
              >
                your profile
              </Link>
            )}
          </div>

          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="font-mono text-xl">what type of cuisine are you in the mood for?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CUISINE_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setPreferences(prev => ({ ...prev, cuisine: type }));
                      handleNext();
                    }}
                    className="p-4 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono text-left"
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="font-mono text-xl">do you have any dietary preferences?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DIET_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setPreferences(prev => ({ ...prev, diet: type }));
                      handleNext();
                    }}
                    className="p-4 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono text-left"
                  >
                    {type}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setPreferences(prev => ({ ...prev, diet: '' }));
                  handleNext();
                }}
                className="w-full p-4 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono"
              >
                no preference
              </button>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="font-mono text-xl">how much time do you have?</h2>
              <div className="grid grid-cols-1 gap-4">
                {COOKING_TIMES.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setPreferences(prev => ({ ...prev, maxTime: value }));
                      handleSubmit(new Event('submit') as any);
                    }}
                    className="p-4 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono text-left"
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setPreferences(prev => ({ ...prev, maxTime: 0 }));
                    handleSubmit(new Event('submit') as any);
                  }}
                  className="p-4 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono"
                >
                  no time limit
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="font-mono text-red-500">{error}</p>
          )}

          {aiResponse && (
            <div className="p-4 border border-gray-200 dark:border-gray-800 space-y-4">
              <h2 className="font-mono text-xl">your personalized recommendation</h2>
              <div 
                className="font-mono prose prose-invert max-w-none text-sm prose-headings:font-mono prose-p:font-mono prose-strong:font-mono prose-em:font-mono prose-code:font-mono prose-pre:font-mono prose-blockquote:font-mono prose-ul:font-mono prose-ol:font-mono prose-li:font-mono prose-a:font-mono" 
                dangerouslySetInnerHTML={{ __html: aiResponse }} 
              />
            </div>
          )}

          {recipes.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-mono text-xl">recommended recipes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recipes.map((recipe) => (
                  <Link
                    key={recipe.id}
                    href={`/recipe/${recipe.id}`}
                    className="block p-4 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity"
                  >
                    {recipe.image_url && (
                      <div className="relative w-full h-48 mb-4">
                        <Image
                          src={recipe.image_url}
                          alt={recipe.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <h3 className="font-mono text-lg">{recipe.title}</h3>
                    <div className="font-mono prose prose-invert max-w-none text-sm text-gray-500 dark:text-gray-400 line-clamp-2" dangerouslySetInnerHTML={{ __html: recipe.description }} />
                    <div className="flex justify-between items-center mt-2">
                      {recipe.cooking_time && (
                        <p className="font-mono text-sm text-gray-500 dark:text-gray-400">
                          {recipe.cooking_time}
                        </p>
                      )}
                      <p className="font-mono text-sm text-gray-500 dark:text-gray-400">
                        {new Date(recipe.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
} 