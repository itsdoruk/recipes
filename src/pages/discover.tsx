import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useUser } from '@supabase/auth-helpers-react';
import { getSupabaseClient } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import { marked } from 'marked';
import RecipeCard from '@/components/RecipeCard';
import { RANDOM_CARD_IMG } from '@/lib/constants';
import MiniRecipeCard from '@/components/MiniRecipeCard';
import { getPopularRecipes } from '@/lib/spoonacular';

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

interface BlockedUser {
  blocked_user_id: string;
}

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
  cooking_time_value?: number;
  recipe_type: 'user' | 'spoonacular' | 'ai';
  ingredients: string[];
  instructions: string[];
  nutrition: {
    calories: string;
    protein: string;
    fat: string;
    carbohydrates: string;
  };
  is_starred: boolean;
}

interface UserPreferences {
  cuisine?: string;
  diet?: string;
  cookingTime?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const CUISINE_IMAGES: Record<string, string> = {
  italian: '/italian.jpg',
  mexican: '/mexican.jpg',
  asian: '/asian.jpg',
  american: '/american.jpg',
  mediterranean: '/mediterranean.jpg',
  french: '/french.jpg',
  chinese: '/chinese.jpg',
  japanese: '/japanese.jpg',
  indian: '/indian.jpg',
  thai: '/thai.jpg',
  greek: '/greek.jpg',
  spanish: '/spanish.jpg',
  british: '/british.jpg',
  turkish: '/turkish.jpg',
  korean: '/korean.jpg',
  vietnamese: '/vietnamese.jpg',
  german: '/german.jpg',
  caribbean: '/caribbean.jpg',
  african: '/african.jpg',
  'middle eastern': '/middle-eastern.jpg',
  russian: '/russian.jpg',
  brazilian: '/brazilian.jpg',
};

const DIET_IMAGES: Record<string, string> = {
  vegetarian: '/vegetarian.jpg',
  vegan: '/vegan.jpg',
  'gluten-free': '/glutenfree.jpg',
  ketogenic: '/ketogenic.jpg',
  paleo: '/paleo.jpg',
  pescatarian: '/pescetarian.jpg',
  'lacto-vegetarian': '/lactovegetarian.jpg',
  'ovo-vegetarian': '/ovovegetarian.jpg',
  whole30: '/whole30.jpg',
  'low-fodmap': '/lowfodmap.jpg',
  'dairy-free': '/dairyfree.jpg',
  'nut-free': '/nutfree.jpg',
  halal: '/halal.jpg',
  kosher: '/kosher.jpg',
};

const COOKING_TIME_IMAGES: Record<string, string> = {
  '15': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1920&q=75', // quick salad
  '30': 'https://images.unsplash.com/photo-1464306076886-debca5e8a6b0?auto=format&fit=crop&w=1920&q=75', // simple meal
  '60': 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=1920&q=75', // hearty meal
  'any': 'https://images.unsplash.com/photo-1519864600265-abb23847ef2c?auto=format&fit=crop&w=1920&q=75', // generic
};

const DEFAULT_IMAGE = '/cuisine/default.jpg';

export default function DiscoverPage() {
  const router = useRouter();
  const user = useUser();
  const supabase = getSupabaseClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [preferences, setPreferences] = useState<UserPreferences>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [aiRecipes, setAiRecipes] = useState<Recipe[]>([]);
  const [popularRecipes, setPopularRecipes] = useState<any[]>([]);
  const [showAiRecipeGenerator, setShowAiRecipeGenerator] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (currentStep === 4 && messages.length === 0) {
      const initialMessage = `i'm interested in ${preferences.cuisine || 'any'} cuisine, following a ${preferences.diet || 'any'} diet, and i have ${preferences.cookingTime || 'any'} minutes to cook. can you suggest some recipes and cooking tips that match these preferences?`;
      setMessages([{ role: 'user', content: initialMessage }]);
      (async () => {
        setAiLoading(true);
        try {
          const response = await fetch('/api/ai-assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              message: initialMessage,
              preferences: preferences
            }),
          });
          if (!response.ok) throw new Error('Failed to get response');
          const data = await response.json();
          setMessages(prev => [...prev, { role: 'assistant', content: data.response.toLowerCase() }]);
        } catch (err) {
          setError('Failed to get AI response');
        } finally {
          setAiLoading(false);
        }
      })();
    }
  }, [currentStep, preferences, messages.length]);

  const fetchRecipes = async () => {
    try {
      setIsLoading(true);
      // First, get blocked users
      if (user) {
        const { data: blockedData } = await supabase
          .from('blocked_users')
          .select('blocked_user_id')
          .eq('user_id', user.id);
        setBlockedUsers(blockedData?.map((b: BlockedUser) => b.blocked_user_id) || []);
      }

      // Then fetch recipes
      let query = supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });
        
      // Apply filters based on user preferences
      if (preferences.cuisine) {
        query = query.eq('cuisine_type', preferences.cuisine);
      }
      
      if (preferences.diet) {
        query = query.eq('diet_type', preferences.diet);
      }
      
      if (preferences.cookingTime) {
        // Convert cooking time to minutes for comparison
        const maxTime = parseInt(preferences.cookingTime);
        if (!isNaN(maxTime)) {
          query = query.or(`cooking_time_value.lte.${maxTime},cooking_time_value.is.null`);
        }
      }

      const { data: recipesData, error: recipesError } = await query;

      if (recipesError) throw recipesError;

      // Filter out blocked users' recipes
      const filteredRecipes = recipesData?.filter(recipe => !blockedUsers.includes(recipe.user_id)) || [];
      setRecipes(filteredRecipes);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching recipes:', error);
      setError('Failed to load recipes');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Fetch recipes on initial load and when preferences change
    fetchRecipes();
  }, [user, blockedUsers, preferences]);

  useEffect(() => {
    // Only fetch AI recipes when preferences change
    fetchAiRecipes();
  }, [preferences]);

  const fetchAiRecipes = async () => {
    if (aiLoading) return; // Prevent multiple simultaneous calls
    
    try {
      setAiLoading(true);
      setError(null);
      
      // Generate multiple AI recipes based on preferences
      const recipePromises = Array.from({ length: 3 }, () => {
        // Generate a random meal ID between 52772 and 53000 (TheMealDB range)
        const randomMealId = Math.floor(Math.random() * (53000 - 52772 + 1)) + 52772;
        return fetch(`/api/recipes/random-internet-${randomMealId}`);
      });

      const results = await Promise.allSettled(recipePromises);
      
      // Filter out failed generations and map the successful ones
      const newRecipes = await Promise.all(
        results
          .filter((result): result is PromiseFulfilledResult<Response> => 
            result.status === 'fulfilled'
          )
          .map(async (result) => {
            const data = await result.value.json();
            if (!result.value.ok) {
              throw new Error(data.message || 'Failed to generate recipe');
            }
            return data;
          })
      );

      if (newRecipes.length === 0) {
        const errors = results
          .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
          .map(result => result.reason?.message || 'Unknown error');
        
        throw new Error(`Failed to generate recipes: ${errors.join(', ')}`);
      }
      
      // Add the new recipes to the list
      setAiRecipes(prev => [...newRecipes, ...prev]);
    } catch (error) {
      console.error('Error generating AI recipes:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate recipe suggestions. Please try again later.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim().toLowerCase();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setAiLoading(true);

    try {
      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          preferences: preferences
        }),
        credentials: 'include', // Include credentials in the request
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please sign in to use the AI assistant');
          return;
        }
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response.toLowerCase() }]);
    } catch (err) {
      console.error('Error getting AI response:', err);
      setError('Failed to get AI response');
    } finally {
      setAiLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 3) {
      setCurrentStep(prev => prev + 1);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  return (
    <>
      <Head>
        <title>discover | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8 rounded-2xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl">discover</h1>
          </div>
          {currentStep <= 3 ? (
            <div className="space-y-8">
              {currentStep === 1 && (
                <div className="space-y-4">
                  <h2 className="text-xl text-center">what type of cuisine are you in the mood for?</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 justify-center">
                    {CUISINE_TYPES.map((type) => (
                      <MiniRecipeCard
                        key={type}
                        image_url={CUISINE_IMAGES[type] || DEFAULT_IMAGE}
                        label={type}
                        onClick={() => {
                          const oldPreference = preferences.cuisine;
                          // If it's the same cuisine, toggle it off
                          const newValue = oldPreference === type ? '' : type;
                          setPreferences(prev => ({ ...prev, cuisine: newValue }));
                          if (newValue === '') {
                            // When clearing a filter, refresh immediately
                            fetchRecipes();
                            fetchAiRecipes();
                          }
                          handleNext();
                        }}
                        selected={preferences.cuisine === type}
                      />
                    ))}
                  </div>
                </div>
              )}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <h2 className="text-xl text-center">do you have any dietary preferences?</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 justify-center">
                    {DIET_TYPES.map((type) => (
                      <MiniRecipeCard
                        key={type}
                        image_url={DIET_IMAGES[type] || DEFAULT_IMAGE}
                        label={type}
                        onClick={() => {
                          const oldPreference = preferences.diet;
                          // If it's the same diet, toggle it off
                          const newValue = oldPreference === type ? '' : type;
                          setPreferences(prev => ({ ...prev, diet: newValue }));
                          if (newValue === '') {
                            // When clearing a filter, refresh immediately
                            fetchRecipes();
                            fetchAiRecipes();
                          }
                          handleNext();
                        }}
                        selected={preferences.diet === type}
                      />
                    ))}
                    <MiniRecipeCard
                      image_url="/any diet.jpg"
                      label="any diet"
                      onClick={() => {
                        setPreferences(prev => ({ ...prev, diet: '' }));
                        fetchRecipes();
                        fetchAiRecipes();
                        handleNext();
                      }}
                      selected={preferences.diet === ''}
                    />
                  </div>
                </div>
              )}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <h2 className="text-xl text-center">how much time do you have?</h2>
                  <div className="grid grid-cols-1 gap-4">
                    {COOKING_TIMES.map(({ label, value }) => (
                      <button
                        key={value}
                        onClick={() => {
                          const oldPreference = preferences.cookingTime;
                          // If it's the same time, toggle it off
                          const newValue = oldPreference === value.toString() ? '' : value.toString();
                          setPreferences(prev => ({ ...prev, cookingTime: newValue }));
                          if (newValue === '') {
                            // When clearing a filter, refresh immediately
                            fetchRecipes();
                            fetchAiRecipes();
                          }
                          handleNext();
                        }}
                        className={`p-4 border border-outline hover:opacity-80 transition-opacity text-left rounded-xl ${preferences.cookingTime === value.toString() ? 'ring-2 ring-gray-500' : ''}`}
                      >
                        {label.toLowerCase()}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setPreferences(prev => ({ ...prev, cookingTime: '' }));
                        fetchRecipes();
                        fetchAiRecipes();
                        handleNext();
                      }}
                      className={`p-4 border border-outline hover:opacity-80 transition-opacity rounded-xl ${preferences.cookingTime === '' ? 'ring-2 ring-gray-500' : ''}`}
                    >
                      any time
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-lg">your preferences</h2>
                <button 
                  onClick={() => {
                    setPreferences({});
                    fetchRecipes();
                    fetchAiRecipes();
                  }}
                  className="px-3 py-1 text-sm border border-outline hover:opacity-80 transition-opacity rounded-lg"
                >
                  reset all
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 text-sm border border-outline rounded-lg">
                  cuisine: {preferences.cuisine || 'any'}
                </span>
                <span className="px-2 py-1 text-sm border border-outline rounded-lg">
                  diet: {preferences.diet || 'any'}
                </span>
                <span className="px-2 py-1 text-sm border border-outline rounded-lg">
                  time: {preferences.cookingTime ? `${preferences.cookingTime} mins or less` : 'any'}
                </span>
              </div>
              
              <div className="space-y-4">
                <div className="overflow-y-auto p-4 space-y-4 bg-transparent" style={{ height: '60vh' }}>
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-4 rounded-xl border border-outline hover:opacity-80 transition-opacity
                          ${message.role === 'user'
                            ? 'bg-transparent'
                            : 'bg-transparent'}
                        `}
                      >
                        <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: marked(message.content) }} />
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="flex justify-start">
                      <div className="flex space-x-2 items-center">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="ask me anything about cooking..."
                      className="flex-1 px-3 py-2 border border-outline bg-transparent rounded-lg"
                    />
                    <button
                      type="submit"
                      disabled={aiLoading || !input.trim()}
                      className="px-3 py-2 border border-outline hover:opacity-80 transition-opacity disabled:opacity-50 rounded-lg"
                    >
                      send
                    </button>
                  </div>
                </form>
              </div>
              
              {/* Recipe Results */}
              {recipes.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl">matching recipes</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {recipes.map((recipe) => (
                      <RecipeCard
                        key={recipe.id}
                        id={recipe.id}
                        title={recipe.title}
                        description={recipe.description}
                        image_url={recipe.image_url}
                        user_id={recipe.user_id}
                        created_at={recipe.created_at}
                        cuisine_type={recipe.cuisine_type}
                        cooking_time={recipe.cooking_time}
                        diet_type={recipe.diet_type}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* AI Recipe Results */}
              {aiRecipes.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl">ai recipe suggestions</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {aiLoading ? (
                      Array.from({ length: 2 }).map((_, idx) => (
                        <RecipeCard
                          key={`ai-loading-${idx}-${Date.now()}`}
                          id={`ai-loading-${idx}`}
                          title="loading..."
                          description="Loading AI recipes..."
                          image_url={RANDOM_CARD_IMG}
                          user_id="ai"
                          created_at={new Date().toISOString()}
                          cuisine_type=""
                          cooking_time=""
                          diet_type=""
                          loading={true}
                          recipeType="ai"
                        />
                      ))
                    ) : (
                      aiRecipes.map((recipe, index) => (
                        <RecipeCard
                          key={`${recipe.id}-${index}`}
                          id={recipe.id}
                          title={recipe.title}
                          description={recipe.description}
                          image_url={recipe.image_url}
                          user_id={recipe.user_id}
                          created_at={recipe.created_at}
                          cuisine_type={recipe.cuisine_type}
                          cooking_time={recipe.cooking_time}
                          diet_type={recipe.diet_type}
                          recipeType="ai"
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {error && (
            <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <p className="text-red-500">{error.toLowerCase()}</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
} 