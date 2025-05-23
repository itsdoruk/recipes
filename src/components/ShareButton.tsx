import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import ShareDialog from './ShareDialog';

interface ShareButtonProps {
  recipeId: string;
  recipeTitle: string;
  recipeType?: 'user' | 'spoonacular' | 'ai';
  url?: string;
  title?: string;
  text?: string;
  className?: string;
  iconOnly?: boolean;
}

export default function ShareButton({ 
  recipeId, 
  recipeTitle, 
  recipeType = 'user', 
  url, 
  title, 
  text, 
  className,
  iconOnly = true
}: ShareButtonProps) {
  const { session } = useAuth();
  const user = session?.user || null;
  const [isCopied, setIsCopied] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  const handleShare = async () => {
    if (user) {
      // Open share dialog when user is logged in
      setIsShareDialogOpen(true);
      return;
    }

    // Fall back to regular share API or clipboard for non-logged in users
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback to copying to clipboard
      try {
        await navigator.clipboard.writeText(url || window.location.href);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (error) {
        console.error('Error copying to clipboard:', error);
      }
    }
  };

  const handleCloseDialog = () => {
    setIsShareDialogOpen(false);
  };

  return (
    <>
      <button
        onClick={handleShare}
        aria-label="share"
        className={`p-1 rounded-full hover:opacity-80 transition-opacity flex items-center justify-center ${className || ''}`}
      >
        {isCopied ? (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-green-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
        )}
        {!iconOnly && <span className="ml-2 lowercase">share</span>}
      </button>

      {isShareDialogOpen && (
        <ShareDialog
          isOpen={isShareDialogOpen}
          onRequestClose={handleCloseDialog}
          recipeId={recipeId}
          recipeTitle={recipeTitle}
          recipeType={recipeType}
        />
      )}
    </>
  );
} 