import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import { marked } from 'marked';
import RecipeCard from '@/components/RecipeCard';

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
  { label: 'quick (15 mins or less)', value: 15 },
  { label: 'medium (30 mins or less)', value: 30 },
  { label: 'long (1 hour or less)', value: 60 },
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
      // Generate recommendation in English
      const recommendation = `based on your preferences for ${preferences.cuisine || 'any cuisine'}, ${preferences.diet || 'any diet'}, and ${preferences.cookingTime || 'any time'}, here are some recipe suggestions:

1. quick and easy pasta primavera - a light and fresh pasta dish with seasonal vegetables
2. mediterranean grilled chicken - juicy chicken with herbs and lemon
3. vegetarian buddha bowl - a colorful bowl packed with nutrients
4. asian stir-fry - quick and flavorful stir-fry with your choice of protein
5. mexican street tacos - authentic street-style tacos with fresh toppings`;

      setAiResponse(recommendation);
    } catch (err) {
      console.error('error getting ai recommendation:', err);
      setError('failed to get recommendation');
    } finally {
      setAiLoading(false);
    }
  };

  const getAiRecipe = async () => {
    setAiLoading(true);
    try {
      // Generate recipe in English
      const recipe = {
        title: "quick and easy pasta primavera",
        description: "a light and fresh pasta dish with seasonal vegetables, perfect for a quick weeknight dinner.",
        ingredients: [
          "8 oz pasta",
          "2 cups mixed vegetables (bell peppers, zucchini, carrots)",
          "2 cloves garlic",
          "2 tbsp olive oil",
          "1/4 cup parmesan cheese",
          "salt and pepper to taste"
        ],
        instructions: [
          "cook pasta according to package instructions",
          "heat olive oil in a large pan",
          "add garlic and vegetables, sauté until tender",
          "drain pasta and add to the pan",
          "toss with parmesan cheese and season with salt and pepper"
        ]
      };

      setAiRecipe(recipe);
    } catch (err) {
      console.error('error getting ai recipe:', err);
      setError('failed to get recipe');
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
    await getAiRecommendation();
  };

  return (
    <>
      <Head>
        <title>discover | [recipes]</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="space-y-8">
          <div className="flex justify-between items-center">    
          </div>

          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl">what type of cuisine are you in the mood for?</h2>
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
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl">do you have any dietary preferences?</h2>
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
                    {type}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setPreferences(prev => ({ ...prev, diet: '' }));
                    handleNext();
                  }}
                  className="w-full p-4 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity"
                >
                  any diet
                </button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl">how much time do you have?</h2>
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
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setPreferences(prev => ({ ...prev, cookingTime: '' }));
                    handleSubmit(new Event('submit') as any);
                  }}
                  className="p-4 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity"
                >
                  any time
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-500">{error}</p>
          )}

          {aiResponse && (
            <div className="p-4 border border-gray-200 dark:border-gray-800 space-y-4">
              <h2 className="text-xl">your personalized recommendation</h2>
              <div 
                className="prose prose-invert max-w-none text-sm prose-headings:prose-p:prose-strong:prose-em:prose-code:prose-pre:prose-blockquote:prose-ul:prose-ol:prose-li:prose-a:" 
                dangerouslySetInnerHTML={{ __html: aiResponse }} 
              />
            </div>
          )}
        </div>
      </main>
    </>
  );
} 