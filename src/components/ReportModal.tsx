import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Modal from './Modal';

interface ReportModalProps {
  isOpen: boolean;
  onRequestClose: () => void;
  reportedUserId?: string;
  reportedRecipeId?: string;
  recipeType?: 'user' | 'spoonacular' | 'ai';
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
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const reportData = {
        user_id: user.id,
        reason,
        details,
        status: 'pending' as const,
        ...(reportedUserId && { reported_user_id: reportedUserId }),
        ...(reportedRecipeId && { 
          recipe_id: reportedRecipeId,
          recipe_type: recipeType
        })
      };

      const { error: reportError } = await supabase
        .from('reports')
        .insert(reportData);

      if (reportError) throw reportError;

      setSuccess(true);
      if (onReportSubmitted) {
        onReportSubmitted();
      }
      setTimeout(() => {
        onRequestClose();
        // Reset form state
        setReason('');
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
    if (reportedUserId) return 'report user';
    if (reportedRecipeId) return 'report recipe';
    return 'report';
  };

  const getPlaceholder = () => {
    if (reportedUserId) return 'why are you reporting this user?';
    if (reportedRecipeId) return 'why are you reporting this recipe?';
    return 'why are you reporting this?';
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      contentLabel={getTitle()}
      className="fixed inset-0 flex items-center justify-center z-50"
      overlayClassName="fixed inset-0 bg-black"
      ariaHideApp={false}
    >
      <div className="w-full max-w-xl border border-[var(--outline)] rounded-2xl bg-[var(--background)] p-10" style={{ color: 'var(--foreground)', boxShadow: 'none' }}>
        <h2 className="text-2xl font-bold mb-8 text-left lowercase">{getTitle()}</h2>
        {success ? (
          <div className="text-center py-4">
            <p className="text-green-600 mb-4">Report submitted successfully!</p>
            <p className="text-sm text-gray-500">Thank you for helping keep our community safe.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={5}
                className="w-full px-4 py-3 border border-[var(--outline)] rounded-lg text-base text-[var(--foreground)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--outline)] resize-none bg-[var(--background)]"
                placeholder={getPlaceholder()}
                disabled={isSubmitting}
                style={{ minHeight: 110, maxHeight: 140 }}
              />
            </div>
            {error && (
              <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <p className="text-red-500">{error}</p>
              </div>
            )}
            <div className="flex justify-between gap-6 mt-2">
              <button
                type="button"
                onClick={onRequestClose}
                className="w-1/2 py-2 border border-[var(--outline)] font-bold cursor-pointer rounded-lg text-base text-[var(--foreground)] bg-[var(--background)]"
                disabled={isSubmitting}
              >
                cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !details.trim()}
                className="w-1/2 py-2 border border-[var(--outline)] font-bold cursor-pointer rounded-lg text-base text-[var(--foreground)] bg-[var(--background)]"
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