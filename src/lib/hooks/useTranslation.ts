import { useRouter } from 'next/router';
import { en } from '@/lib/translations/en';
import { es } from '@/lib/translations/es';
import { tr } from '@/lib/translations/tr';

type TranslationKey = keyof typeof en;
type TranslationParams = Record<string, string | number>;

const translations = {
  en,
  es,
  tr,
};

export function useTranslation() {
  const router = useRouter();
  const locale = (router.locale || 'en') as keyof typeof translations;
  const t = (key: string, params?: TranslationParams) => {
    const keys = key.split('.');
    let value: any = translations[locale];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key;
      }
    }

    if (typeof value === 'string') {
      if (params) {
        return Object.entries(params).reduce((str, [key, val]) => {
          return str.replace(new RegExp(`{{${key}}}`, 'g'), String(val));
        }, value);
      }
      return value;
    }
    
    return key;
  };

  return { t, locale };
} 