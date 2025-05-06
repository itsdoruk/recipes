export interface Recipe {
    id: string;
    title: string;
    description: string;
    ingredients: Ingredient[];
    instructions: string[];
    cookingTime: number;
    servings: number;
    imageUrl: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
    calories?: number;
    protein?: number;
    fat?: number;
    carbohydrates?: number;
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