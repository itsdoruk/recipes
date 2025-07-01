export interface Recipe {
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
    recipe_type: 'user' | 'spoonacular' | 'ai';
    recipeType?: 'user' | 'spoonacular' | 'ai'; // For backward compatibility
    ingredients: string[];
    instructions: string[];
    nutrition?: {
      calories: string;
      protein: string;
      fat: string;
      carbohydrates: string;
      nutrients?: Array<{
        name: string;
        amount: number;
        unit: string;
      }>;
    };
    is_starred?: boolean;
    username?: string;
    likes_count?: number;
    comments_count?: number;
    is_liked?: boolean;
    readyInMinutes?: number;
    summary?: string;
    cuisines?: string[];
    diets?: string[];
    cooking_time_unit?: string;
    extendedIngredients?: Array<{
      original: string;
    }>;
    spoonacular_id?: string;
    [key: string]: any; // Allow additional properties for flexibility
  }
  
  export interface Ingredient {
    id: string;
    name: string;
    amount: number;
    unit: string;
  }

  export interface User {
    id: string;
    email: string;
    username: string;
    avatarUrl?: string;
    createdAt: Date;
  }
  
  export interface SpoonacularRecipe {
    id: number;
    title: string;
    image: string;
    readyInMinutes: number;
    servings: number;
    instructions: string;
    extendedIngredients: {
      id: number;
      original: string;
      amount: number;
      unit: string;
    }[];
  }

  export interface Profile {
    id: string;
    user_id: string;
    username: string | null;
    email?: string | null;
    avatar_url?: string | null;
    is_admin: boolean;
    banned?: boolean;
    warnings?: number;
    created_at: string;
    ban_expiry?: string | null;
    ban_type?: 'temporary' | 'permanent' | 'warning' | null;
    ban_reason?: string | null;
    last_ban_date?: string | null;
    ban_count?: number;
    followers_count?: number;
    following_count?: number;
    dietary_restrictions?: string[] | null;
    cooking_skill_level?: string | null;
  }

export type RecipeType = 'ai' | 'spoonacular' | 'user';