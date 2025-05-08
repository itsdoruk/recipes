import { useTheme } from 'next-themes';
import { useRouter } from 'next/router';
import { useTranslation } from '@/lib/hooks/useTranslation';
import { useAuth } from '@/lib/auth';

export function Settings() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();

  const handleLanguageChange = (locale: string) => {
    router.push(router.pathname, router.asPath, { locale });
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">{t('settings.pleaseLogin')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium mb-4">{t('settings.appearance')}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t('settings.theme')}</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full h-10 px-3 border border-gray-200 dark:border-gray-800 bg-transparent hover:opacity-80 transition-opacity"
            >
              <option value="system">{t('settings.system')}</option>
              <option value="light">{t('settings.light')}</option>
              <option value="dark">{t('settings.dark')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">{t('settings.selectLanguage')}</label>
            <select
              value={router.locale}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-full h-10 px-3 border border-gray-200 dark:border-gray-800 bg-transparent hover:opacity-80 transition-opacity"
            >
              <option value="en">{t('settings.english')}</option>
              <option value="tr">{t('settings.turkish')}</option>
              <option value="es">{t('settings.spanish')}</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
} 