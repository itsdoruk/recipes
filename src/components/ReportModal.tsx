import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { getWithAuth, postWithAuth } from '@/lib/api-helpers';
import Modal from './Modal';

interface ReportModalProps {
  isOpen: boolean;
  onRequestClose: () => void;
  reportedUserId?: string;
  reportedRecipeId?: string;
  recipeType?: 'user' | 'spoonacular' | 'ai' | 'message';
  onReportSubmitted?: () => void;
}

export default function ReportModal({ 
  isOpen, 
  onRequestClose, 
  reportedUserId, 
  reportedRecipeId, 
  recipeType,
  onReportSubmitted 
}: ReportModalProps) {
  const { user, session, refreshSession } = useAuth();
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [authStatus, setAuthStatus] = useState<string>('checking');
  const [authCheckComplete, setAuthCheckComplete] = useState(false);

  // Check authentication status when modal opens
  useEffect(() => {
    let isMounted = true;
    
    if (isOpen && user && !authCheckComplete) {
      const checkAuth = async () => {
        try {
          // Check auth status using the API endpoint
          const response = await getWithAuth('/api/auth-status');
          const data = await response.json();
          
          if (!isMounted) return;
          
          if (data.authenticated) {
            console.log('API confirms authentication:', data.user.id);
            setAuthStatus('authenticated');
          } else {
            console.log('API reports not authenticated:', data.message);
            setAuthStatus('unauthenticated');
            setError('Please log in to submit a report');
          }
        } catch (err) {
          console.error('Error checking auth:', err);
          if (!isMounted) return;
          setAuthStatus('error');
          setError('Authentication error. Please try logging in again.');
        } finally {
          if (isMounted) {
            setAuthCheckComplete(true);
          }
        }
      };
      
      checkAuth();
    }
    
    return () => {
      isMounted = false;
    };
  }, [isOpen, user, authCheckComplete]);

  // Reset auth check when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAuthCheckComplete(false);
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Please log in to submit a report');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      console.log('Submitting report from modal with auth status:', authStatus);
      
      // Check auth status before proceeding
      const authResponse = await getWithAuth('/api/auth-status');
      const authData = await authResponse.json();
      
      if (!authData.authenticated) {
        console.error('Not authenticated according to API:', authData.message);
        throw new Error('Authentication check failed. Please try logging in again.');
      }
      
      console.log('Authentication confirmed by API');
      
      // Try to refresh the session first
      console.log('Refreshing session before submitting report');
      await refreshSession();
      
      const reportData = {
        reason: details,
        details,
        ...(reportedUserId && { reported_user_id: reportedUserId }),
        ...(reportedRecipeId && { 
          recipe_id: reportedRecipeId,
          recipe_type: recipeType
        })
      };

      // Use the helper function for authenticated API requests
      await postWithAuth('/api/reports', reportData);

      setSuccess(true);
      if (onReportSubmitted) {
        onReportSubmitted();
      }
      setTimeout(() => {
        onRequestClose();
        // Reset form state
        setDetails('');
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      console.error('Error submitting report:', err);
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTitle = () => {
    if (reportedUserId) return 'user report';
    if (reportedRecipeId) return 'recipe report';
    return 'report';
  };

  const getPlaceholder = () => {
    return 'Please describe the issue in detail';
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      contentLabel={getTitle()}
      className="fixed inset-0 flex items-center justify-center z-50"
      overlayClassName="fixed inset-0 bg-black/50"
      ariaHideApp={false}
    >
      <div className="w-full max-w-xl p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
        <h2 className="text-2xl mb-6">
          {getTitle()}
        </h2>
        
        {success ? (
          <div className="text-center py-4">
            <p className="text-green-600 mb-2">report submitted successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={getPlaceholder()}
              className="w-full min-h-[160px] px-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 resize-none border border-gray-200 dark:border-gray-800 bg-transparent"
              required
            />
            
            {error && (
              <div className="p-4 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl mb-4">
                <p className="text-red-500 text-sm">{error}</p>
              </div>
            )}
            
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={onRequestClose}
                className="px-5 py-3 rounded-xl text-base border border-gray-200 dark:border-gray-800 bg-transparent hover:opacity-80 transition-opacity"
                disabled={isSubmitting}
              >
                cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !details.trim()}
                className="px-5 py-3 rounded-xl text-base border border-gray-200 dark:border-gray-800 bg-transparent hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'submitting...' : 'submit report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
} 