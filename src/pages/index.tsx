import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getPopularRecipes } from '@/lib/spoonacular';
import RecipeCard from '@/components/RecipeCard';
import { marked } from 'marked';
import { GetServerSideProps } from 'next';

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

const PIZZA_IMG = 'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fwp.scoopwhoop.com%2Fwp-content%2Fuploads%2F2019%2F08%2F5d638187e2a04c57823e8c95_a299d096-af8e-452b-9b7b-3e78ac7ea7b6.jpg&f=1&nofb=1&ipt=d7d3b877a8815443046fe8942df8ed873c4e24f0bf1e00b24696f69816de2ff7';
const PIZZA_AUDIO = '/pizza-time-theme.mp3';
const RANDOM_CARD_IMG = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80'; // A fun food image

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

function mapToAllowedCuisine(cuisine: string) {
  if (!cuisine) return '';
  cuisine = cuisine.toLowerCase();
  return CUISINE_TYPES.find(type => cuisine.includes(type)) || '';
}

function mapToAllowedDiet(diet: string) {
  if (!diet) return '';
  diet = diet.toLowerCase();
  return DIET_TYPES.find(type => diet.includes(type)) || '';
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
    nutrition: {} as Record<string, string>,
    cuisine_type: '',
    diet_type: '',
    cooking_time: '',
    cooking_time_value: undefined as number | undefined
  };

  // If no lines, return empty result
  if (lines.length === 0) return result;

  // First line is always the description/title
  result.description = lines[0];

  // Look for meta information in the second line
  if (lines.length > 1) {
    const metaLine = lines[1].toLowerCase();
    
    // Extract cuisine using the same approach as diet
    result.cuisine_type = mapToAllowedCuisine(metaLine);
    
    // Extract diet using the existing function
    result.diet_type = mapToAllowedDiet(metaLine);

    // Extract cooking time
    const timeMatch = metaLine.match(/(\d+)\s*(?:min|minute)s?/i);
    if (timeMatch) {
      const minutes = parseInt(timeMatch[1], 10);
      if (minutes > 0) {
        result.cooking_time_value = mapToAllowedTime(minutes);
        result.cooking_time = `${result.cooking_time_value} mins`;
      }
    }

    // Extract nutrition using a similar approach
    const nutritionMatch = metaLine.match(/(\d+)\s*calories?[^\d]*(\d+)g?\s*protein[^\d]*(\d+)g?\s*fat[^\d]*(\d+)g?\s*carbohydrates?/i);
    if (nutritionMatch) {
      result.nutrition = {
        calories: nutritionMatch[1],
        protein: nutritionMatch[2],
        fat: nutritionMatch[3],
        carbohydrates: nutritionMatch[4]
      };
    }
  }

  // Process remaining lines
  let inIngredients = false;
  let inInstructions = false;
  let foundFirstInstruction = false;

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (!line) continue;

    // Check for section headers
    if (/^ingredients?:/i.test(line)) {
      inIngredients = true;
      inInstructions = false;
      continue;
    }
    if (/^instructions?:/i.test(line)) {
      inInstructions = true;
      inIngredients = false;
      continue;
    }

    // Add to appropriate section
    if (inIngredients) {
      result.ingredients.push(line);
    } else if (inInstructions) {
      result.instructions.push(line);
    } else {
      // If no section header found yet, look for the first instruction-like line
      if (!foundFirstInstruction && /^(preheat|heat|mix|stir|whisk|bake|cook|add|place|fill|serve)/i.test(line)) {
        foundFirstInstruction = true;
        inInstructions = true;
        result.instructions.push(line);
      } else if (foundFirstInstruction) {
        result.instructions.push(line);
      } else {
        // Only add to ingredients if it looks like an ingredient (has measurements or common ingredient words)
        if (/^\d+\s*(g|ml|oz|cup|tbsp|tsp|piece|slice|whole|pinch|dash|to taste|sheet|can|package|bottle|stick|clove|egg|apple|onion|potato|carrot|tomato|pepper|flour|sugar|butter|oil|water|milk|cream|cheese|salt|yeast|baking|powder|soda|vinegar|wine|jelly|cr\u00e8me|cardamom|cinnamon|star anise|clove|allspice|vanilla|puff pastry|apple|egg|jam|honey|lemon|lime|orange|banana|berry|bean|nut|seed|rice|pasta|noodle|meat|fish|chicken|beef|pork|lamb|turkey|duck|shrimp|crab|lobster|mushroom|corn|pea|broccoli|cauliflower|spinach|lettuce|cabbage|zucchini|squash|pumpkin|celery|radish|turnip|parsnip|beet|chard|kale|arugula|rocket|herb|spice|parsley|cilantro|basil|oregano|thyme|rosemary|sage|dill|mint|chive|bay leaf|marjoram|tarragon|fennel|anise|caraway|coriander|cumin|mustard|paprika|turmeric|saffron|ginger|garlic|shallot|scallion|leek|chili|peppercorn|sesame|sunflower|pumpkin seed|walnut|almond|hazelnut|pecan|cashew|macadamia|pistachio|pine nut|coconut|date|fig|raisin|apricot|plum|prune|currant|goji|mulberry|cranberry|blueberry|strawberry|raspberry|blackberry|boysenberry|elderberry|gooseberry|huckleberry|loganberry|marionberry|salmonberry|serviceberry|cloudberry|lingonberry|rowanberry|sea buckthorn|sloe|aronia|barberry|buffaloberry|capulin|chokeberry|chokecherry|clouberry|crowberry|dewberry|hackberry|honeyberry|jostaberry|juneberry|mayberry|olallieberry|thimbleberry|wineberry|yumberry|ziziphus|other)\b/i.test(line)) {
          result.ingredients.push(line);
        }
      }
    }
  }

  return result;
}

