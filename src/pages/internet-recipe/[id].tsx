import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import StarButton from '@/components/StarButton';
import { RANDOM_CARD_IMG } from '@/lib/constants';

function splitInstructions(instructions: string): string[] {
  return instructions
    .split(/\.|;|\n/)
    .map(step => step.trim())
    .filter(Boolean);
}

export default function InternetRecipePage() {
  const router = useRouter();
  const { id } = router.query;
  const [recipe, setRecipe] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    if (typeof window !== 'undefined' && typeof id === 'string') {
      const local = localStorage.getItem(id);
      if (local) {
        setRecipe(JSON.parse(local));
      } else {
        setError('Could not find this AI-improvised recipe.');
      }
      setIsLoading(false);
    }
  }, [id]);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="block p-4 border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900 transition-opacity">
          <div className="relative w-full h-48 mb-4">
            <Image src={RANDOM_CARD_IMG} alt="random recipe" fill className="object-cover rounded" />
          </div>
          <h3 className="text-lg mb-2">discovering a random internet recipe...</h3>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            please wait while ai improvises a surprise recipe for you!
          </div>
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-red-500">{error || 'Recipe not found'}</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{recipe.title} | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {recipe.image_url && (
            <div className="relative w-full h-96">
              <Image
                src={recipe.image_url}
                alt={recipe.title}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div>
            <div className="flex items-center justify-between">
              <h1 className="text-3xl">{recipe.title}</h1>
              <StarButton recipeId={recipe.id} recipeType="ai" />
            </div>
            <span className="text-gray-500 dark:text-gray-400 block mt-2">
              {recipe.created_at ? new Date(recipe.created_at).toLocaleDateString() : ''}
            </span>
          </div>
          <div>
            <h2 className="text-xl mb-4">description</h2>
            <div className="text-blue-600 dark:text-blue-400 mb-2">{recipe.funDescription}</div>
            <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: recipe.description }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Cuisine */}
            <div>
              <h3 className="text-sm text-gray-500 dark:text-gray-400">cuisine</h3>
              <p className="">{recipe.cuisine_type || 'N/A'}</p>
            </div>
            {/* Cooking Time */}
            <div>
              <h3 className="text-sm text-gray-500 dark:text-gray-400">cooking time</h3>
              <p className="">{recipe.cooking_time || 'N/A'}</p>
            </div>
            {/* Diet */}
            <div>
              <h3 className="text-sm text-gray-500 dark:text-gray-400">diet</h3>
              <p className="">{recipe.diet_type || 'N/A'}</p>
            </div>
          </div>
          {/* Nutrition Section */}
          <div>
            <h2 className="text-xl mb-4 mt-8">nutrition</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['Calories', 'Protein', 'Fat', 'Carbohydrates'].map((nutrient) => {
                let value = 'N/A';
                if (recipe.nutrition && Array.isArray(recipe.nutrition.nutrients)) {
                  const n = recipe.nutrition.nutrients.find((x: any) => x.name === nutrient);
                  if (n) value = `${n.amount} ${n.unit}`;
                } else if (recipe[nutrient.toLowerCase()]) {
                  value = recipe[nutrient.toLowerCase()];
                }
                return (
                  <div key={nutrient} className="text-center">
                    <div className="text-lg font-bold">{value}</div>
                    <div className="text-gray-500 dark:text-gray-400 text-sm">{nutrient.toLowerCase()}</div>
                  </div>
                );
              })}
            </div>
          </div>
          {recipe.ingredients && (
            <div>
              <h2 className="text-xl mb-4">ingredients</h2>
              <ul className="list-disc list-inside space-y-2">
                {Array.isArray(recipe.ingredients)
                  ? recipe.ingredients.map((ingredient: string, index: number) => (
                      <li key={index} className="">
                        {ingredient}
                      </li>
                    ))
                  : null}
              </ul>
            </div>
          )}
          {recipe.instructions && (
            <div>
              <h2 className="text-xl mb-4">instructions</h2>
              {Array.isArray(recipe.instructions) ? (
                <ol className="list-decimal list-inside space-y-4">
                  {recipe.instructions.map((instruction: string, index: number) => (
                    <li key={index} className="">
                      {instruction}
                    </li>
                  ))}
                </ol>
              ) : (
                <ol className="list-decimal list-inside space-y-4">
                  {splitInstructions(recipe.instructions).map((step, idx) => (
                    <li key={idx} className="">{step}</li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}