import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '@supabase/auth-helpers-react';
import { getSupabaseClient } from '@/lib/supabase';
import Avatar from './Avatar';
import dynamic from 'next/dynamic';
import ReportModal from './ReportModal';
import ShareDialog from './ShareDialog';
import { formatDistanceToNow } from 'date-fns';
import StarButton from './StarButton';
import ShareButton from './ShareButton';

interface Profile {
  username: string | null;
  avatar_url: string | null;
}

interface RecipeCardProps {
  id: string | undefined;
  title: string;
  description: string;
  image_url: string | null;
  user_id: string;
  created_at: string;
  cuisine_type?: string | null;
  cooking_time?: string | null;
  diet_type?: string | null;
  readyInMinutes?: number;
  link?: string;
  loading?: boolean;
  recipeType?: 'user' | 'spoonacular' | 'ai';
  funDescription?: string;
  hideLoadingAnimation?: boolean;
}

function RecipeCardContent({
  id,
  title,
  description,
  image_url,
  user_id,
  created_at,
  cuisine_type,
  cooking_time,
  diet_type,
  readyInMinutes,
  link,
  loading = false,
  recipeType = 'user',
  funDescription,
  hideLoadingAnimation = false,
}: RecipeCardProps) {
  const router = useRouter();
  const user = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  console.log('Rendering RecipeCard:', { id, title, recipeType });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Check for special user IDs that aren't UUIDs
        if (user_id === 'spoonacular') {
          setProfile({ username: 'internet recipe', avatar_url: null });
          return;
        }
        
        if (user_id === 'ai') {
          setProfile({ username: 'ai recipe', avatar_url: null });
          return;
        }
        
        // Only try to fetch from the database for regular user IDs
        const { data, error } = await getSupabaseClient()
          .from('profiles')
          .select('username, avatar_url')
          .eq('user_id', user_id)
          .single();

        if (error) throw error;
        setProfile(data);
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('failed to load user profile');
      }
    };
    fetchProfile();
  }, [user_id]);

  const getRecipeUrl = () => {
    // For Spoonacular recipes, use the original ID format
    if (recipeType === 'spoonacular') {
      return `/recipe/${id}`;
    }
    
    // For other recipes, use the standard format
    return `/recipe/${id}`;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (loading || !id) return;
    router.push(`/recipe/${id}`);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (user) {
      // Open the share dialog if user is logged in
      setIsShareDialogOpen(true);
    } else {
      // Fall back to regular share if not logged in
      const url = typeof window !== 'undefined' ? `${window.location.origin}${getRecipeUrl()}` : getRecipeUrl();
      try {
        if (navigator.share) {
          await navigator.share({ url });
        } else {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      } catch (err) {
        setError('Failed to copy link');
      }
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!id) return;
    router.push(`/edit-recipe/${id}`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!id) return;
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    setIsDeleting(true);
    try {
      const { error } = await getSupabaseClient()
        .from('recipes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      router.push('/');
    } catch (err) {
      console.error('Error deleting recipe:', err);
      setError('Failed to delete recipe');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReport = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsReportModalOpen(true);
  };

  const handleCloseReportModal = () => {
    setIsReportModalOpen(false);
  };

  const handleCloseShareDialog = () => {
    setIsShareDialogOpen(false);
  };

  // Format description to handle markdown
  const formatDescription = (text: string) => {
    if (!text) return '';
    // Limit to 150 characters
    const truncated = text.length > 150 ? text.substring(0, 147) + '...' : text;
    return truncated;
  };

  const formatTime = (minutes?: number) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  // Helper to format cooking time pill
  const formatCookingTimePill = (cooking_time?: string | null) => {
    if (!cooking_time) return null;
    // If it's just a number, add 'mins'
    if (/^\d+$/.test(cooking_time.trim())) {
      return `${cooking_time.trim()} mins`;
    }
    // If it already contains 'min', 'mins', or 'hour', return as is
    if (/min|hour|h/i.test(cooking_time)) {
      return cooking_time;
    }
    return `${cooking_time} mins`;
  };

  // Ensure recipeId is always a string and handle undefined values
  const recipeId = id?.toString() || '';
  const hasValidId = Boolean(recipeId);
  const linkPath = hasValidId ? (link || `/recipe/${recipeId}`) : '/';
  const cardClass = loading && !hideLoadingAnimation
    ? "animate-pulse cursor-wait"
    : "cursor-pointer hover:opacity-90 transition-opacity";

  const cardContent = (
    <div className="h-[400px] flex flex-col rounded-xl overflow-hidden border border-outline shadow-md hover:shadow-lg transition-shadow" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {image_url ? (
        <div className="relative w-full h-48 flex-shrink-0">
          <Image
            src={image_url}
            alt={title}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className="w-full h-48 flex-shrink-0" style={{ background: "var(--background)" }} />
      )}
      <div className="flex-1 flex flex-col p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-medium line-clamp-1" style={{ color: "var(--foreground)" }}>{title}</h2>
        </div>
        {funDescription && (
          <p className="text-sm-600 dark:text-gray-400 mb-2 line-clamp-1">
            {funDescription}
          </p>
        )}
        <p className="text-sm mb-4 line-clamp-2" style={{ color: "var(--foreground)" }}>
          {formatDescription(description)}
        </p>
        <div className="mt-auto">
          <div className="flex flex-wrap gap-2 mb-2">
            {cuisine_type && cuisine_type !== 'unknown' && (
              <span className="text-xs px-2 py-1 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-800 text-white">
                {cuisine_type}
              </span>
            )}
            {diet_type && diet_type !== 'unknown' && diet_type.split(',').map((diet, index) => (
              <span key={`${recipeId}-diet-${index}`} className="text-xs px-2 py-1 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-800 text-white">
                {diet.trim()}
              </span>
            ))}
            {(cooking_time || readyInMinutes) && (
              <span className="text-xs px-2 py-1 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-800 text-white">
                {formatCookingTimePill(cooking_time) || formatTime(readyInMinutes)}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center">
              {recipeType === 'ai' || user_id === '00000000-0000-0000-0000-000000000000' ? (
                <>
                  <Avatar avatar_url={undefined} username="AI Recipe" size={24} className="mr-2" />
                  <span className="text-xs line-clamp-1">AI Recipe</span>
                </>
              ) : (
                <>
                  <Avatar 
                    avatar_url={profile?.avatar_url} 
                    username={profile?.username} 
                    size={24} 
                    className="mr-2"
                  />
                  <span className="text-xs line-clamp-1">
                    {profile?.username || 'anonymous'}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              <StarButton recipeId={recipeId} recipeType={recipeType} />
              <ShareButton
                recipeId={recipeId}
                recipeTitle={title}
                recipeType={recipeType}
                className="p-1 flex items-center justify-center hover:opacity-80 transition-opacity"
                iconOnly={true}
              />
              {recipeType === 'user' && user && hasValidId && (
                <button 
                  onClick={handleReport} 
                  className="p-1 flex items-center justify-center hover:opacity-80 transition-opacity"
                  aria-label="Report recipe"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-5 h-5 text-red-500"
                  >
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="15" x2="4" y2="21" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Link href={linkPath} className={cardClass}>
        {cardContent}
      </Link>

      {recipeType !== 'spoonacular' && isReportModalOpen && hasValidId && (
        <ReportModal
          isOpen={isReportModalOpen}
          onRequestClose={handleCloseReportModal}
          reportedRecipeId={recipeId}
          recipeType={recipeType}
        />
      )}
      
      {isShareDialogOpen && hasValidId && (
        <ShareDialog
          isOpen={isShareDialogOpen}
          onRequestClose={handleCloseShareDialog}
          recipeId={recipeId}
          recipeTitle={title}
          recipeType={recipeType}
        />
      )}
    </>
  );
}

// Main component that uses React.memo to prevent unnecessary re-renders
const RecipeCard = React.memo(RecipeCardContent);
export default RecipeCard;