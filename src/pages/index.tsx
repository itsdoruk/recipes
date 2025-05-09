import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
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

export default function Home({ initialRecipes }: HomeProps) {
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

  const [userResults, setUserResults] = useState<{ user_id: string; username: string | null; avatar_url: string | null }[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchPopularRecipes = async () => {
      try {
        const popular = await getPopularRecipes();
        setPopularRecipes(popular);
      } catch (err) {
        console.error('Error fetching popular recipes:', err);
      }
    };

    fetchPopularRecipes();
  }, []);

  useEffect(() => {
    const loadMoreRecipes = async () => {
      if (!hasMore || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      let supabaseQuery = supabase
        .from('recipes')
        .select('*')
          .order('created_at', { ascending: false })
          .range((page - 1) * 10, page * 10 - 1);
      if (query) {
        supabaseQuery = supabaseQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
      }
      if (filters.cuisine) {
        supabaseQuery = supabaseQuery.eq('cuisine_type', filters.cuisine);
      }
      if (filters.diet) {
        supabaseQuery = supabaseQuery.eq('diet_type', filters.diet);
      }
      if (filters.maxReadyTime) {
        supabaseQuery = supabaseQuery.eq('cooking_time_value', filters.maxReadyTime);
      }
      const { data: localRecipes, error: localError } = await supabaseQuery;
      if (localError) throw localError;
      const transformedLocalRecipes = localRecipes?.map(recipe => ({
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        image_url: recipe.image_url,
        user_id: recipe.user_id,
        created_at: recipe.created_at,
        cuisine_type: recipe.cuisine_type,
        cooking_time: recipe.cooking_time_value ? `${recipe.cooking_time_value} ${recipe.cooking_time_unit}` : null,
        diet_type: recipe.diet_type,
      })) || [];
        setRecipes(prev => page === 1 ? transformedLocalRecipes : [...prev, ...transformedLocalRecipes]);
        setHasMore(transformedLocalRecipes.length === 10);
        } catch (err) {
        console.error('Error loading more recipes:', err);
        setError('Failed to load more recipes');
    } finally {
      setIsLoading(false);
    }
    };
    loadMoreRecipes();
  }, [page, query, filters, hasMore]);

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
        const { data, error } = await supabase
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
    if (!easterEggActive) return;
    // Replace all images
    const replaceImages = () => {
      document.querySelectorAll('img').forEach(img => {
        img.src = PIZZA_IMG;
        img.srcset = '';
      });
      // Next.js <Image> uses <img> under the hood, so this works for both
      document.querySelectorAll('[style*="background-image"]').forEach(el => {
        (el as HTMLElement).style.backgroundImage = `url('${PIZZA_IMG}')`;
      });
    };
    // Replace all text nodes
    const replaceText = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        node.textContent = 'mamma mia';
      } else {
        node.childNodes.forEach(replaceText);
      }
    };
    replaceImages();
    replaceText(document.body);
    // Also observe DOM changes to keep replacing new content
    const observer = new MutationObserver(() => {
      replaceImages();
      replaceText(document.body);
    });
    observer.observe(document.body, { childList: true, subtree: true });
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
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.remove();
        audioRef.current = null;
      }
    };
  }, [easterEggActive]);

  // Generate 5 AI internet recipes in parallel on mount
  useEffect(() => {
    const generateMultipleAiRecipes = async () => {
      setAiLoading(true);
      const aiRecipePromises = Array.from({ length: 5 }).map(async () => {
        try {
          const recipeRes = await fetch('https://www.themealdb.com/api/json/v1/1/random.php');
          const recipeData = await recipeRes.json();
          const meal = recipeData.meals?.[0];
          if (!meal) throw new Error('No random recipe found');
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
          // Extract properties from AI markdown
          const extracted = extractRecipePropertiesFromMarkdown(aiContent);
          // Helper to check if description is just the title
          const isDescriptionJustTitle = (desc: string, title: string) => {
            if (!desc || !title) return true;
            const d = desc.trim().toLowerCase();
            const t = title.trim().toLowerCase();
            return d === t || d.startsWith(t) || t.startsWith(d);
          };
          // Fallbacks: use AI's value if present, else use a friendly default
          const description =
            extracted.description &&
            extracted.description !== 'unknown' &&
            !isDescriptionJustTitle(extracted.description, meal.strMeal)
              ? extracted.description
              : "A delicious dish you'll love!";
          const ingredients = extracted.ingredients && extracted.ingredients.length > 0 ? extracted.ingredients : Object.keys(meal)
            .filter(k => k.startsWith('strIngredient') && meal[k] && meal[k].trim() && meal[k].toLowerCase() !== 'null')
            .map(k => meal[k].trim());
          const instructions = extracted.instructions && extracted.instructions.length > 0 ? extracted.instructions : (meal.strInstructions
            ? meal.strInstructions.split(/\r?\n|\.\s+/).map((s: string) => s.trim()).filter(Boolean)
            : []);
          const nutrition = (extracted.nutrition && extracted.nutrition.calories !== 'unknown') ? extracted.nutrition : { calories: 'unknown', protein: 'unknown', fat: 'unknown', carbohydrates: 'unknown' };
          // Normalize cuisine_type and diet_type for AI recipes to match filter options
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
          const cooking_time = extracted.cooking_time && extracted.cooking_time !== 'unknown' ? extracted.cooking_time : (mappedTime ? `${mappedTime} mins` : 'unknown');
          // Clean up instructions: remove duplicate number bullets if present
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
            localStorage.setItem(randomRecipeObj.id, JSON.stringify(randomRecipeObj));
          }
          return randomRecipeObj;
        } catch (err) {
          return null;
        }
      });
      const aiResults = await Promise.all(aiRecipePromises);
      setAiRecipes(aiResults.filter(Boolean));
      setAiLoading(false);
    };
    generateMultipleAiRecipes();
    // eslint-disable-next-line
  }, []);

  // Filter and search AI recipes
  const filteredAiRecipes = aiRecipes.filter(recipe => {
    // Only apply search, no filters
    return !query || recipe.title.toLowerCase().includes(query.toLowerCase()) || (recipe.description && recipe.description.toLowerCase().includes(query.toLowerCase()));
  });

  return (
    <>
      <Head>
        <title>recipes</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
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
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {isLoading ? 'Searching...' : 'Search'}
              </button>
            </div>
            {/* Filtering dropdowns */}
            <div className="flex gap-2 mt-2">
              <select
                value={filters.diet}
                onChange={e => handleFilterChange('diet', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent"
              >
                <option value="">all diets</option>
                {DIET_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select
                value={filters.cuisine}
                onChange={e => handleFilterChange('cuisine', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent"
              >
                <option value="">all cuisines</option>
                {CUISINE_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select
                value={filters.maxReadyTime || ''}
                onChange={e => handleFilterChange('maxReadyTime', Number(e.target.value))}
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent"
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
                  <UserCard key={user.user_id} user={user} />
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
                      title="Loading..."
                      description="Generating a new recipe..."
                      image_url={RANDOM_CARD_IMG}
                      user_id="recipes-ai"
                      created_at={new Date().toISOString()}
                      cuisine_type={''}
                      cooking_time={''}
                      diet_type={''}
                      readyInMinutes={undefined}
                      link={undefined}
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
                      readyInMinutes={undefined}
                      link={`/internet-recipe/${recipe.id}`}
                      recipeType="ai"
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
            <div ref={loadingRef} className="h-10 flex items-center justify-center">
              {isLoading && <p>Loading more recipes...</p>}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    // Fetch recipes from Supabase
    const { data: supabaseRecipes, error: supabaseError } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false });

    if (supabaseError) {
      console.error('Supabase error:', supabaseError);
      throw new Error(`Database error: ${supabaseError.message}`);
    }

    if (!supabaseRecipes) {
      console.error('No recipes found in database');
      return {
        props: {
          initialRecipes: [],
        },
      };
    }

    // Transform Supabase recipes to match LocalRecipe interface
    const transformedRecipes = supabaseRecipes.map(recipe => {
      try {
        return {
          id: recipe.id,
          title: recipe.title,
          description: recipe.description,
          image_url: recipe.image_url,
          user_id: recipe.user_id,
          created_at: recipe.created_at,
          cuisine_type: recipe.cuisine_type,
          cooking_time: recipe.cooking_time_value ? `${recipe.cooking_time_value} ${recipe.cooking_time_unit || 'mins'}` : null,
          diet_type: recipe.diet_type,
        };
      } catch (transformError) {
        console.error('Error transforming recipe:', recipe, transformError);
        return null;
      }
    }).filter(Boolean);

    return {
      props: {
        initialRecipes: transformedRecipes,
      },
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    // Return a more specific error message
    return {
      props: {
        initialRecipes: [],
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      },
    };
  }
};