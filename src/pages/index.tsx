import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getPopularRecipes } from '@/lib/spoonacular';
import RecipeCard from '@/components/RecipeCard';
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

export default function Home({ initialRecipes }: HomeProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [recipes, setRecipes] = useState<LocalRecipe[]>(initialRecipes);
  const [popularRecipes, setPopularRecipes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    diet: "",
    cuisine: "",
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
        // Build the query for local recipes
        let supabaseQuery = supabase
          .from('recipes')
          .select('*')
          .order('created_at', { ascending: false })
          .range((page - 1) * 10, page * 10 - 1);

        // Add search term filter if provided
        if (query) {
          supabaseQuery = supabaseQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
        }

        // Add cuisine type filter if provided
        if (filters.cuisine) {
          supabaseQuery = supabaseQuery.eq('cuisine_type', filters.cuisine);
        }

        // Add diet type filter if provided
        if (filters.diet) {
          supabaseQuery = supabaseQuery.eq('diet_type', filters.diet);
        }

        // Add cooking time filter if provided
        if (filters.maxReadyTime) {
          supabaseQuery = supabaseQuery.eq('cooking_time_value', filters.maxReadyTime);
        }

        // Execute the query
        const { data: localRecipes, error: localError } = await supabaseQuery;

        if (localError) throw localError;

        // Transform local recipes to match LocalRecipe interface
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

        setRecipes(prev => [...prev, ...transformedLocalRecipes]);
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

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPage(1);
    setRecipes([]);
    setHasMore(true);
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
                value={query}
                onChange={(e) => setQuery(e.target.value)}
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

          {/* All Recipes Section */}
          <div className="space-y-4">
            <h2 className="font-mono text-xl">recipes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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