import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import Head from 'next/head';
import { useTheme } from 'next-themes';

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // After mounting, we have access to the theme
  useEffect(() => setMounted(true), []);

  if (!user) {
    return <div className="max-w-2xl mx-auto px-4 py-8">please sign in to view settings</div>;
  }

  if (!mounted) {
    return <div className="max-w-2xl mx-auto px-4 py-8">loading...</div>;
  }

  return (
    <>
      <Head>
        <title>app settings | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <h1 className="text-2xl mb-8">app settings</h1>
        <div className="space-y-6">
          <div>
            <h2 className="text-xl mb-4">appearance</h2>
            <div className="space-y-4">
              <div>
                <label className="block mb-2">theme</label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent"
                >
                  <option value="system">system</option>
                  <option value="light">light</option>
                  <option value="dark">dark</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl mb-4">notifications</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label>email notifications</label>
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div className="flex items-center justify-between">
                <label>push notifications</label>
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl mb-4">privacy</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label>public profile</label>
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div className="flex items-center justify-between">
                <label>show email</label>
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
} 