import { v4 as uuidv4 } from 'uuid';

// Helper function to extract minutes from cooking time string
function extractCookingTimeMinutes(cookingTime: string): number | null {
  if (!cookingTime) return null;
  const hourMatch = cookingTime.match(/(\d+(?:\.\d+)?)\s*hours?/i);
  const minuteMatch = cookingTime.match(/(\d+)\s*mins?/i);
  if (hourMatch) return Math.round(parseFloat(hourMatch[1]) * 60);
  if (minuteMatch) return parseInt(minuteMatch[1], 10);
  return null;
}

const VALID_DIET_TYPES = [
  'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'paleo', 'omnivore', 'pescatarian', 'none'
];

export async function generateAIRecipe(prompt: string) {
  // Call Hack Club AI API to generate recipe details
  const aiRes = await fetch('https://ai.hackclub.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful recipe assistant that generates detailed recipes in JSON format.' },
        { role: 'user', content: `Generate a recipe based on the following prompt.\n\nIMPORTANT: Your response must be a valid JSON object with these exact keys:\n- title (string): The name of the recipe\n- description (string): A brief description\n- ingredients (array of strings): List of ingredients\n- instructions (array of strings): Step-by-step instructions\n- cuisine_type (string): One of: italian, mexican, chinese, indian, japanese, thai, american, mediterranean, french, etc.\n- diet_type (string): MUST be one of: vegetarian, vegan, gluten-free, dairy-free, keto, paleo, omnivore, pescatarian, none\n- cooking_time (string): Format as "X mins" or "X hours" or "X hours Y mins"\n- nutrition (object): Must include keys 'calories', 'protein', 'fat', 'carbohydrates' (all as numbers, estimated if necessary)\n\nPrompt: ${prompt}\n\nRespond ONLY with the JSON object, no other text.` }
      ]
    })
  });

  if (!aiRes.ok) {
    throw new Error('Failed to generate recipe from AI');
  }

  const aiData = await aiRes.json();
  const aiResponse = aiData.choices?.[0]?.message?.content?.trim();
  if (!aiResponse) {
    throw new Error('Empty response from AI');
  }

  // Parse the AI response as JSON
  let recipeData;
  try {
    let jsonString = aiResponse.trim();
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    recipeData = JSON.parse(jsonString);
  } catch (e) {
    throw new Error('Invalid JSON response from AI: ' + aiResponse);
  }

  // Ensure required fields are present
  const { title, description, ingredients, instructions, cuisine_type, diet_type, cooking_time, nutrition } = recipeData;
  if (!title || !description || !ingredients || !instructions || !nutrition) {
    throw new Error('Missing required fields in AI response: ' + JSON.stringify(recipeData));
  }
  for (const key of ['calories', 'protein', 'fat', 'carbohydrates']) {
    if (!nutrition[key]) {
      throw new Error(`Missing nutrition field: ${key} in AI response: ${JSON.stringify(recipeData)}`);
    }
  }

  // Validate and normalize diet type
  const normalizedDietType = diet_type?.toLowerCase().trim();
  if (!normalizedDietType || !VALID_DIET_TYPES.includes(normalizedDietType)) {
    throw new Error(`Invalid diet type: ${diet_type}. Must be one of: ${VALID_DIET_TYPES.join(', ')}`);
  }

  // Extract cooking time in minutes
  const cookingTimeMinutes = extractCookingTimeMinutes(cooking_time);
  if (!cookingTimeMinutes) {
    throw new Error(`Invalid cooking time format: ${cooking_time}. Must be in format "X mins" or "X hours" or "X hours Y mins"`);
  }

  // Create a new recipe object with a UUID
  const newRecipe = {
    id: uuidv4(),
    title,
    description,
    ingredients,
    instructions,
    image_url: '/placeholder-recipe.jpg',
    cooking_time,
    cooking_time_value: cookingTimeMinutes,
    cooking_time_unit: 'mins',
    user_id: '00000000-0000-0000-0000-000000000000',
    cuisine_type: cuisine_type?.toLowerCase().trim(),
    diet_type: normalizedDietType,
    recipe_type: 'ai',
    calories: nutrition.calories.toString(),
    protein: nutrition.protein.toString(),
    fat: nutrition.fat.toString(),
    carbohydrates: nutrition.carbohydrates.toString(),
  };

  return newRecipe;
} 