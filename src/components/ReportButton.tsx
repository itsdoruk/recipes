import { useState } from 'react';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';

interface ReportButtonProps {
  recipeId: string;
  recipeType: 'user' | 'spoonacular' | 'ai' | 'message';
  onReportSubmitted?: () => void;
  className?: string;
}

export default function ReportButton({ recipeId, recipeType, onReportSubmitted, className }: ReportButtonProps) {
  const session = useSession();
  const supabase = useSupabaseClient();
  const user = session?.user;
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Get appropriate title based on what's being reported
  const getTitle = () => {
    switch (recipeType) {
      case 'user':
        return 'User Report';
      case 'spoonacular':
      case 'ai':
        return 'Recipe Report';
      case 'message':
        return 'Message Report';
      default:
        return 'Report';
    }
  };

  // Get appropriate placeholder text
  const getPlaceholder = () => {
    switch (recipeType) {
      case 'user':
        return 'please describe the issue with this user';
      case 'spoonacular':
      case 'ai':
        return 'please explain why you are reporting this recipe';
      case 'message':
        return 'please explain why you are reporting this message';
      default:
        return 'please explain why you are reporting this content';
    }
  };

  const handleOpenModal = () => {
    setIsOpen(true);
    setStatus('idle');
    setErrorMessage(null);
    setReason('');
  };

  const handleCloseModal = () => {
    setIsOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reason.trim()) return;

    setStatus('submitting');
    setErrorMessage(null);

    try {
      // Check if we have a valid session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error('No valid session found. Please log in again.');
      }

      // Create the base report data
      const reportData: any = {
        reporter_id: user.id,
        reason: reason.trim(),
        details: reason.trim(),
        status: 'pending'
      };

      // Handle different report types
      if (recipeType === 'user') {
        // For direct user reports
        if (recipeId === user.id) {
          throw new Error('You cannot report yourself');
        }
        
        // Check if the user exists
        const { data: profileCheck, error: profileCheckError } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('user_id', recipeId);
          
        if (profileCheckError) {
          console.error('Error checking profile:', profileCheckError);
        }
        
        if (!profileCheck || profileCheck.length === 0) {
          throw new Error('Cannot report this user. The user may not exist in our system.');
        }
        
        reportData.reported_user_id = recipeId;
      } else if (['spoonacular', 'ai'].includes(recipeType)) {
        // For recipe reports - just include the recipe ID without trying to find the creator
        reportData.recipe_id = recipeId;
        reportData.recipe_type = recipeType;
      } else if (recipeType === 'message') {
        // For message reports
        reportData.recipe_id = recipeId;
        reportData.recipe_type = 'user'; // Messages are associated with users
      }
      
      // Submit the report
      const { data: insertData, error: insertError } = await supabase
        .from('reports')
        .insert(reportData)
        .select();
        
      if (insertError) {
        console.error('Error inserting report:', insertError);
        
        if (insertError.message.includes('violates foreign key constraint')) {
          if (insertError.message.includes('reported_user_id')) {
            throw new Error('Cannot report this user. The user may not exist in our system.');
          } else if (insertError.message.includes('recipe_id')) {
            throw new Error('Cannot report this recipe. The recipe may have been deleted.');
          } else {
            throw new Error('Cannot submit report due to a data constraint issue.');
          }
        } else {
          throw new Error(`Failed to submit report: ${insertError.message}`);
        }
      }
      
      // Success handling
      console.log('Report submitted successfully:', insertData);
      setStatus('success');
      setReason('');
      
      if (onReportSubmitted) {
        onReportSubmitted();
      }
      
      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error('Error submitting report:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to submit report. Please try again.');
    }
  };

  if (!user) return null;

  return (
    <>
      <button
        onClick={handleOpenModal}
        aria-label="report"
        className={`p-2 hover:opacity-80 transition-opacity ${className || ''}`}
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

      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="w-full max-w-xl p-8 rounded-2xl shadow-lg border border-outline" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
            <h2 className="text-2xl mb-6">
              {getTitle()}
            </h2>
            
            {status === 'success' ? (
              <div className="p-6 text-center">
                <div className="p-4 border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-xl mb-6">
                  <p className="text-green-700 dark:text-green-400 text-lg">
                    Report submitted successfully!
                  </p>
                </div>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Thank you for your report. The page will refresh automatically.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={getPlaceholder()}
                  className="w-full min-h-[160px] px-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 resize-none border border-outline bg-transparent"
                  required
                />
                
                {status === 'error' && errorMessage && (
                  <div className="p-4 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
                    <p className="text-red-500 text-sm">{errorMessage}</p>
                  </div>
                )}
                
                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-5 py-3 rounded-xl text-base border border-outline bg-transparent hover:opacity-80 transition-opacity"
                    disabled={status === 'submitting'}
                  >
                    cancel
                  </button>
                  <button
                    type="submit"
                    disabled={status === 'submitting' || !reason.trim()}
                    className="px-5 py-3 rounded-xl text-base border border-outline bg-transparent hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status === 'submitting' ? 'submitting...' : 'submit report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
} 