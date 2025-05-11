import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import { marked } from 'marked';
import RecipeCard from '@/components/RecipeCard';
import { RANDOM_CARD_IMG } from '@/lib/constants';
import MiniRecipeCard from '@/components/MiniRecipeCard';

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
  '15': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80', // quick salad
  '30': 'https://images.unsplash.com/photo-1464306076886-debca5e8a6b0?auto=format&fit=crop&w=400&q=80', // simple meal
  '60': 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80', // hearty meal
  'any': 'https://images.unsplash.com/photo-1519864600265-abb23847ef2c?auto=format&fit=crop&w=400&q=80', // generic
};

const DEFAULT_IMAGE = '/cuisine/default.jpg';

export default function DiscoverPage() {
  const router = useRouter();
  const { user } = useAuth();
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

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        // First, get blocked users
        if (user) {
          const { data: blockedData } = await supabase
            .from('blocked_users')
            .select('blocked_user_id')
            .eq('user_id', user.id);
          setBlockedUsers(blockedData?.map(b => b.blocked_user_id) || []);
        }

        // Then fetch recipes
        const { data: recipesData, error: recipesError } = await supabase
          .from('recipes')
          .select('*')
          .order('created_at', { ascending: false });

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

    fetchRecipes();
  }, [user, blockedUsers]);

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
      });

      if (!response.ok) throw new Error('Failed to get response');

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
                          setPreferences(prev => ({ ...prev, cuisine: type }));
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
                          setPreferences(prev => ({ ...prev, diet: type }));
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
                          setPreferences(prev => ({ ...prev, cookingTime: value.toString() }));
                          handleNext();
                        }}
                        className={`p-4 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity text-left rounded-xl ${preferences.cookingTime === value.toString() ? 'ring-2 ring-blue-500' : ''}`}
                      >
                        {label.toLowerCase()}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setPreferences(prev => ({ ...prev, cookingTime: '' }));
                        handleNext();
                      }}
                      className={`p-4 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity rounded-xl ${preferences.cookingTime === '' ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      any time
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-transparent">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity
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
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent rounded-lg"
                  />
                  <button
                    type="submit"
                    disabled={aiLoading || !input.trim()}
                    className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50 rounded-lg"
                  >
                    send
                  </button>
                </div>
              </form>
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