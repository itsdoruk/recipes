const API_KEY = process.env.NEXT_PUBLIC_SPOONACULAR_API_KEY;
const BASE_URL = 'https://api.spoonacular.com/recipes';

export interface Recipe {
  id: number;
  title: string;
  image: string;
  readyInMinutes?: number;
  description?: string;
}

export async function searchRecipes(query: string): Promise<Recipe[]> {
  if (!API_KEY) {
    throw new Error('Please add your Spoonacular API key to .env.local');
  }

  const response = await fetch(
    `${BASE_URL}/complexSearch?query=${query}&apiKey=${API_KEY}&number=10`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch recipes');
  }

  const data = await response.json();
  return data.results;
}

export async function getRecipeById(id: number): Promise<Recipe> {
  if (!API_KEY) {
    throw new Error('Please add your Spoonacular API key to .env.local');
  }

  const response = await fetch(
    `${BASE_URL}/${id}/information?apiKey=${API_KEY}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch recipe details');
  }

  return response.json();
}

// Example usage:
// const recipes = await searchRecipes('pasta');
// const recipeDetails = await getRecipeById(716429);