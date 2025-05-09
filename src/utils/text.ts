/**
 * Converts any string or null/undefined value to lowercase
 * @param text - The text to convert to lowercase
 * @returns The lowercase version of the text, or empty string if input is null/undefined
 */
export const toLower = (text: string | null | undefined): string => {
  if (!text) return '';
  return text.toLowerCase();
};

/**
 * Converts an object's string values to lowercase
 * @param obj - The object whose string values should be converted to lowercase
 * @returns A new object with all string values converted to lowercase
 */
export const toLowerObject = <T extends Record<string, any>>(obj: T): T => {
  const result = { ...obj };
  for (const key in result) {
    if (typeof result[key] === 'string') {
      result[key] = result[key].toLowerCase();
    }
  }
  return result;
}; 