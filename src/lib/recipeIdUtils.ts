import { v4 as uuidv4 } from 'uuid';

export type RecipeSource = 'spoonacular' | 'internet' | 'user';

export interface RecipeIdInfo {
  id: string;
  source: RecipeSource;
  originalId?: string;
}

/**
 * Generates a new UUID-based recipe ID
 */
export function generateRecipeId(source: string, id: string): string {
  // For Spoonacular recipes, ensure we don't double-prefix
  if (source === 'spoonacular') {
    return id.startsWith('spoonacular-') ? id : `spoonacular-${id}`;
  }
  
  // For other sources, generate a UUID
  return id;
}

/**
 * Parses a recipe ID to get its components
 */
export function parseRecipeId(id: string): { source: string; id: string } {
  // Check if it's a Spoonacular ID
  if (id.startsWith('spoonacular-')) {
    return {
      source: 'spoonacular',
      id: id.replace('spoonacular-', '')
    };
  }
  
  // For other IDs, assume they're local
  return {
    source: 'local',
    id: id
  };
}

/**
 * Validates if a string is a valid recipe ID
 */
export function isValidRecipeId(id: string): boolean {
  if (id.startsWith('spoonacular-')) {
    return true;
  }
  
  const parts = id.split('-');
  if (parts.length < 2) return false;
  
  const source = parts[0];
  const uuid = parts.slice(1).join('-');
  
  // Check if source is valid
  if (!['spoonacular', 'internet', 'user'].includes(source)) return false;
  
  // Check if the rest is a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Converts an old format ID to the new UUID format
 */
export function convertToUuidFormat(oldId: string): string {
  if (oldId.startsWith('spoonacular-')) {
    return oldId; // Keep Spoonacular IDs as is
  } else if (oldId.startsWith('random-internet-')) {
    return generateRecipeId('internet', oldId.split('-')[2]);
  } else {
    return generateRecipeId('user', oldId);
  }
} 