// Test the recipe extraction
const testRecipe = `chocolate souffle

french, dessert, vegetarian cooking time: 25 minutes nutrition: 320 calories, 12g protein, 24g fat, 20g carbohydrates

    150ml single cream
    2 tbsp caster sugar
    100g dark chocolate
    20g butter
    2 egg yolks
    2 egg whites
    150ml double cream
    icing sugar

    preheat oven to 220c. place a baking tray on the top shelf.
    heat cream and sugar until boiling, then remove from heat. stir in chocolate and butter until melted.
    brush 6 ramekins with melted butter and sprinkle with caster sugar.
    melt chocolate and cream in a bowl over simmering water, cool, then mix in egg yolks.
    whisk egg whites until they hold their shape, then add sugar and whisk until consistent.
    mix a spoonful of egg whites into the chocolate, then gently fold in the rest.
    fill ramekins, wipe rims clean, and run thumb around edges.
    bake at 200c for 8-10 minutes until risen with a slight wobble.
    dust with icing sugar, scoop a hole from the top, and pour in hot chocolate sauce.
    serve straight away.`;

const testResult = extractRecipePropertiesFromMarkdown(testRecipe);
console.log('Test Result:', JSON.stringify(testResult, null, 2));

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
  };

  const handleFilterChange = (key: keyof SearchFilters, value: string | number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
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
          const improvisePrompt = `Rewrite this recipe in the [recipes] app style (markdown, lowercase, concise, fun, and with clear steps).\n\nInclude and guess the following fields in this order: title, cuisine, diet, cooking time, nutrition (calories, protein, fat, carbohydrates), ingredients (as a list), and instructions (as a numbered list).\n\nTitle: ${meal.strMeal}\nCategory: ${meal.strCategory}\nArea: ${meal.strArea}\nInstructions: ${meal.strInstructions}\nIngredients: ${Object.keys(meal).filter(k => k.startsWith('strIngredient') && meal[k]).map(k => meal[k]).join(', ')}`;
          const aiRes = await fetch('https://ai.hackclub.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: 'Rewrite recipes in markdown, lowercase, concise, fun, and in the [recipes] app style.' },
                { role: 'user', content: improvisePrompt }
              ]
            })
          });
          const aiData = await aiRes.json();
          let improvised = marked(aiData.choices[0].message.content);
          if (improvised instanceof Promise) {
            improvised = await improvised;
          }
          // Extract properties from AI markdown
          const { ingredients, instructions, nutrition, cuisine_type, diet_type, cooking_time, cooking_time_value } = extractRecipePropertiesFromMarkdown(aiData.choices[0].message.content);
          const mappedCuisine = mapToAllowedCuisine(cuisine_type);
          const mappedDiet = mapToAllowedDiet(diet_type);
          const mappedTime = mapToAllowedTime(cooking_time_value);
          const randomRecipeObj = {
            id: `random-internet-${meal.idMeal}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            title: meal.strMeal,
            description: improvised,
            image_url: meal.strMealThumb || RANDOM_CARD_IMG,
            user_id: 'internet',
            created_at: new Date().toISOString(),
            ingredients,
            instructions,
            nutrition,
            cuisine_type: mappedCuisine,
            diet_type: mappedDiet,
            cooking_time: mappedTime ? `${mappedTime} mins` : '',
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

  return (
    <>
      <Head>
        <title>[recipes]</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="font-mono text-2xl">[recipes]</h1>
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="search recipes..."
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono disabled:opacity-50"
              >
                {isLoading ? "searching..." : "search"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={filters.diet}
                onChange={(e) => handleFilterChange("diet", e.target.value)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
              >
                <option value="">any diet</option>
                <option value="vegetarian">vegetarian</option>
                <option value="vegan">vegan</option>
                <option value="gluten-free">gluten-free</option>
                <option value="ketogenic">ketogenic</option>
                <option value="paleo">paleo</option>
              </select>

              <select
                value={filters.cuisine}
                onChange={(e) => handleFilterChange("cuisine", e.target.value)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
              >
                <option value="">any cuisine</option>
                <option value="italian">italian</option>
                <option value="mexican">mexican</option>
                <option value="asian">asian</option>
                <option value="american">american</option>
                <option value="mediterranean">mediterranean</option>
              </select>

              <select
                value={filters.maxReadyTime}
                onChange={(e) => handleFilterChange("maxReadyTime", Number(e.target.value))}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
              >
                <option value="0">any time</option>
                <option value="15">15 mins or less</option>
                <option value="30">30 mins or less</option>
                <option value="45">45 mins or less</option>
                <option value="60">1 hour or less</option>
              </select>
            </div>
          </form>

          {error && (
            <p className="font-mono text-red-500">{error}</p>
          )}

          {/* Main Recipe Grid: 5 AI recipes first, then popular/community recipes */}
          <div className="space-y-4">
            <h2 className="font-mono text-xl">recipes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aiLoading
                ? Array.from({ length: 5 }).map((_, idx) => (
                    <RecipeCard
                      key={`ai-loading-${idx}`}
                      id={`ai-loading-${idx}`}
                      title="Loading..."
                      description="Generating a new AI recipe..."
                      image_url={RANDOM_CARD_IMG}
                      user_id="internet"
                      created_at={new Date().toISOString()}
                      cuisine_type={''}
                      cooking_time={''}
                      diet_type={''}
                      readyInMinutes={undefined}
                      link={undefined}
                    />
                  ))
                : aiRecipes.map((recipe) => (
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
                      readyInMinutes={undefined}
                      link={`/internet-recipe/${recipe.id}`}
                    />
                  ))}
              {/* Show popular recipes first */}
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
              {/* Then show user recipes */}
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
            {/* Loading indicator */}
            <div ref={loadingRef} className="h-10 flex items-center justify-center">
              {isLoading && <p className="font-mono">loading more recipes...</p>}
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

    if (supabaseError) throw supabaseError;

    // Transform Supabase recipes to match LocalRecipe interface
    const transformedRecipes = supabaseRecipes.map(recipe => ({
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      image_url: recipe.image_url,
      user_id: recipe.user_id,
      created_at: recipe.created_at,
      cuisine_type: recipe.cuisine_type,
      cooking_time: recipe.cooking_time_value ? `${recipe.cooking_time_value} ${recipe.cooking_time_unit}` : null,
      diet_type: recipe.diet_type,
    }));

    return {
      props: {
        initialRecipes: transformedRecipes,
      },
    };
  } catch (error) {
    console.error('Error fetching initial recipes:', error);
    return {
      props: {
        initialRecipes: [],
      },
    };
  }
};