import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth';

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <p className="text-gray-500 dark:text-gray-400">please sign in to access settings</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">appearance</h1>
      
      <div className="space-y-6">
        <div>
          <label htmlFor="theme" className="block text-sm font-medium mb-2">
            theme
          </label>
          <select
            id="theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full h-10 px-3 border border-gray-200 dark:border-gray-800 bg-transparent hover:opacity-80 transition-opacity"
          >
            <option value="system">system</option>
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
        </div>
      </div>
    </div>
  );
} 