import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Share2 } from 'lucide-react';
import Modal from 'react-modal';

interface ShareRecipeButtonProps {
  recipeId: string;
}

interface User {
  id: string;
  username: string;
}

export default function ShareRecipeButton({ recipeId }: ShareRecipeButtonProps) {
  const { user } = useAuth();
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);

  const handleShare = async (targetUserId: string) => {
    if (!user) {
      setError('Please log in to share recipes');
      return;
    }

    try {
      await supabase
        .from('shared_recipes')
        .insert({
          recipe_id: recipeId,
          shared_by: user.id,
          shared_with: targetUserId,
        });
      setIsShareDialogOpen(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      setError('Failed to share recipe');
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', `%${query}%`)
        .limit(5);

      if (error) throw error;
      setSearchResults(users || []);
    } catch (err) {
      setError('Failed to search users');
    }
  };

  return (
    <>
      <button
        onClick={() => setIsShareDialogOpen(true)}
        className="flex items-center space-x-1 text-gray-500 hover:text-blue-500 transition-colors"
      >
        <Share2 className="w-5 h-5" />
      </button>

      <Modal
        isOpen={isShareDialogOpen}
        onRequestClose={() => setIsShareDialogOpen(false)}
        className="bg-white rounded-lg p-6 max-w-md mx-auto mt-20"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
      >
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Share Recipe</h2>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded relative" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          <div>
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-2">
            {searchResults.map((user) => (
              <button
                key={user.id}
                onClick={() => handleShare(user.id)}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 rounded-lg transition-colors"
              >
                {user.username}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setIsShareDialogOpen(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
} 