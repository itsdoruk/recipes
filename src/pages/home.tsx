import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { createBrowserClient } from '@supabase/ssr';
import RecipeCard from '@/components/RecipeCard';
import { marked } from 'marked';
import { GetServerSideProps } from 'next';
import { toLowerCaseObject } from '@/lib/utils';
import Image from 'next/image';
import UserCard from '@/components/UserCard';
import { cleanStepPrefix, getAIRecipes } from '@/lib/recipeUtils';
import React from 'react';
import { getPopularRecipes, searchRecipes, type Recipe as SpoonacularRecipe, SPOONACULAR_USER_ID } from '@/lib/spoonacular';
import RecipeList from '@/components/RecipeList';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';
import Avatar from '@/components/Avatar';

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
  username?: string;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  recipeType?: 'user' | 'spoonacular' | 'ai';
}

interface RecipeCardProps {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  created_at: string | null;
  user_id: string;
  username: string;
  likes_count: number;
  comments_count: number;
  is_liked?: boolean;
  onLike?: () => void;
  onComment?: () => void;
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
  recipe_type?: string | null;
  recipeType?: 'user' | 'spoonacular' | 'ai';
  ingredients?: string[];
  instructions?: string[];
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

const TIME_OPTIONS = [
  { value: 0, label: 'any time' },
  { value: 15, label: '15 mins or less' },
  { value: 30, label: '30 mins or less' },
  { value: 45, label: '45 mins or less' },
  { value: 60, label: '1 hour or less' },
  { value: 90, label: '1.5 hours or less' },
  { value: 120, label: '2 hours or less' }
];

// List of AI recipe titles to exclude (case-insensitive, trimmed)
const EXCLUDED_AI_TITLES = [
  'spicy shrimp and vegetable stir fry',
  'spicy shrimp and vegetable stir-fry',
  'grilled lemon herb chicken',
  'vegan eggplant parmesan',
  'classic bruschetta',
  'spicy thai basil stir-fry',
  'grilled chicken fajitas',
  'chicken fajitas',
  'spicy vegan black bean tacos',
  'spicy black bean and sweet potato enchiladas',
  'spicy vegan black bean and sweet potato enchiladas',
  'spicy grilled chicken fajitas',
  'pan-seared salmon with lemon herb quinoa',
  'spicy vegetable stir fry',
  'coq au vin',
];

const FORCE_INCLUDE_AI_TITLES: string[] = [];

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
  if (minutes <= 45) return 45;
  if (minutes <= 60) return 60;
  if (minutes <= 90) return 90;
  if (minutes <= 120) return 120;
  return 180; // For recipes over 2 hours
}

function isDescriptionJustTitle(description: string, title: string): boolean {
  if (!description || !title) return false;
  const normalizedDesc = description.toLowerCase().trim();
  const normalizedTitle = title.toLowerCase().trim();
  return normalizedDesc === normalizedTitle || normalizedDesc.startsWith(normalizedTitle + ' ');
}

