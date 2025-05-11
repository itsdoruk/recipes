import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase';
import { getPopularRecipes } from '@/lib/spoonacular';
import RecipeCard from '@/components/RecipeCard';
import { marked } from 'marked';
import { GetServerSideProps } from 'next';
import { toLowerCaseObject } from '@/lib/utils';
import Image from 'next/image';
import UserCard from '@/components/UserCard';

interface SearchFilters {
  diet: string;
  cuisine: string;
  maxReadyTime: number;
}

interface HomeProps {
  initialRecipes: LocalRecipe[];
}

interface LocalRecipe {
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

interface SpoonacularSearchResult {
  id: number;
  title: string;
  image: string;
  summary?: string;
  readyInMinutes?: number;
}

const PIZZA_IMG = String('https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fwp.scoopwhoop.com%2Fwp-content%2Fuploads%2F2019%2F08%2F5d638187e2a04c57823e8c95_a299d096-af8e-452b-9b7b-3e78ac7ea7b6.jpg&f=1&nofb=1&ipt=d7d3b877a8815443046fe8942df8ed873c4e24f0bf1e00b24696f69816de2ff7');
const PIZZA_AUDIO = String('/pizza-time-theme.mp3');
const RANDOM_CARD_IMG = String('https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80'); // A fun food image

const CUISINE_TYPES = [
  String('italian'), String('mexican'), String('asian'), String('american'), String('mediterranean'),
  String('french'), String('chinese'), String('japanese'), String('indian'), String('thai'), String('greek'),
  String('spanish'), String('british'), String('turkish'), String('korean'), String('vietnamese'), String('german'), String('caribbean'), String('african'), String('middle eastern'), String('russian'), String('brazilian')
];

const DIET_TYPES = [
  String('vegetarian'), String('vegan'), String('gluten-free'), String('ketogenic'), String('paleo'),
  String('pescatarian'), String('lacto-vegetarian'), String('ovo-vegetarian'), String('whole30'), String('low-fodmap'), String('dairy-free'), String('nut-free'), String('halal'), String('kosher')
];

function mapToAllowedCuisine(cuisine: string) {
  if (!cuisine) return String('unknown');
  cuisine = cuisine.trim().toLowerCase();
  return CUISINE_TYPES.find(type => cuisine === type) || String('unknown');
}

function mapToAllowedDiet(diet: string) {
  if (!diet) return String('unknown');
  diet = diet.trim().toLowerCase();
  return DIET_TYPES.find(type => diet === type) || String('unknown');
}

function mapToAllowedTime(minutes: number | undefined) {
  if (!minutes || isNaN(minutes)) return 0;
  if (minutes <= 15) return 15;
  if (minutes <= 30) return 30;
  if (minutes <= 60) return 60;
  return 0;
}

function isDescriptionJustTitle(description: string, title: string): boolean {
  if (!description || !title) return false;
  const normalizedDesc = description.toLowerCase().trim();
  const normalizedTitle = title.toLowerCase().trim();
  return normalizedDesc === normalizedTitle || normalizedDesc.startsWith(normalizedTitle + ' ');
}

function extractRecipePropertiesFromMarkdown(markdown: string) {
  // Normalize line endings and remove extra whitespace
  let text = markdown.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Initialize result object
  const result = {
    description: '',
    ingredients: [] as string[],
    instructions: [] as string[],
    nutrition: { calories: 'unknown', protein: 'unknown', fat: 'unknown', carbohydrates: 'unknown' } as Record<string, string>,
    cuisine_type: 'unknown',
    diet_type: 'unknown',
    cooking_time: 'unknown',
    cooking_time_value: undefined as number | undefined
  };

  if (lines.length === 0) return result;

  // Helper function to extract section content
  const extractSection = (header: string): string[] => {
    const startIndex = lines.findIndex(line => line.toUpperCase().startsWith(header));
    if (startIndex === -1) return [];
    const sectionLines: string[] = [];
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^[A-Z]+:/)) break; // Stop at next section
      if (line.trim()) sectionLines.push(line);
    }
    return sectionLines;
  };

  // Extract description (everything before the first field header)
  const firstFieldIdx = lines.findIndex(line => /^(CUISINE|DIET|COOKING TIME|NUTRITION|INGREDIENTS|INSTRUCTIONS):/i.test(line));
  if (firstFieldIdx > 0) {
    result.description = lines.slice(0, firstFieldIdx).join(' ');
  } else if (firstFieldIdx === -1) {
    result.description = lines.join(' ');
  }

  // Extract cuisine
  const cuisineLine = lines.find(line => /^CUISINE:/i.test(line));
  if (cuisineLine) {
    result.cuisine_type = cuisineLine.replace(/^CUISINE:/i, '').trim().toLowerCase();
    }

  // Extract diet
  const dietLine = lines.find(line => /^DIET:/i.test(line));
  if (dietLine) {
    result.diet_type = dietLine.replace(/^DIET:/i, '').trim().toLowerCase();
    }

  // Extract cooking time (accepts variations)
  const timeLine = lines.find(line => /^COOKING TIME:/i.test(line));
  if (timeLine) {
    const timeMatch = timeLine.match(/(\d+)/);
      if (timeMatch) {
      const minutes = parseInt(timeMatch[1], 10);
      result.cooking_time_value = minutes;
        result.cooking_time = `${minutes} mins`;
      }
    }

  // Extract nutrition (accepts variations)
  const nutritionLine = lines.find(line => /^NUTRITION:/i.test(line));
  if (nutritionLine) {
    // Accepts: 400 calories, 30g protein, 10g fat, 50g carbohydrates (order can vary)
    const calMatch = nutritionLine.match(/(\d+)\s*(?:calories|kcal|cal)/i);
    const proteinMatch = nutritionLine.match(/(\d+)g\s*protein/i);
    const fatMatch = nutritionLine.match(/(\d+)g\s*fat/i);
    const carbMatch = nutritionLine.match(/(\d+)g\s*carbohydrates?/i);
        result.nutrition = {
      calories: calMatch ? calMatch[1] : 'unknown',
      protein: proteinMatch ? proteinMatch[1] : 'unknown',
      fat: fatMatch ? fatMatch[1] : 'unknown',
      carbohydrates: carbMatch ? carbMatch[1] : 'unknown',
        };
  }

  // Extract ingredients
  const ingredientLines = extractSection('INGREDIENTS:');
  result.ingredients = ingredientLines
    .map(line => line.replace(/^[-*]\s*/, ''))
    .filter(line => line.trim());

  // Extract instructions
  const instructionLines = extractSection('INSTRUCTIONS:');
  result.instructions = instructionLines
    .map(line => line.replace(/^\d+\.\s*/, '').trim())
    .filter(line =>
      line &&
      !/^(notes?|tips?)$/i.test(line) && // filter out 'Note', 'Notes', 'Tip', 'Tips'
      !/^[0-9]+$/.test(line) // filter out lines that are just numbers
    );

  return result;
}

