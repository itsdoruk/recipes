import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface ReportButtonProps {
  recipeId: string;
  recipeType: 'user' | 'spoonacular' | 'ai';
  onReportSubmitted?: () => void;
}

export default function ReportButton({ recipeId, recipeType, onReportSubmitted }: ReportButtonProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('reports')
        .select('*')
        .eq('recipe_id', recipeId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      return data;
    } catch (error) {
      console.error('Error fetching reports:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reason.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: reportError } = await supabase
        .from('reports')
        .insert({
          recipe_id: recipeId,
          recipe_type: recipeType,
          user_id: user.id,
          reason: reason.trim(),
          status: 'pending'
        })
        .select()
        .single();

      if (reportError) throw reportError;

      // Fetch updated reports after successful submission
      const updatedReports = await fetchReports();
      
      setReason('');
      setIsOpen(false);
      
      // Call the callback if provided
      if (onReportSubmitted) {
        onReportSubmitted();
      }
    } catch (error) {
      console.error('error submitting report:', error);
      setError('failed to submit report. please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="report recipe"
        className="p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-transparent hover:opacity-80 transition-opacity flex items-center justify-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-red-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.054 0 1.658-1.14 1.105-2.045L13.105 4.955c-.527-.87-1.683-.87-2.21 0L3.967 16.955c-.553.905.051 2.045 1.105 2.045z" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background border border-gray-200 dark:border-gray-800 p-6 rounded-xl max-w-md w-full mx-4">
            <h2 className="text-xl mb-4">
              {recipeType === 'user' ? 'report user' : 'report recipe'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={recipeType === 'user' ? 'why are you reporting this user?' : 'why are you reporting this recipe?'}
                className="w-full min-h-[100px] px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent focus:outline-none rounded-xl"
                required
              />
              {error && (
                <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl mb-4">
                  <p className="text-red-500 text-sm">{error}</p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity rounded-xl"
                >
                  cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !reason.trim()}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50 rounded-xl"
                >
                  {isSubmitting ? 'submitting...' : 'submit report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
} 