import { useEffect, useState } from 'react';
import Head from 'next/head';

const SETTINGS_KEY = 'app_settings';

const defaultSettings = {
  theme: 'system', // 'system' | 'dark' | 'light'
  aiEnabled: true,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? JSON.parse(saved) : defaultSettings;
    }
    return defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    // Optionally, apply theme immediately
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (settings.theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // system
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [settings]);

  return (
    <>
      <Head>
        <title>app settings | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="font-mono text-2xl mb-8">app settings</h1>
        <div className="space-y-6">
          <div>
            <label className="block font-mono mb-2">theme</label>
            <div className="flex gap-4">
              <button
                className={`px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono ${settings.theme === 'system' ? 'opacity-100' : 'opacity-80'}`}
                onClick={() => setSettings((s: any) => ({ ...s, theme: 'system' }))}
              >
                dynamic dark mode
              </button>
              <button
                className={`px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono ${settings.theme === 'dark' ? 'opacity-100' : 'opacity-80'}`}
                onClick={() => setSettings((s: any) => ({ ...s, theme: 'dark' }))}
              >
                dark mode
              </button>
              <button
                className={`px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono ${settings.theme === 'light' ? 'opacity-100' : 'opacity-80'}`}
                onClick={() => setSettings((s: any) => ({ ...s, theme: 'light' }))}
              >
                light mode
              </button>
            </div>
          </div>
          <div>
            <label className="block font-mono mb-2">AI recipes</label>
            <div className="flex gap-4">
              <button
                className={`px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono ${settings.aiEnabled ? 'opacity-100' : 'opacity-80'}`}
                onClick={() => setSettings((s: any) => ({ ...s, aiEnabled: true }))}
              >
                enabled
              </button>
              <button
                className={`px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono ${!settings.aiEnabled ? 'opacity-100' : 'opacity-80'}`}
                onClick={() => setSettings((s: any) => ({ ...s, aiEnabled: false }))}
              >
                disabled
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
} 