export default function Home({ initialRecipes = [] }: HomeProps) {
  const router = useRouter();
  const { user } = useAuth();
  // Controlled search input
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [recipes, setRecipes] = useState<LocalRecipe[]>(initialRecipes);
  const [popularRecipes, setPopularRecipes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    diet: '',
    cuisine: '',
    maxReadyTime: 0
  });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observer = useRef<IntersectionObserver | null>(null);
  const loadingRef = useCallback((node: HTMLDivElement) => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, hasMore]);
  const [konamiCode, setKonamiCode] = useState<string[]>([]);
  const [easterEggActive, setEasterEggActive] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Random internet recipe card state
  const [randomRecipe, setRandomRecipe] = useState<any>(null);
  const [randomLoading, setRandomLoading] = useState(true);

  const [aiRecipes, setAiRecipes] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(true);

  const [userResults, setUserResults] = useState<{ user_id: string; username: string | null; avatar_url: string | null; bio?: string | null }[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        // First, get blocked users
        if (user) {
          const { data: blockedData } = await getSupabaseClient()
            .from('blocked_users')
            .select('blocked_user_id')
            .eq('user_id', user.id);
          setBlockedUsers(blockedData?.map((b: { blocked_user_id: string }) => b.blocked_user_id) || []);
        }

        // Then fetch recipes
        const { data: recipesData, error: recipesError } = await getSupabaseClient()
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

  const fetchPopularRecipes = async () => {
    try {
      const popular = await getPopularRecipes();
      if (popular.length === 0) {
        setAiLoading(true);
        const aiRecipePromises = Array.from({ length: 6 }).map(async () => {
          try {
            const recipeRes = await fetch('https://www.themealdb.com/api/json/v1/1/random.php');
            const recipeData = await recipeRes.json();
            const meal = recipeData.meals?.[0];
            if (!meal) throw new Error('No random recipe found');
            
            // Generate AI recipe using the same logic as before
            const improvisePrompt = `Start with a fun, appetizing, and engaging internet-style introduction for this recipe (at least 2 sentences, do not use the title as the description). Then, on new lines, provide:
CUISINE: [guess the cuisine, e.g. british, italian, etc.]
DIET: [guess the diet, e.g. vegetarian, gluten-free, etc.]
COOKING TIME: [guess the total time in minutes, e.g. 30]
NUTRITION: [guess as: 400 calories, 30g protein, 10g fat, 50g carbohydrates]
Only provide these fields after the description, each on a new line, and nothing else.

Title: ${meal.strMeal}
Category: ${meal.strCategory}
Area: ${meal.strArea}
Instructions: ${meal.strInstructions}
Ingredients: ${Object.keys(meal).filter(k => k.startsWith('strIngredient') && meal[k]).map(k => meal[k]).join(', ')}`;

            const aiRes = await fetch('https://ai.hackclub.com/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: [
                  { role: 'system', content: 'You are a recipe formatter. Always format recipes with these exact section headers in this order: DESCRIPTION, CUISINE, DIET, COOKING TIME, NUTRITION, INGREDIENTS, INSTRUCTIONS. Each section should start on a new line with its header in uppercase followed by a colon. Ingredients should be bullet points starting with "-". Instructions should be numbered steps starting with "1."' },
                  { role: 'user', content: improvisePrompt }
                ]
              })
            });

            const aiData = await aiRes.json();
            let aiContent = aiData.choices[0].message.content;
            if (aiContent instanceof Promise) {
              aiContent = await aiContent;
            }

            const extracted = extractRecipePropertiesFromMarkdown(aiContent);
            const description = extracted.description && extracted.description !== 'unknown' && !isDescriptionJustTitle(extracted.description, meal.strMeal)
              ? extracted.description
              : "A delicious dish you'll love!";

            const ingredients = extracted.ingredients && extracted.ingredients.length > 0
              ? extracted.ingredients
              : Object.keys(meal)
                  .filter(k => k.startsWith('strIngredient') && meal[k] && meal[k].trim() && meal[k].toLowerCase() !== 'null')
                  .map(k => meal[k].trim());

            const instructions = extracted.instructions && extracted.instructions.length > 0
              ? extracted.instructions
              : (meal.strInstructions
                  ? meal.strInstructions.split(/\r?\n|\.\s+/).map((s: string) => s.trim()).filter(Boolean)
                  : []);

            const nutrition = (extracted.nutrition && extracted.nutrition.calories !== 'unknown')
              ? extracted.nutrition
              : { calories: 'unknown', protein: 'unknown', fat: 'unknown', carbohydrates: 'unknown' };

            const cuisine_type = mapToAllowedCuisine(
              extracted.cuisine_type && extracted.cuisine_type !== 'unknown'
                ? extracted.cuisine_type
                : meal.strArea || meal.strCategory || ''
            );

            const diet_type = mapToAllowedDiet(
              extracted.diet_type && extracted.diet_type !== 'unknown'
                ? extracted.diet_type
                : meal.strCategory || ''
            );

            const mappedTime = extracted.cooking_time_value || 0;
            const cooking_time = extracted.cooking_time && extracted.cooking_time !== 'unknown'
              ? extracted.cooking_time
              : (mappedTime ? `${mappedTime} mins` : 'unknown');

            const cleanedInstructions = instructions.map((step: string) => step.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);

            const randomRecipeObj = {
              id: `random-internet-${meal.idMeal}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              title: meal.strMeal,
              description,
              image_url: meal.strMealThumb || RANDOM_CARD_IMG,
              user_id: 'internet',
              created_at: new Date().toISOString(),
              ingredients,
              instructions: cleanedInstructions,
              nutrition,
              cuisine_type,
              diet_type,
              cooking_time,
              cooking_time_value: mappedTime
            };

            if (typeof window !== 'undefined') {
              try {
                // Get existing recipes
                const existingRecipes = JSON.parse(localStorage.getItem('randomRecipes') || '[]');
                
                // Keep only the last 20 recipes
                const updatedRecipes = [...existingRecipes, randomRecipeObj].slice(-20);
                
                // Store updated recipes
                localStorage.setItem('randomRecipes', JSON.stringify(updatedRecipes));
              } catch (error) {
                console.warn('Failed to store recipe in localStorage:', error);
                // Clear localStorage if it's full
                try {
                  localStorage.clear();
                  localStorage.setItem('randomRecipes', JSON.stringify([randomRecipeObj]));
                } catch (clearError) {
                  console.error('Failed to clear localStorage:', clearError);
                }
              }
            }

            return randomRecipeObj;
          } catch (err) {
            console.error('Error generating AI recipe:', err);
            return null;
          }
        });
        const aiResults = await Promise.all(aiRecipePromises);
        setAiRecipes(prev => [...prev, ...aiResults.filter(Boolean)]);
        setAiLoading(false);
      } else {
        setPopularRecipes(popular);
        setAiLoading(false);
      }
    } catch (err) {
      console.error('Error fetching popular recipes:', err);
      setError('Failed to fetch popular recipes. Please try again later.');
      setAiLoading(false);
    }
  };

  useEffect(() => {
    fetchPopularRecipes();
    const interval = setInterval(() => {
      fetchPopularRecipes();
    }, 3600000); // 1 hour
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!recipes) return;
    const loadMoreRecipes = async () => {
      if (isLoading || !hasMore) return;
      setIsLoading(true);
      setError(null);
      try {
        let supabaseQuery = getSupabaseClient()
          .from('recipes')
          .select('*')
          .order('created_at', { ascending: false })
          .range(recipes.length, recipes.length + 9);

        if (query) {
          supabaseQuery = supabaseQuery.ilike('title', `%${query}%`);
        }

        const { data, error } = await supabaseQuery;

        if (error) throw error;

        if (data) {
          setRecipes(prev => [...prev, ...data]);
          setHasMore(data.length === 10);
        }
      } catch (err) {
        console.error('Error loading more recipes:', err);
        setError('Failed to load more recipes');
      } finally {
        setIsLoading(false);
      }
    };
    loadMoreRecipes();
  }, [recipes?.length, query, hasMore]);

  // Controlled search input logic
  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPage(1);
    setRecipes([]);
    setHasMore(true);
    setQuery(searchInput); // Set the main query to the input value
    
    // Fetch users matching the query
    if (searchInput.trim().length > 0) {
      try {
        const { data, error } = await getSupabaseClient()
          .from('profiles')
          .select('user_id, username, avatar_url, bio')
          .ilike('username', `%${searchInput}%`)
          .limit(12);
        
        if (error) {
          console.error('Error searching profiles:', error);
          setUserResults([]);
          return;
        }
        
        setUserResults(data || []);
      } catch (err) {
        console.error('Error in profile search:', err);
        setUserResults([]);
      }
    } else {
      setUserResults([]);
    }
  };

  const handleFilterChange = (key: keyof SearchFilters, value: string | number) => {
    let mappedValue = value;
    
    // Map the value to an allowed value based on the filter type
    if (key === 'cuisine') {
      mappedValue = mapToAllowedCuisine(value as string);
    } else if (key === 'diet') {
      mappedValue = mapToAllowedDiet(value as string);
    } else if (key === 'maxReadyTime') {
      mappedValue = mapToAllowedTime(value as number);
    }

    setFilters(prev => ({ ...prev, [key]: mappedValue }));
    setPage(1);
    setRecipes([]);
    setHasMore(true);
  };

  useEffect(() => {
    const secretCode = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    const handleKeyDown = (e: KeyboardEvent) => {
      const newKonami = [...konamiCode, e.key];
      if (newKonami.length > secretCode.length) newKonami.shift();
      setKonamiCode(newKonami);
      if (newKonami.join(',') === secretCode.join(',')) {
        setEasterEggActive(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [konamiCode]);

  useEffect(() => {
    if (!easterEggActive) {
      // Restore original images and text if previously replaced
      const main = document.querySelector('main');
      if (main) {
        // Restore images
        main.querySelectorAll('img[data-original-src]').forEach(img => {
          img.src = img.getAttribute('data-original-src') || '';
          img.removeAttribute('data-original-src');
        });
        // Restore text
        main.querySelectorAll('[data-original-text]').forEach(el => {
          el.textContent = el.getAttribute('data-original-text') || '';
          el.removeAttribute('data-original-text');
        });
      }
      // Clean up audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.remove();
        audioRef.current = null;
      }
      return;
    }
    // Replace images and text only inside <main>
    const main = document.querySelector('main');
    if (!main) return;
    // Replace images
    main.querySelectorAll('img').forEach(img => {
      if (!img.hasAttribute('data-original-src')) {
        img.setAttribute('data-original-src', img.src);
      }
      img.src = PIZZA_IMG;
      img.srcset = '';
    });
    // Replace text nodes (only direct children of elements)
    const replaceTextNodes = (el) => {
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
          const parent = node.parentElement || el;
          if (!parent.hasAttribute('data-original-text')) {
            parent.setAttribute('data-original-text', node.textContent);
          }
          node.textContent = 'mamma mia';
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          replaceTextNodes(node);
        }
      }
    };
    replaceTextNodes(main);
    // Observe DOM changes in <main>
    const observer = new MutationObserver(() => {
      main.querySelectorAll('img').forEach(img => {
        if (!img.hasAttribute('data-original-src')) {
          img.setAttribute('data-original-src', img.src);
        }
        img.src = PIZZA_IMG;
        img.srcset = '';
      });
      replaceTextNodes(main);
    });
    observer.observe(main, { childList: true, subtree: true });
    // Play audio in loop
    if (!audioRef.current) {
      const audio = document.createElement('audio');
      audio.src = PIZZA_AUDIO;
      audio.loop = true;
      audio.autoplay = true;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      audioRef.current = audio;
      audio.play();
    }
    return () => {
      observer.disconnect();
      // Restore images and text
      main.querySelectorAll('img[data-original-src]').forEach(img => {
        img.src = img.getAttribute('data-original-src') || '';
        img.removeAttribute('data-original-src');
      });
      main.querySelectorAll('[data-original-text]').forEach(el => {
        el.textContent = el.getAttribute('data-original-text') || '';
        el.removeAttribute('data-original-text');
      });
      // Clean up audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.remove();
        audioRef.current = null;
      }
    };
  }, [easterEggActive]);

  // Filter and search AI recipes
  const filteredAiRecipes = aiRecipes.filter(recipe => {
    // Only apply search, no filters
    return !query || recipe.title.toLowerCase().includes(query.toLowerCase()) || (recipe.description && recipe.description.toLowerCase().includes(query.toLowerCase()));
  });

  return (
    <>
      <Head>
        <title>recipes | [recipes]</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8 rounded-2xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl">recipes</h1>
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="search recipes or users..."
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent rounded-lg"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50 rounded-lg"
              >
                {isLoading ? 'Searching...' : 'Search'}
              </button>
            </div>
            {/* Filtering dropdowns */}
            <div className="flex gap-2 mt-2">
              <select
                value={filters.diet}
                onChange={e => handleFilterChange('diet', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent rounded-lg"
              >
                <option value="">all diets</option>
                {DIET_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select
                value={filters.cuisine}
                onChange={e => handleFilterChange('cuisine', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent rounded-lg"
              >
                <option value="">all cuisines</option>
                {CUISINE_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select
                value={filters.maxReadyTime || ''}
                onChange={e => handleFilterChange('maxReadyTime', Number(e.target.value))}
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent rounded-lg"
              >
                <option value="">any time</option>
                <option value="15">15 mins or less</option>
                <option value="30">30 mins or less</option>
                <option value="60">1 hour or less</option>
              </select>
            </div>
          </form>

          {/* User search results section */}
          {userResults.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xl mt-8 mb-2">users</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userResults.map((user) => (
                  <UserCard key={user.user_id} user={{ ...user, bio: user.bio ?? null }} />
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-500">{error}</p>
          )}

          <div className="space-y-4">
            <h2 className="text-xl">recipes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aiLoading
                ? Array.from({ length: 5 }).map((_, idx) => (
                    <RecipeCard
                      key={`ai-loading-${idx}`}
                      id={`ai-loading-${idx}`}
                      title="loading..."
                      description="Generating a new recipe..."
                      image_url={RANDOM_CARD_IMG}
                      user_id="recipes-ai"
                      created_at={new Date().toISOString()}
                      cuisine_type={''}
                      cooking_time={''}
                      diet_type={''}
                      loading={true}
                      recipeType="ai"
                    />
                  ))
                : (filteredAiRecipes.length > 0
                    ? filteredAiRecipes
                    : aiRecipes.length > 0
                      ? [aiRecipes[0]]
                      : []
                ).map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    id={recipe.id}
                    title={recipe.title}
                    description={recipe.description}
                    funDescription={recipe.funDescription}
                    image_url={recipe.image_url}
                    user_id={recipe.user_id}
                    created_at={recipe.created_at}
                    cuisine_type={recipe.cuisine_type}
                    cooking_time={recipe.cooking_time}
                    diet_type={recipe.diet_type}
                    recipeType="ai"
                    link={`/internet-recipe/${recipe.id}`}
                  />
                ))}
              {popularRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  id={`spoonacular-${recipe.id}`}
                  title={recipe.title}
                  description={recipe.summary?.replace(/<[^>]*>/g, '') || ''}
                  image_url={recipe.image}
                  user_id="spoonacular"
                  created_at={new Date().toISOString()}
                  cuisine_type={recipe.cuisines?.[0] || null}
                  cooking_time={recipe.readyInMinutes ? `${recipe.readyInMinutes} mins` : null}
                  diet_type={recipe.diets?.[0] || null}
                  readyInMinutes={recipe.readyInMinutes}
                />
              ))}
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
        </div>
      </main>
    </>
  );
}