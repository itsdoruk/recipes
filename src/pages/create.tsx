import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

interface RecipeForm {
  title: string;
  image_url: string;
  readyInMinutes: number;
  servings: number;
  instructions: string;
  ingredients: string[];
}

export default function CreateRecipe() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<RecipeForm>({
    title: "",
    image_url: "",
    readyInMinutes: 30,
    servings: 4,
    instructions: "",
    ingredients: [""]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      // Convert instructions string to array of steps
      const instructionsArray = form.instructions
        .split('\n')
        .filter(step => step.trim().length > 0);

      const { data, error } = await supabase
        .from("recipes")
        .insert([
          {
            title: form.title,
            image_url: form.image_url,
            ingredients: form.ingredients.filter(ing => ing.trim().length > 0),
            instructions: instructionsArray,
            user_id: user.id,
            created_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) throw error;

      router.push("/");
    } catch (err) {
      console.error("Error creating recipe:", err);
      setError("Failed to create recipe");
    } finally {
      setIsLoading(false);
    }
  };

  const handleIngredientChange = (index: number, value: string) => {
    const newIngredients = [...form.ingredients];
    newIngredients[index] = value;
    setForm(prev => ({ ...prev, ingredients: newIngredients }));
  };

  const addIngredient = () => {
    setForm(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, ""]
    }));
  };

  const removeIngredient = (index: number) => {
    setForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="font-mono">Please sign in to create a recipe.</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>create recipe</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="font-mono text-2xl">create recipe</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block font-mono mb-2">title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
                />
              </div>

              <div>
                <label className="block font-mono mb-2">image url</label>
                <input
                  type="url"
                  value={form.image_url}
                  onChange={(e) => setForm(prev => ({ ...prev, image_url: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono mb-2">ready in (minutes)</label>
                  <input
                    type="number"
                    value={form.readyInMinutes}
                    onChange={(e) => setForm(prev => ({ ...prev, readyInMinutes: Number(e.target.value) }))}
                    required
                    min="1"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
                  />
                </div>

                <div>
                  <label className="block font-mono mb-2">servings</label>
                  <input
                    type="number"
                    value={form.servings}
                    onChange={(e) => setForm(prev => ({ ...prev, servings: Number(e.target.value) }))}
                    required
                    min="1"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono mb-2">instructions</label>
                <textarea
                  value={form.instructions}
                  onChange={(e) => setForm(prev => ({ ...prev, instructions: e.target.value }))}
                  required
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
                />
              </div>

              <div>
                <label className="block font-mono mb-2">ingredients</label>
                <div className="space-y-2">
                  {form.ingredients.map((ingredient, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={ingredient}
                        onChange={(e) => handleIngredientChange(index, e.target.value)}
                        required
                        placeholder={`ingredient ${index + 1}`}
                        className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
                      />
                      {form.ingredients.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeIngredient(index)}
                          className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono"
                        >
                          remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addIngredient}
                    className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono"
                  >
                    add ingredient
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <p className="font-mono text-red-500">{error}</p>
            )}

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isLoading}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono disabled:opacity-50"
              >
                {isLoading ? "creating..." : "create recipe"}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono"
              >
                cancel
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}