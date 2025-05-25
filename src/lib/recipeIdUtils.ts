import { v4 as uuidv4 } from 'uuid';

export type RecipeSource = 'user' | 'spoonacular' | 'ai';

export interface RecipeIdInfo {
  id: string;
  source: RecipeSource;
  originalId?: string;
}

/**
 * Generates a new recipe ID based on the source
 */
export function generateRecipeId(source: RecipeSource, originalId?: string): string {
  // Always generate a new UUID
  return uuidv4();
}

/**
 * Parses a recipe ID to get its components
 */
export function parseRecipeId(id: string): { source: RecipeSource; id: string } {
  // All IDs are now UUIDs, so we need to check the source in the database
  return {
    source: 'user', // Default to user, will be updated by the API
    id: id
  };
}

/**
 * Validates if a string is a valid recipe ID
 */
export function isValidRecipeId(id: string): boolean {
  // Check if the ID is a valid UUID (any version)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Converts an old format ID to the new UUID format
 */
export function convertToUuidFormat(oldId: string): string {
  // Always generate a new UUID
  return uuidv4();
} 