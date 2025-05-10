import { useState } from 'react';
import { useRouter } from 'next/router';

export default function AIRecipe() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      // Implement save logic here
      router.push('/');
    } catch (error) {
      console.error('Error saving recipe:', error);
      setError('failed to save recipe');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 rounded-2xl">
      <div className="space-y-4">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50 rounded-lg"
        >
          {isLoading ? 'Generating...' : 'Generate Recipe'}
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50 rounded-lg"
        >
          {isSaving ? 'Saving...' : 'Save Recipe'}
        </button>
      </div>
    </main>
  );
} 