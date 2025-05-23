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
import { getPopularRecipes, searchRecipes, type Recipe as SpoonacularRecipe } from '@/lib/spoonacular';
import RecipeList from '@/components/RecipeList';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';

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
  recipeType?: 'user' | 'spoonacular' | 'ai';
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
  handleClear
}: { 
  searchInput: string;
  setSearchInput: (value: string) => void;
  handleSearch: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  query: string;
  filters: SearchFilters;
  handleFilterChange: (key: keyof SearchFilters, value: string | number) => void;
  handleClear: () => void;
}) => {
  return (
    <form onSubmit={handleSearch} className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="search recipes or users..."
          className="flex-1 px-3 py-2 border border-outline bg-transparent rounded-lg"
          aria-label="Search recipes or users"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-3 py-2 border border-outline hover:opacity-80 transition-opacity disabled:opacity-50 rounded-lg"
          aria-label="search"
        >
          {isLoading ? 'searching...' : 'search'}
        </button>
        {/* Only render this button when there are active filters or a query */}
        {(query || filters.cuisine || filters.diet || filters.maxReadyTime > 0) ? (
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-2 border border-outline hover:opacity-80 transition-opacity rounded-lg"
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
          className="flex-1 px-3 py-2 border border-outline bg-transparent rounded-lg"
        >
          <option value="">all diets</option>
          {DIET_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <select
          value={filters.cuisine}
          onChange={e => handleFilterChange('cuisine', e.target.value)}
          className="flex-1 px-3 py-2 border border-outline bg-transparent rounded-lg"
        >
          <option value="">all cuisines</option>
          {CUISINE_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <select
          value={filters.maxReadyTime}
          onChange={e => handleFilterChange('maxReadyTime', Number(e.target.value))}
          className="flex-1 px-3 py-2 border border-outline bg-transparent rounded-lg"
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

    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching initial recipes:', error);
      return {
        props: {
          initialRecipes: []
        }
      };
    }

    return {
      props: {
        initialRecipes: recipes || []
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

  const applyFilters = (recipe: Recipe) => {
    // Skip filtering if no filters are active
    if (!filters.cuisine && !filters.diet && !filters.maxReadyTime) {
      return true;
    }

    // Apply cuisine filter
    if (filters.cuisine) {
      const recipeCuisine = recipe.cuisine_type?.toLowerCase().trim() || 'unknown';
      if (recipeCuisine !== filters.cuisine.toLowerCase()) {
        return false;
      }
    }

    // Apply diet filter
    if (filters.diet) {
      const recipeDiet = recipe.diet_type?.toLowerCase().trim() || 'unknown';
      if (recipeDiet !== filters.diet.toLowerCase()) {
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

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      // Fetch AI recipes
      const { recipes: aiRecipes, error: aiError } = await getAIRecipes();
      if (aiError) throw aiError;
      
      // Apply filters and deduplicate AI recipes, then limit to 5
      const filteredAiRecipes = dedupeAIRecipes(aiRecipes.filter(applyFilters)).slice(0, 5);
      setAiRecipes(filteredAiRecipes);

      // Fetch user recipes
      const { data: userRecipes, error: userError } = await supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });

      if (userError) throw userError;
      setRecipes(userRecipes);

      // Fetch popular recipes
      const spoonacularRecipes = await searchRecipes('', {
        diet: filters.diet,
        cuisine: filters.cuisine,
        maxReadyTime: filters.maxReadyTime
      });

      const mappedSpoonacularRecipes: Recipe[] = spoonacularRecipes.map(recipe => ({
        id: recipe.id.toString(),
        title: recipe.title,
        description: recipe.summary || 'A delicious recipe to try!',
        image_url: recipe.image,
        user_id: 'spoonacular',
        created_at: recipe.dateAdded || new Date().toISOString(),
        cuisine_type: recipe.cuisines?.[0] || null,
        cooking_time: recipe.readyInMinutes ? `${recipe.readyInMinutes} mins` : null,
        diet_type: recipe.diets?.[0] || null,
        cooking_time_value: recipe.readyInMinutes,
        recipeType: 'spoonacular'
      }));

      setPopularRecipes(mappedSpoonacularRecipes);
    } catch (error) {
      console.error('Error loading initial data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load initial data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []); // Only run on mount

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

    try {
      const query = searchInput.trim();
      setQuery(query);

      // Search local recipes
      const { data: localRecipes, error: localError } = await supabase
        .from('recipes')
        .select('*')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .order('created_at', { ascending: false });

      if (localError) throw new Error('Failed to search local recipes');

      // Search TheMealDB for AI recipes
      const mealDbRes = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${query}`);
      const mealDbData = await mealDbRes.json();
      const mealDbRecipes = mealDbData.meals || [];

      // Convert TheMealDB recipes to our format
      const convertedMealDbRecipes = mealDbRecipes.map((meal: any) => {
        // Try to extract or guess diet_type and cuisine_type from meal fields
        let diet_type = 'unknown';
        // Guess vegetarian/vegan from tags or category
        const tags = meal.strTags ? meal.strTags.toLowerCase() : '';
        const category = meal.strCategory ? meal.strCategory.toLowerCase() : '';
        if (tags.includes('vegetarian') || category.includes('vegetarian')) {
          diet_type = 'vegetarian';
        } else if (tags.includes('vegan') || category.includes('vegan')) {
          diet_type = 'vegan';
        } else if (tags.includes('gluten free') || category.includes('gluten free')) {
          diet_type = 'gluten-free';
        } else if (tags.includes('pescatarian') || category.includes('pescatarian')) {
          diet_type = 'pescatarian';
        } else if (tags.includes('dairy free') || category.includes('dairy free')) {
          diet_type = 'dairy-free';
        } else if (tags.includes('non vegetarian') || category.includes('beef') || category.includes('chicken') || category.includes('lamb') || category.includes('pork') || category.includes('seafood')) {
          diet_type = 'non-vegetarian';
        }
        // Guess cuisine_type from area
        let cuisine_type = meal.strArea ? meal.strArea.toLowerCase() : 'unknown';
        // Guess cooking_time (default 30 mins, or use a better guess if available)
        let cooking_time = '30 mins';
        let cooking_time_value = 30;
        // If the meal has a tag like "quick" or "easy", set to 20 mins
        if (tags.includes('quick') || tags.includes('easy')) {
          cooking_time = '20 mins';
          cooking_time_value = 20;
        }
        return {
          id: `random-internet-${meal.idMeal}`,
          title: meal.strMeal,
          description: meal.strInstructions,
          image_url: meal.strMealThumb,
          user_id: '00000000-0000-0000-0000-000000000000',
          created_at: new Date().toISOString(),
          ingredients: Object.keys(meal)
            .filter(k => k.startsWith('strIngredient') && meal[k])
            .map(k => meal[k]),
          instructions: meal.strInstructions.split(/\r?\n|\.\s+/).filter(Boolean),
          cuisine_type,
          diet_type,
          cooking_time,
          cooking_time_value,
          recipe_type: 'ai'
        };
      });

      // Get existing AI recipes to check for duplicates
      const { data: existingAiRecipes } = await supabase
        .from('recipes')
        .select('*')
        .eq('recipe_type', 'ai')
        .order('created_at', { ascending: false });

      // Filter out duplicates from TheMealDB recipes
      const existingTitles = new Set(existingAiRecipes?.map((r: LocalRecipe) => r.title.toLowerCase().trim()) || []);
      const newAiRecipes = convertedMealDbRecipes.filter(
        (recipe: Recipe) => !existingTitles.has(recipe.title.toLowerCase().trim())
      );

      // If we have new AI recipes, save them (up to 5 total)
      if (newAiRecipes.length > 0) {
        const recipesToSave = newAiRecipes.slice(0, 5 - (existingAiRecipes?.length || 0));
        
        if (recipesToSave.length > 0) {
          // If we need to make room, delete oldest recipes
          if (existingAiRecipes && existingAiRecipes.length + recipesToSave.length > 5) {
            const recipesToDelete = existingAiRecipes.slice(5 - recipesToSave.length);
            for (const recipe of recipesToDelete) {
              await supabase
                .from('recipes')
                .delete()
                .eq('id', recipe.id);
            }
          }

          // Save new recipes
          const { error: insertError } = await supabase
            .from('recipes')
            .insert(recipesToSave);

          if (insertError) {
            console.error('Error saving new AI recipes:', insertError);
          }
        }
      }

      // Apply filters to all recipe types
      const filteredLocalRecipes = localRecipes.filter(applyFilters);
      const filteredAiRecipes = newAiRecipes.filter(applyFilters).slice(0, 5);

      // Search Spoonacular recipes with filters
      const spoonacularRecipes = await searchRecipes(query, {
        diet: filters.diet,
        cuisine: filters.cuisine,
        maxReadyTime: filters.maxReadyTime
      });

      const mappedSpoonacularRecipes: Recipe[] = spoonacularRecipes.map(recipe => ({
        id: recipe.id.toString(),
        title: recipe.title,
        description: recipe.summary || 'A delicious recipe to try!',
        image_url: recipe.image,
        user_id: 'spoonacular',
        created_at: recipe.dateAdded || new Date().toISOString(),
        cuisine_type: recipe.cuisines?.[0] || null,
        cooking_time: recipe.readyInMinutes ? `${recipe.readyInMinutes} mins` : null,
        diet_type: recipe.diets?.[0] || null,
        cooking_time_value: recipe.readyInMinutes,
        recipeType: 'spoonacular'
      }));

      // Apply filters to Spoonacular recipes as well
      const filteredSpoonacularRecipes = mappedSpoonacularRecipes.filter(applyFilters);

      setRecipes(filteredLocalRecipes);
      setAiRecipes(filteredAiRecipes);
      setPopularRecipes(filteredSpoonacularRecipes);
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
    setFilters({
      diet: '',
      cuisine: '',
      maxReadyTime: 0
    });
  };

  const fetchAiRecipes = async () => {
    try {
      setIsLoading(true);
      const { recipes: aiRecipes, error: aiError } = await getAIRecipes();
      if (aiError) throw aiError;
      
      // Apply filters, deduplicate, and limit to 5
      const filteredAiRecipes = dedupeAIRecipes(aiRecipes.filter(applyFilters)).slice(0, 5);
      setAiRecipes(filteredAiRecipes);
    } catch (error) {
      console.error('Error generating AI recipes:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate recipe suggestions. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAiRecipes();
  }, [filters.cuisine, filters.diet, filters.maxReadyTime]);

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
          />

          {/* Active filters display */}
          {(query || filters.cuisine || filters.diet || filters.maxReadyTime > 0) && (
            <div className="flex flex-wrap gap-2">
              {query && (
                <span className="px-2 py-1 text-sm border border-outline rounded-lg">
                  search: {query}
                </span>
              )}
              {filters.cuisine && (
                <span className="px-2 py-1 text-sm border border-outline rounded-lg">
                  cuisine: {filters.cuisine}
                </span>
              )}
              {filters.diet && (
                <span className="px-2 py-1 text-sm border border-outline rounded-lg">
                  diet: {filters.diet}
                </span>
              )}
              {filters.maxReadyTime > 0 && (
                <span className="px-2 py-1 text-sm border border-outline rounded-lg">
                  time: {filters.maxReadyTime} mins or less
                </span>
              )}
            </div>
          )}

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

          {/* Combined recipes section */}
          <div className="space-y-4">
            <h2 className="text-xl">recipes</h2>
            {isLoading ? (
              <div className="text-center py-4">
                loading...
              </div>
            ) : (recipes.length > 0 || popularRecipes.length > 0 || aiRecipes.length > 0) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Local recipes */}
                {(recipes as LocalRecipe[]).map((recipe: LocalRecipe) => (
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
                    recipeType={'user'}
                  />
                ))}
                {/* Spoonacular recipes */}
                {popularRecipes.map((recipe: Recipe) => (
                  <RecipeCard 
                    key={`spoonacular-${recipe.id}`}
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
                {aiRecipes.map((recipe) => (
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
            )}
          </div>
        </div>
      </main>
    </>
  );
}