// Helper to find number for calories (unitless allowed) or with units for other nutrients
function extractNutrient(text: string, keyword: string | string[], allowUnitless = false): string {
  const keywords = Array.isArray(keyword) ? keyword : [keyword];
  for (const key of keywords) {
    // Strict: number with units (g, grams, kcal, calories, cal) before the keyword, or after a colon following the keyword
    const strictRegex = new RegExp(
      `(?:([0-9]+)\s*(g|grams|kcal|calories|cal)\s*(?:of)?\s*${key}|${key}\s*:?\s*([0-9]+)\s*(g|grams|kcal|calories|cal))`,
      'i'
    );
    const strictMatch = text.match(strictRegex);
    if (strictMatch) {
      return strictMatch[1] || strictMatch[3] || 'unknown';
    }
    // For calories, allow unitless numbers
    if (allowUnitless) {
      const relaxedRegex = new RegExp(
        `(?:([0-9]+)\s*(?:of\\s*)?${key}|${key}\s*:? *([0-9]+))`,
        'i'
      );
      const relaxedMatch = text.match(relaxedRegex);
      if (relaxedMatch) {
        return relaxedMatch[1] || relaxedMatch[2] || 'unknown';
      }
    }
  }
  return 'unknown';
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

  // Extract nutrition (robust keyword-based detection)
  const nutritionStartIdx = lines.findIndex(line => /^NUTRITION:/i.test(line));
  if (nutritionStartIdx !== -1) {
    // Collect all lines under NUTRITION section until next section or end
    const nutritionLines: string[] = [];
    for (let i = nutritionStartIdx + 1; i < lines.length; i++) {
      if (/^[A-Z]+:/i.test(lines[i])) break;
      if (lines[i].trim()) nutritionLines.push(lines[i]);
    }
    // Also check the header line itself for inline nutrition info
    const nutritionText = [lines[nutritionStartIdx], ...nutritionLines].join(' ').toLowerCase();

    const calories = extractNutrient(nutritionText, ['calories', 'kcal', 'cal'], true);
    const protein = extractNutrient(nutritionText, 'protein');
    const fat = extractNutrient(nutritionText, 'fat');
    const carbs = extractNutrient(nutritionText, ['carbohydrates', 'carbs']);

    // Debug log
    console.log('Nutrition extraction (keyword-based):', {
      text: nutritionText,
      extracted: { calories, protein, fat, carbs }
    });

    result.nutrition = {
      calories,
      protein,
      fat,
      carbohydrates: carbs
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
    .map(line => {
      // First remove numbering if present
      const withoutNumbering = line.replace(/^\d+\.\s*/, '').trim();
      // Then remove step prefixes
      return cleanStepPrefix(withoutNumbering);
    })
    .filter(line =>
      line &&
      !/^(notes?|tips?)$/i.test(line) && // filter out 'Note', 'Notes', 'Tip', 'Tips'
      !/^[0-9]+$/.test(line) // filter out lines that are just numbers
    );

  return result;
}

// Create a separate SearchForm component to isolate the search functionality
const SearchForm = ({ 
  searchInput, 
  setSearchInput, 
  handleSearch, 
  isLoading, 
  query, 
  filters, 
  handleFilterChange,
  handleClear,
  userResults,
  showUserDropdown,
  setShowUserDropdown,
  handleUserSearch
}: { 
  searchInput: string;
  setSearchInput: (value: string) => void;
  handleSearch: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  query: string;
  filters: SearchFilters;
  handleFilterChange: (key: keyof SearchFilters, value: string | number) => void;
  handleClear: () => void;
  userResults: { user_id: string; username: string | null; avatar_url: string | null; bio: string | null }[];
  showUserDropdown: boolean;
  setShowUserDropdown: (show: boolean) => void;
  handleUserSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => {
  return (
    <form onSubmit={handleSearch} className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchInput}
            onChange={handleUserSearch}
            onFocus={() => { if (userResults.length > 0) setShowUserDropdown(true); }}
            onBlur={() => setTimeout(() => setShowUserDropdown(false), 150)}
            placeholder="search recipes and users..."
            className="w-full px-3 py-2 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-label="Search recipes and users"
            autoComplete="off"
          />
          {showUserDropdown && userResults.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 bg-[var(--background)] border border-outline rounded-xl shadow-lg z-50 overflow-hidden">
              {Array.from(new Map(userResults.map(u => [u.username?.toLowerCase(), u])).values()).map((u) => (
                <Link
                  key={u.user_id}
                  href={`/user/${u.user_id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-outline last:border-b-0"
                  onClick={() => setShowUserDropdown(false)}
                >
                  <Avatar avatar_url={u.avatar_url} username={u.username} size={32} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block">{u.username}</span>
                    {u.bio && (
                      <span className="text-sm text-gray-500 truncate block">{u.bio}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="search"
        >
          {isLoading ? 'searching...' : 'search'}
        </button>
        {/* Only render this button when there are active filters or a query */}
        {(query || filters.cuisine || filters.diet || filters.maxReadyTime > 0) ? (
          <button
            type="button"
            onClick={handleClear}
            className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Clear search"
          >
            clear
          </button>
        ) : null}
      </div>
      {/* Filtering dropdowns */}
      <div className="flex gap-2 mt-2">
        <select
          value={filters.diet}
          onChange={e => handleFilterChange('diet', e.target.value)}
          className="flex-1 px-3 py-2 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">all diets</option>
          {DIET_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <select
          value={filters.cuisine}
          onChange={e => handleFilterChange('cuisine', e.target.value)}
          className="flex-1 px-3 py-2 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">all cuisines</option>
          {CUISINE_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <select
          value={filters.maxReadyTime}
          onChange={e => handleFilterChange('maxReadyTime', Number(e.target.value))}
          className="flex-1 px-3 py-2 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {TIME_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    </form>
  );
};

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Debug: Log the query we're about to make
    console.log('[getServerSideProps] Starting to fetch recipes...');

    // Fetch user recipes (where recipe_type is 'user')
    const { data: userRecipes, error: userError } = await supabase
      .from('recipes')
      .select('*')
      .eq('recipe_type', 'user')
      .order('created_at', { ascending: false });

    console.log('[getServerSideProps] User recipes:', userRecipes);
    console.log('[getServerSideProps] User recipes error:', userError);

    if (userError) {
      console.error('Error fetching user recipes:', userError);
      return {
        props: {
          initialRecipes: []
        }
      };
    }

    return {
      props: {
        initialRecipes: userRecipes || []
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      props: {
        initialRecipes: []
      }
    };
  }
};

export default function Home({ initialRecipes = [] }: HomeProps) {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
  const [popularRecipes, setPopularRecipes] = useState<Recipe[]>([]);
  const [aiRecipes, setAiRecipes] = useState<Recipe[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    diet: '',
    cuisine: '',
    maxReadyTime: 0
  });

  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showPizza, setShowPizza] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastRecipeRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observerRef.current.observe(node);
  }, [isLoadingMore, hasMore]);
  const { refreshSession } = useAuth();

  // Random internet recipe card state
  const [randomRecipe, setRandomRecipe] = useState<any>(null);
  const [randomLoading, setRandomLoading] = useState(true);

  const [userResults, setUserResults] = useState<{ user_id: string; username: string | null; avatar_url: string | null; bio: string | null }[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);

  const [searchResults, setSearchResults] = useState<Recipe[]>([]);

  // User search functionality
  const handleUserSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    if (value.trim().length === 0) {
      setUserResults([]);
      setShowUserDropdown(false);
      return;
    }
    
    searchTimeout.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, username, avatar_url, bio')
          .or(`username.ilike.%${value}%,bio.ilike.%${value}%`)
          .limit(8);
          
        if (!error && data) {
          setUserResults(data);
          setShowUserDropdown(true);
        } else {
          setUserResults([]);
          setShowUserDropdown(false);
        }
      } catch (error) {
        console.error('Error searching users:', error);
        setUserResults([]);
        setShowUserDropdown(false);
      }
    }, 300);
  };

  const applyFilters = (recipe: Recipe) => {
    // Skip filtering if no filters are active
    if (!filters.cuisine && !filters.diet && !filters.maxReadyTime) {
      return true;
    }

    // Apply cuisine filter
    if (filters.cuisine) {
      const recipeCuisine = (recipe.cuisine_type || 'unknown').toLowerCase().trim();
      const filterCuisine = filters.cuisine.toLowerCase().trim();
      if (recipeCuisine !== filterCuisine) {
        return false;
      }
    }

    // Apply diet filter
    if (filters.diet) {
      const recipeDiet = (recipe.diet_type || 'unknown').toLowerCase().trim();
      const filterDiet = filters.diet.toLowerCase().trim();
      if (recipeDiet !== filterDiet) {
        return false;
      }
    }

    // Apply time filter
    if (filters.maxReadyTime > 0) {
      let recipeTime: number | null = null;

      // Try to extract time from cooking_time string
      if (recipe.cooking_time) {
        const timeMatch = recipe.cooking_time.match(/(\d+)\s*mins?/i);
        if (timeMatch) {
          recipeTime = parseInt(timeMatch[1], 10);
        }
      }

      // Fall back to cooking_time_value if available
      if (!recipeTime && recipe.cooking_time_value) {
        recipeTime = recipe.cooking_time_value;
      }

      // If no time found or time exceeds filter, skip the recipe
      if (!recipeTime || recipeTime > filters.maxReadyTime) {
        return false;
      }
    }

    return true;
  };

  // Helper to deduplicate AI recipes by title (case-insensitive)
  const dedupeAIRecipes = (recipes: any[]) => {
    const seen = new Set();
    return recipes.filter(recipe => {
      const title = recipe.title?.toLowerCase().trim();
      if (!title || seen.has(title)) return false;
      seen.add(title);
      return true;
    });
  };

  function isExcludedAIRecipe(recipe: Recipe) {
    if (recipe.recipe_type !== 'ai' || !recipe.title) return false;
    const normalized = recipe.title.toLowerCase().replace(/\s+/g, ' ').trim();
    // Always include force-included recipes
    if (FORCE_INCLUDE_AI_TITLES.includes(normalized)) return false;
    return EXCLUDED_AI_TITLES.includes(normalized);
  }

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setRecipes([]);
      setPopularRecipes([]);
      setAiRecipes([]);

      // Fetch user recipes from Supabase
      const { data: userRecipes, error: userError } = await supabase
        .from('recipes')
        .select('*')
        .eq('recipe_type', 'user')
        .order('created_at', { ascending: false });

      if (userError) throw userError;

      // Fetch usernames for all unique user_ids
      const userIds = Array.from(new Set((userRecipes || []).map((r: any) => r.user_id)) as Set<string>);
      let userProfiles: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, username')
          .in('user_id', userIds);
        if (!profilesError && profiles) {
          userProfiles = profiles.reduce((acc: Record<string, string>, p: any) => {
            acc[p.user_id] = p.username;
            return acc;
          }, {});
        }
      }

      // Apply filters to user recipes and attach username
      const filteredUserRecipes = (userRecipes || []).filter((recipe: Recipe) => {
        const matchesCuisine = !filters.cuisine || 
          (recipe.cuisine_type?.toLowerCase() === filters.cuisine.toLowerCase());
        const matchesDiet = !filters.diet || 
          (recipe.diet_type?.toLowerCase() === filters.diet.toLowerCase());
        const matchesTime = !filters.maxReadyTime || 
          (recipe.cooking_time_value && recipe.cooking_time_value <= filters.maxReadyTime);
        return matchesCuisine && matchesDiet && matchesTime;
      }).map((recipe: any) => ({
        ...recipe,
        username: userProfiles[recipe.user_id] || '[recipes] user',
      }));

      setRecipes(filteredUserRecipes);

      // Fetch AI recipes that match current filters
      const { data: aiRecipesData, error: aiError } = await supabase
        .from('recipes')
        .select('*')
        .eq('recipe_type', 'ai')
        .not('image_url', 'is', null)
        .not('image_url', 'eq', '')
        .order('created_at', { ascending: false });
      if (aiError) throw aiError;
      const filteredAiRecipes = (aiRecipesData || []).filter(applyFilters).filter((r: Recipe) => !isExcludedAIRecipe(r));
      setAiRecipes(filteredAiRecipes);

      // Fetch Spoonacular recipes from database (not API)
      const { data: spoonacularRecipes, error: spoonacularError } = await supabase
        .from('recipes')
        .select('*')
        .eq('recipe_type', 'spoonacular')
        .order('created_at', { ascending: false })
        .limit(10);

      let filteredSpoonacularRecipes: Recipe[] = [];
      if (spoonacularError) {
        // If DB fetch fails, fallback to API only
        filteredSpoonacularRecipes = [];
      } else {
        if (spoonacularRecipes && spoonacularRecipes.length > 0) {
          // Apply filters to Spoonacular recipes from DB
          filteredSpoonacularRecipes = spoonacularRecipes.filter((recipe: Recipe) => {
            const matchesCuisine = !filters.cuisine || 
              (recipe.cuisine_type?.toLowerCase() === filters.cuisine.toLowerCase());
            const matchesDiet = !filters.diet || 
              (recipe.diet_type?.toLowerCase() === filters.diet.toLowerCase());
            const matchesTime = !filters.maxReadyTime || 
              (recipe.cooking_time_value && recipe.cooking_time_value <= filters.maxReadyTime);
            return matchesCuisine && matchesDiet && matchesTime;
          });
        }
      }

      // Always fetch Spoonacular recipes from API with current filters
      let apiSpoonacularRecipes: Recipe[] = [];
      try {
        const apiResults = await searchRecipes('', {
          diet: filters.diet || undefined,
          cuisine: filters.cuisine || undefined,
          maxReadyTime: filters.maxReadyTime || undefined
        });
        if (apiResults && apiResults.length > 0) {
          apiSpoonacularRecipes = apiResults.map(recipe => ({
            id: recipe.id,
            title: recipe.title,
            description: recipe.summary || 'A delicious recipe to try!',
            image_url: recipe.image,
            user_id: SPOONACULAR_USER_ID,
            created_at: recipe.dateAdded || new Date().toISOString(),
            cuisine_type: recipe.cuisines?.[0] || null,
            cooking_time: recipe.readyInMinutes ? `${recipe.readyInMinutes} mins` : null,
            diet_type: recipe.diets?.[0] || null,
            cooking_time_value: recipe.readyInMinutes,
            recipe_type: 'spoonacular',
            ingredients: recipe.extendedIngredients?.map((ing: any) => ing.original) || [],
            instructions: recipe.analyzedInstructions?.[0]?.steps?.map((step: any) => step.step) || []
          }));
        }
      } catch (apiError) {
        // If API fails, just use DB results
      }

      // Apply filters to API Spoonacular recipes as well
      const filteredApiSpoonacularRecipes = apiSpoonacularRecipes.filter(applyFilters);

      // Merge and deduplicate Spoonacular recipes by id
      const allSpoonacular = [...filteredSpoonacularRecipes, ...filteredApiSpoonacularRecipes];
      const seenSpoonacular = new Set();
      const dedupedSpoonacular = allSpoonacular.filter(r => {
        if (seenSpoonacular.has(r.id)) return false;
        seenSpoonacular.add(r.id);
        return true;
      });
      setPopularRecipes(dedupedSpoonacular);

    } catch (err) {
      console.error('[loadInitialData] Error loading initial data:', err);
      setError('Failed to load recipes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Debug: Log when loadInitialData is called and when filters change
  useEffect(() => {
    console.log('[Home] Component mounted, calling loadInitialData...');
    loadInitialData();
  }, []); // Only run on mount

  useEffect(() => {
    console.log('[Home] Filters changed:', filters);
    loadInitialData();
  }, [filters]); // Reload when filters change

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!searchInput.trim()) {
      loadInitialData();
      return;
    }

    setIsLoading(true);
    setError(null);
    setRecipes([]);
    setPopularRecipes([]);
    setAiRecipes([]);
    setSearchResults([]);
    setShowUserDropdown(false);

    try {
      const query = searchInput.trim();
      setQuery(query);

      // Search for users
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url, bio')
        .or(`username.ilike.%${query}%,bio.ilike.%${query}%`)
        .limit(8);

      if (!userError && userData) {
        setUserResults(userData);
      } else {
        setUserResults([]);
      }

      // Search local recipes - get all recipes (user, ai, spoonacular)
      const { data: allRecipes, error: allError } = await supabase
        .from('recipes')
        .select('*')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .order('created_at', { ascending: false });

      if (allError) throw new Error('Failed to search recipes');

      // Apply filters to all recipes
      const filteredAllRecipes = (allRecipes as Recipe[]).filter(applyFilters);
      const userRecipes = filteredAllRecipes.filter(r => r.recipe_type === 'user');
      const aiRecipes = filteredAllRecipes.filter((r: Recipe) => r.recipe_type === 'ai' && r.image_url && r.image_url.trim() !== '' && !isExcludedAIRecipe(r));
      // We'll ignore spoonacular from DB for search, and use API results

      // Search Spoonacular recipes with filters
      const spoonacularRecipes = await searchRecipes(query, {
        diet: filters.diet,
        cuisine: filters.cuisine,
        maxReadyTime: filters.maxReadyTime
      });

      console.log('[handleSearch] Spoonacular API returned', spoonacularRecipes.length, 'recipes for query:', query);

      const mappedSpoonacularRecipes: Recipe[] = spoonacularRecipes.map(recipe => ({
        id: recipe.id,
        title: recipe.title,
        description: recipe.summary || 'A delicious recipe to try!',
        image_url: recipe.image,
        user_id: SPOONACULAR_USER_ID,
        created_at: recipe.dateAdded || new Date().toISOString(),
        cuisine_type: recipe.cuisines?.[0] || null,
        cooking_time: recipe.readyInMinutes ? `${recipe.readyInMinutes} mins` : null,
        diet_type: recipe.diets?.[0] || null,
        cooking_time_value: recipe.readyInMinutes,
        recipeType: 'spoonacular'
      }));

      // Apply filters to Spoonacular recipes (mandatory filtering)
      const filteredSpoonacularRecipes = mappedSpoonacularRecipes.filter(applyFilters);

      // Merge all results and deduplicate
      // For Spoonacular, deduplicate by title (case-insensitive, trimmed), prefer API version
      const allResults = [
        ...userRecipes,
        ...aiRecipes,
        ...filteredSpoonacularRecipes
      ];
      const seenIds = new Set();
      const seenSpoonacularTitles = new Set();
      const dedupedResults: Recipe[] = [];
      for (const r of allResults) {
        if (r.recipeType === 'spoonacular' || r.recipe_type === 'spoonacular') {
          const normalizedTitle = (r.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
          if (seenSpoonacularTitles.has(normalizedTitle)) continue;
          seenSpoonacularTitles.add(normalizedTitle);
          dedupedResults.push(r);
        } else {
          if (seenIds.has(r.id)) continue;
          seenIds.add(r.id);
          dedupedResults.push(r);
        }
      }
      setSearchResults(dedupedResults);

    } catch (error) {
      console.error('Search error:', error);
      setError(error instanceof Error ? error.message : 'Failed to search recipes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: keyof SearchFilters, value: string | number) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    console.log('Filter changed:', key, 'to', value);
  };

  const handleClear = () => {
    setSearchInput('');
    setQuery('');
    setUserResults([]);
    setShowUserDropdown(false);
    setFilters({
      diet: '',
      cuisine: '',
      maxReadyTime: 0
    });
  };

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

          <SearchForm 
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            handleSearch={handleSearch}
            isLoading={isLoading}
            query={query}
            filters={filters}
            handleFilterChange={handleFilterChange}
            handleClear={handleClear}
            userResults={userResults}
            showUserDropdown={showUserDropdown}
            setShowUserDropdown={setShowUserDropdown}
            handleUserSearch={handleUserSearch}
          />

          {/* Active filters display */}
          {(query || filters.cuisine || filters.diet || filters.maxReadyTime > 0) && (
            <div className="flex flex-wrap gap-2">
              {query && (
                <span className="px-2 py-1 text-sm border border-outline rounded-lg transition-all duration-200 hover:scale-105 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400">
                  search: {query}
                </span>
              )}
              {filters.cuisine && (
                <span className="px-2 py-1 text-sm border border-outline rounded-lg transition-all duration-200 hover:scale-105 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-700 hover:text-green-600 dark:hover:text-green-400">
                  cuisine: {filters.cuisine}
                </span>
              )}
              {filters.diet && (
                <span className="px-2 py-1 text-sm border border-outline rounded-lg transition-all duration-200 hover:scale-105 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-700 hover:text-purple-600 dark:hover:text-purple-400">
                  diet: {filters.diet}
                </span>
              )}
              {filters.maxReadyTime > 0 && (
                <span className="px-2 py-1 text-sm border border-outline rounded-lg transition-all duration-200 hover:scale-105 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-300 dark:hover:border-orange-700 hover:text-orange-600 dark:hover:text-orange-400">
                  time: {filters.maxReadyTime} mins or less
                </span>
              )}
            </div>
          )}

          {/* User search results section */}
          {/* {userResults.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xl mt-8 mb-2">users</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userResults.map((user) => (
                  <UserCard key={user.user_id} user={user} />
                ))}
              </div>
            </div>
          )} */}

          {error && (
            <p className="text-red-500">{error}</p>
          )}

          {/* Combined recipes section */}
          <div className="space-y-4">
            <h2 className="text-xl">recipes</h2>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => <RecipeCard.Skeleton key={i} />)}
              </div>
            ) : (
              (searchInput.trim() || query) ? (
                searchResults.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dedupeAIRecipes(searchResults).map((recipe) => (
                      <RecipeCard 
                        key={`${recipe.recipeType || recipe.recipe_type || 'recipe'}-${recipe.id}`}
                        id={recipe.id}
                        title={recipe.title || ''}
                        description={recipe.description || ''}
                        image_url={recipe.image_url || RANDOM_CARD_IMG}
                        user_id={recipe.user_id}
                        created_at={recipe.created_at || ''}
                        cuisine_type={recipe.cuisine_type}
                        cooking_time={recipe.cooking_time}
                        diet_type={recipe.diet_type}
                        recipeType={recipe.recipeType || recipe.recipe_type}
                        username={(recipe as any).username}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-gray-500 dark:text-gray-400">no recipes found. try adjusting your filters or be the first to add one!</p>
                  </div>
                )
              ) : (
                (recipes.length > 0 || popularRecipes.length > 0 || aiRecipes.length > 0) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Local recipes */}
                    {recipes.map((recipe: LocalRecipe) => (
                      <RecipeCard 
                        key={recipe.id}
                        id={recipe.id}
                        title={recipe.title || ''}
                        description={recipe.description || ''}
                        image_url={recipe.image_url || RANDOM_CARD_IMG}
                        user_id={recipe.user_id}
                        created_at={recipe.created_at || ''}
                        cuisine_type={recipe.cuisine_type}
                        cooking_time={recipe.cooking_time}
                        diet_type={recipe.diet_type}
                        recipeType="user"
                        username={recipe.username}
                      />
                    ))}
                    {/* Spoonacular recipes */}
                    {popularRecipes.map((recipe: Recipe) => (
                      <RecipeCard 
                        key={recipe.id}
                        id={recipe.id}
                        title={recipe.title || ''}
                        description={recipe.description || ''}
                        image_url={recipe.image_url || RANDOM_CARD_IMG}
                        user_id={recipe.user_id}
                        created_at={recipe.created_at || ''}
                        cuisine_type={recipe.cuisine_type}
                        cooking_time={recipe.cooking_time}
                        diet_type={recipe.diet_type}
                        recipeType="spoonacular"
                      />
                    ))}
                    {/* AI recipes */}
                    {dedupeAIRecipes(aiRecipes)
                      .map((recipe) => (
                        <RecipeCard 
                          key={`ai-${recipe.id}`}
                          id={recipe.id}
                          title={recipe.title || ''}
                          description={recipe.description || 'A delicious AI-generated recipe'}
                          image_url={recipe.image_url || RANDOM_CARD_IMG}
                          user_id={recipe.user_id}
                          created_at={recipe.created_at || ''}
                          cuisine_type={recipe.cuisine_type}
                          cooking_time={recipe.cooking_time}
                          diet_type={recipe.diet_type}
                          recipeType="ai"
                        />
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-gray-500 dark:text-gray-400">no recipes found. try adjusting your filters or be the first to add one!</p>
                  </div>
                )
              )
            )}
          </div>
        </div>
      </main>
    </>
  );
}