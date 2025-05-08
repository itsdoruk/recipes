import { en } from './en';
import { tr } from './tr';
import { es } from './es';

export type Language = 'en' | 'tr' | 'es';

export type TranslationKey = keyof typeof en;

export const translations = {
  en,
  tr,
  es
} as const;

export const getTranslation = (key: TranslationKey, language: Language): string => {
  const value = translations[language][key];
  if (typeof value === 'string') {
    return value;
  }
  return key;
}; 