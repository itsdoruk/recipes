import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '@supabase/auth-helpers-react';
import { getSupabaseClient } from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import dynamic from 'next/dynamic';
import ReportModal from './ReportModal';
import ShareDialog from './ShareDialog';
import { formatDistanceToNow } from 'date-fns';
import StarButton from './StarButton';
import ShareButton from './ShareButton';
import { fetchProfileById } from '@/lib/api/profile';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import ReportButton from './ReportButton';
import { Recipe } from '@/types';
import type { RecipeType } from '@/types';
import RecipeCardSkeleton from './RecipeCardSkeleton';

interface Profile {
  username: string | null;
  avatar_url: string | null;
}

interface RecipeCardProps extends Partial<Recipe> {
  loading?: boolean;
  hideLoadingAnimation?: boolean;
  onLike?: () => void;
  onComment?: () => void;
  recipeType?: RecipeType;
}

function RecipeCardContent({
  id = '',
  title = '',
  description = '',
  image_url = null,
  user_id = '',
  username: initialUsername,
  created_at = '',
  cuisine_type = null,
  cooking_time = null,
  diet_type = null,
  readyInMinutes,
  link,
  loading = false,
  recipeType = 'user',
  funDescription,
  hideLoadingAnimation = false,
  likes_count = 0,
  comments_count = 0,
  is_liked = false,
  onLike,
  onComment,
}: RecipeCardProps) {
  const router = useRouter();
  const user = useUser();
  const [profile, setProfile] = useState<{ username: string | null; avatar_url: string | null } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  console.log('Rendering RecipeCard:', { id, title, recipeType });

  // Ensure recipeId is always a string and handle undefined values
  const hasValidId = Boolean(id);
  const linkPath = hasValidId ? (link || `/recipe/${id}`) : '/';

  const recipeTitle = title || '';
  const recipeDescription = description || '';
  const recipeImageUrl = image_url || null;
  const recipeUserId = user_id || '';
  const recipeCreatedAt = created_at || '';

  async function fetchSimpleProfile(userId: string) {
    const { data, error } = await getBrowserClient()
      .from('profiles')
      .select('username, avatar_url')
      .eq('user_id', userId)
      .single();
    if (error) {
      console.error('Error fetching simple profile:', error);
      return { username: null, avatar_url: null };
    }
    return data;
  }

  useEffect(() => {
    let isMounted = true;
    async function fetchOwnerProfile() {
      if (recipeType === 'user' && user_id && user_id !== 'spoonacular' && user_id !== 'ai' && user_id !== '00000000-0000-0000-0000-000000000000') {
        setProfileLoading(true);
        const ownerProfile = await fetchSimpleProfile(user_id);
        if (isMounted) {
          setProfile(ownerProfile ? { username: ownerProfile.username, avatar_url: ownerProfile.avatar_url } : { username: null, avatar_url: null });
          setProfileLoading(false);
        }
      } else {
        setProfile(null);
        setProfileLoading(false);
      }
    }
    fetchOwnerProfile();
    return () => { isMounted = false; };
  }, [user_id, recipeType]);

  const getRecipeUrl = () => {
    // All recipes now use UUIDs
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

  // Helper to strip <b> and </b> tags
  const stripBoldTags = (text: string) => text.replace(/<\/?b>/gi, '');

  const cardClass = loading && !hideLoadingAnimation
    ? "animate-pulse cursor-wait"
    : "cursor-pointer transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:shadow-lg hover:border-accent";

  const cardContent = (
    <div className="h-[400px] flex flex-col rounded-xl overflow-hidden border border-outline shadow-md transition-all duration-300" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {recipeImageUrl ? (
        <div className="relative w-full h-48 flex-shrink-0">
          <Image
            src={typeof window !== 'undefined' && (window as any).pizzaTimeActive ? '/getpizzedoff.jpg' : recipeImageUrl}
            alt={recipeTitle}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className="w-full h-48 flex-shrink-0" style={{ background: "var(--background)" }} />
      )}
      <div className="flex flex-wrap gap-2 p-4 pb-0">
        {cuisine_type && cuisine_type !== 'unknown' && (
          <span className="text-xs px-2 py-1 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-800 text-white">
            {cuisine_type}
          </span>
        )}
        {diet_type && diet_type !== 'unknown' && diet_type.split(',').map((diet, index) => (
          <span key={`${id}-diet-${index}`} className="text-xs px-2 py-1 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-800 text-white">
            {diet.trim()}
          </span>
        ))}
        {(cooking_time || readyInMinutes) && (
          <span className="text-xs px-2 py-1 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-800 text-white">
            {formatCookingTimePill(cooking_time) || formatTime(readyInMinutes)}
          </span>
        )}
      </div>
      <div className="flex-1 flex flex-col p-4 pt-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-medium line-clamp-1 truncate overflow-hidden text-ellipsis" style={{ color: "var(--foreground)" }}>{stripBoldTags(recipeTitle)}</h2>
        </div>
        {funDescription && (
          <p className="text-sm-600 dark:text-gray-400 mb-2 line-clamp-1">
            {funDescription}
          </p>
        )}
        <p className="text-sm mb-4 line-clamp-2 overflow-hidden text-ellipsis" style={{ color: "var(--foreground)" }}>
          {stripBoldTags(formatDescription(recipeDescription))}
        </p>
        <div className="mt-auto">
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative group">
      <Link href={linkPath} className={cardClass}>
        {cardContent}
      </Link>
      {/* Action row with all buttons, outside the Link to prevent navigation on click */}
      <div className="flex items-center gap-4 h-16 px-4 border-t border-outline bg-transparent absolute bottom-0 left-0 w-full" onClick={e => e.stopPropagation()}>
        <Avatar
          avatar_url={
            recipeType === 'user' && profile && profile.avatar_url
              ? profile.avatar_url
              : recipeType === 'spoonacular' || user_id === 'spoonacular'
              ? null
              : undefined
          }
          username={
            recipeType === 'user' && profile && profile.username
              ? profile.username
              : recipeType === 'ai' || user_id === '00000000-0000-0000-0000-000000000000'
              ? 'ai recipe'
              : recipeType === 'spoonacular' || user_id === 'spoonacular'
              ? 'spoonacular'
              : '[recipes] user'
          }
          size={24}
          className={
            recipeType === 'spoonacular' || user_id === 'spoonacular'
              ? 'bg-gray-800 text-gray-200 dark:bg-gray-700 dark:text-gray-200 font-bold'
              : 'bg-gray-200 text-gray-800 dark:bg-gray-900 dark:text-gray-200 font-bold'
          }
        />
        <span className="text-xs font-normal align-middle lowercase" style={{ lineHeight: '24px' }}>
          {recipeType === 'user' && profile && profile.username
            ? profile.username.toLowerCase()
            : recipeType === 'ai' || user_id === '00000000-0000-0000-0000-000000000000'
            ? 'ai recipe'
            : recipeType === 'spoonacular' || user_id === 'spoonacular'
            ? 'spoonacular'
            : '[recipes] user'}
        </span>
        <div className="flex items-center gap-4 ml-auto">
          <StarButton
            recipeId={id}
            recipeType={recipeType}
          />
          <ShareButton
            recipeId={id}
            recipeTitle={recipeTitle}
            recipeType={recipeType}
            className="p-1 flex items-center justify-center hover:opacity-80 transition-opacity"
            iconOnly={true}
          />
          {recipeType === 'user' && (
            <ReportButton
              recipeId={id}
              recipeType={recipeType}
              className="p-1 flex items-center justify-center hover:opacity-80 transition-opacity"
            />
          )}
        </div>
      </div>
      {isShareDialogOpen && hasValidId && (
        <ShareDialog
          isOpen={isShareDialogOpen}
          onRequestClose={handleCloseShareDialog}
          recipeId={id}
          recipeTitle={recipeTitle}
          recipeType={recipeType}
        />
      )}
    </div>
  );
}

// Main component that uses React.memo to prevent unnecessary re-renders
const RecipeCard = React.memo(RecipeCardContent) as any;
RecipeCard.Skeleton = RecipeCardSkeleton;
export default RecipeCard;