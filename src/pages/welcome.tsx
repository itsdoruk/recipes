import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import { marked } from 'marked';
import RecipeCard from '@/components/RecipeCard';
import { useTranslation } from '@/lib/hooks/useTranslation';

const CUISINE_TYPES = [
  'italian', 'mexican', 'asian', 'american', 'mediterranean',
  'french', 'chinese', 'japanese', 'indian', 'thai', 'greek',
  'spanish', 'british', 'turkish', 'korean', 'vietnamese', 'german', 'caribbean', 'african', 'middle eastern', 'russian', 'brazilian'
];

const DIET_TYPES = [
  'vegetarian', 'vegan', 'gluten-free', 'ketogenic', 'paleo',
  'pescatarian', 'lacto-vegetarian', 'ovo-vegetarian', 'whole30', 'low-fodmap', 'dairy-free', 'nut-free', 'halal', 'kosher'
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

interface UserPreferences {
  cuisine?: string;
  diet?: string;
  cookingTime?: string;
}

export default function DiscoverPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({});
  const [aiRecipe, setAiRecipe] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const getAiRecommendation = async () => {
    setAiLoading(true);
    try {
      // Get the target language code based on router locale
      const targetLang = router.locale === 'es' ? 'es' : router.locale === 'tr' ? 'tr' : 'en';

      // Translate the recommendation using LibreTranslate
      const translateContent = async (text: string) => {
        if (targetLang === 'en') return text; // No need to translate if target is English
        
        try {
          const res = await fetch("https://libretranslate.com/translate", {
            method: "POST",
            body: JSON.stringify({
              q: text,
              source: "en",
              target: targetLang,
              format: "text"
            }),
            headers: { "Content-Type": "application/json" }
          });
          
          if (!res.ok) {
            throw new Error(`Translation failed with status: ${res.status}`);
          }
          
          const data = await res.json();
          return data.translatedText;
        } catch (err) {
          console.error('Translation error:', err);
          // Return the original text if translation fails
          return text;
        }
      };

      // Generate recommendation in English first
      const recommendation = `Based on your preferences for ${preferences.cuisine || 'any cuisine'}, ${preferences.diet || 'any diet'}, and ${preferences.cookingTime || 'any time'}, here are some recipe suggestions:

1. Quick and Easy Pasta Primavera - A light and fresh pasta dish with seasonal vegetables
2. Mediterranean Grilled Chicken - Juicy chicken with herbs and lemon
3. Vegetarian Buddha Bowl - A colorful bowl packed with nutrients
4. Asian Stir-Fry - Quick and flavorful stir-fry with your choice of protein
5. Mexican Street Tacos - Authentic street-style tacos with fresh toppings`;

      // Translate the recommendation
      const translatedRecommendation = await translateContent(recommendation);
      setAiResponse(translatedRecommendation);
    } catch (err) {
      console.error('Error getting AI recommendation:', err);
      setError('Failed to get recommendation');
    } finally {
      setAiLoading(false);
    }
  };

  const getAiRecipe = async () => {
    setAiLoading(true);
    try {
      // Get the target language code based on router locale
      const targetLang = router.locale === 'es' ? 'es' : router.locale === 'tr' ? 'tr' : 'en';

      // Translate the recipe using LibreTranslate
      const translateContent = async (text: string) => {
        if (targetLang === 'en') return text; // No need to translate if target is English
        
        try {
          const res = await fetch("https://libretranslate.com/translate", {
            method: "POST",
            body: JSON.stringify({
              q: text,
              source: "en",
              target: targetLang,
              format: "text"
            }),
            headers: { "Content-Type": "application/json" }
          });
          
          if (!res.ok) {
            throw new Error(`Translation failed with status: ${res.status}`);
          }
          
          const data = await res.json();
          return data.translatedText;
        } catch (err) {
          console.error('Translation error:', err);
          // Return the original text if translation fails
          return text;
        }
      };

      // Generate recipe in English first
      const recipe = {
        title: "Quick and Easy Pasta Primavera",
        description: "A light and fresh pasta dish with seasonal vegetables, perfect for a quick weeknight dinner.",
        ingredients: [
          "8 oz pasta",
          "2 cups mixed vegetables (bell peppers, zucchini, carrots)",
          "2 cloves garlic",
          "2 tbsp olive oil",
          "1/4 cup parmesan cheese",
          "Salt and pepper to taste"
        ],
        instructions: [
          "Cook pasta according to package instructions",
          "Heat olive oil in a large pan",
          "Add garlic and vegetables, sauté until tender",
          "Drain pasta and add to the pan",
          "Toss with parmesan cheese and season with salt and pepper"
        ]
      };

      // Translate the recipe
      const translatedRecipe = {
        title: await translateContent(recipe.title),
        description: await translateContent(recipe.description),
        ingredients: await Promise.all(recipe.ingredients.map((ing: string) => translateContent(ing))),
        instructions: await Promise.all(recipe.instructions.map((step: string) => translateContent(step)))
      };

      setAiRecipe(translatedRecipe);
    } catch (err) {
      console.error('Error getting AI recipe:', err);
      setError('Failed to get recipe');
    } finally {
      setAiLoading(false);
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
      await getAiRecommendation();
      await getAiRecipe();

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
      if (preferences.cookingTime) {
        supabaseQuery = supabaseQuery.lte('cooking_time_value', preferences.cookingTime);
      }

      // Execute the query
      const { data: localRecipes, error: localError } = await supabaseQuery;

      if (localError) throw localError;

      // Search Spoonacular if we have preferences
      let spoonacularRecipes: Recipe[] = [];
      if (preferences.cuisine || preferences.diet || preferences.cookingTime) {
        try {
          const queryParams = new URLSearchParams();
          if (preferences.cuisine) queryParams.append('cuisine', preferences.cuisine);
          if (preferences.diet) queryParams.append('diet', preferences.diet);
          if (preferences.cookingTime) queryParams.append('maxReadyTime', preferences.cookingTime);
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
      console.error('Error:', err);
      setError('Failed to process your request');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{t('nav.discover')} | {t('nav.recipes')}</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="space-y-8">
          <div className="flex justify-between items-center">    
          </div>

          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl">{t('welcome.cuisineQuestion')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CUISINE_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setPreferences(prev => ({ ...prev, cuisine: type }));
                      handleNext();
                    }}
                    className="p-4 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity text-left"
                  >
                    {t(`cuisine.${type}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl">{t('welcome.dietQuestion')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DIET_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setPreferences(prev => ({ ...prev, diet: type }));
                      handleNext();
                    }}
                    className="p-4 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity text-left"
                  >
                    {t(`diet.${type}`)}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setPreferences(prev => ({ ...prev, diet: '' }));
                  handleNext();
                }}
                className="w-full p-4 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity"
              >
                {t('recipe.anyDiet')}
              </button>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl">{t('welcome.timeQuestion')}</h2>
              <div className="grid grid-cols-1 gap-4">
                {COOKING_TIMES.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setPreferences(prev => ({ ...prev, cookingTime: value.toString() }));
                      handleSubmit(new Event('submit') as any);
                    }}
                    className="p-4 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity text-left"
                  >
                    {value === 15 ? t('time.quick', { minutes: 15 }) :
                     value === 30 ? t('time.medium', { minutes: 30 }) :
                     t('time.long', { hours: 1 })}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setPreferences(prev => ({ ...prev, cookingTime: '' }));
                    handleSubmit(new Event('submit') as any);
                  }}
                  className="p-4 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity"
                >
                  {t('recipe.anyTime')}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-500">{error}</p>
          )}

          {aiResponse && (
            <div className="p-4 border border-gray-200 dark:border-gray-800 space-y-4">
              <h2 className="text-xl">{t('welcome.recommendation')}</h2>
              <div 
                className="prose prose-invert max-w-none text-sm prose-headings:prose-p:prose-strong:prose-em:prose-code:prose-pre:prose-blockquote:prose-ul:prose-ol:prose-li:prose-a:" 
                dangerouslySetInnerHTML={{ __html: aiResponse }} 
              />
            </div>
          )}

          {recipes.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl">{t('welcome.recommendedRecipes')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiRecipe && (
                  <RecipeCard
                    key={aiRecipe.id}
                    id={aiRecipe.id}
                    title={aiRecipe.title}
                    description={aiRecipe.description}
                    image_url={aiRecipe.image_url}
                    user_id={aiRecipe.user_id}
                    created_at={aiRecipe.created_at}
                    cuisine_type={aiRecipe.cuisine_type}
                    cooking_time={aiRecipe.cooking_time}
                    diet_type={aiRecipe.diet_type}
                    readyInMinutes={undefined}
                    link={undefined}
                  />
                )}
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
                    <h3 className="text-lg">{recipe.title}</h3>
                    <div className="prose prose-invert max-w-none text-sm text-gray-500 dark:text-gray-400 line-clamp-2" dangerouslySetInnerHTML={{ __html: recipe.description }} />
                    <div className="flex justify-between items-center mt-2">
                      {recipe.cooking_time && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {recipe.cooking_time}
                        </p>
                      )}
                      <p className="text-sm text-gray-500 dark:text-gray-400">
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