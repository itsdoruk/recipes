import Modal from 'react-modal';
import { Profile } from '@/types/supabase';
import RemoveWarningButton from './RemoveWarningButton';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: Profile;
  warnings: any[];
  activity: any[];
  onRemoveWarning: (userId: string) => Promise<void>;
  isProcessing?: boolean;
}

export default function UserModal({ 
  isOpen, 
  onClose, 
  user, 
  warnings, 
  activity, 
  onRemoveWarning,
  isProcessing = false 
}: UserModalProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { refreshSession, authError: globalAuthError } = useAuth();

  // Handle authentication errors
  useEffect(() => {
    if (globalAuthError) {
      setAuthError(globalAuthError);
    }
  }, [globalAuthError]);

  const handleRemoveWarning = async () => {
    setIsRemoving(true);
    setAuthError(null);
    try {
      // Try to refresh the session before performing the action
      const refreshed = await refreshSession();
      if (!refreshed) {
        throw new Error('Authentication error. Please try logging in again.');
      }
      await onRemoveWarning(user.user_id);
    } catch (error: any) {
      console.error('Error removing warning:', error);
      setAuthError(error.message || 'Failed to remove warning');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleRetry = async () => {
    setAuthError(null);
    const refreshed = await refreshSession(true); // Force refresh
    if (!refreshed) {
      setAuthError('Failed to refresh session. Please try logging in again.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="User Details"
      className="fixed inset-0 flex items-center justify-center z-50"
      overlayClassName="fixed inset-0 bg-black/50"
      ariaHideApp={false}
      shouldCloseOnOverlayClick={true}
      shouldCloseOnEsc={true}
      shouldReturnFocusAfterClose={true}
    >
      <div className="p-8 shadow-2xl max-w-md w-full border rounded-xl" style={{ background: 'var(--background)', borderColor: 'var(--outline)', color: 'var(--foreground)' }}>
        {authError ? (
          <div className="space-y-4">
            <div className="p-4 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <p className="text-red-500">{authError}</p>
            </div>
            <div className="flex justify-end gap-4">
              <button
                onClick={handleRetry}
                className="px-4 py-2 border border-outline hover:opacity-80 transition-opacity rounded-lg"
              >
                retry
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-outline hover:opacity-80 transition-opacity rounded-lg"
              >
                close
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-4">User Details</h2>
            <div className="mb-2">
              <span className="font-semibold">Username:</span> {user.username}
            </div>
            <div className="mb-2">
              <span className="font-semibold">Email:</span> {user.email}
            </div>
            <div className="mb-2">
              <span className="font-semibold">ID:</span> {user.user_id}
            </div>
            <div className="mb-2">
              <span className="font-semibold">Admin:</span> {user.is_admin ? 'Yes' : 'No'}
            </div>
            <div className="mb-2">
              <span className="font-semibold">Banned:</span> {user.banned ? 'Yes' : 'No'}
            </div>
            {user.banned && (
              <div className="mb-2">
                <span className="font-semibold">Ban Expiry:</span> {user.ban_expiry ? new Date(user.ban_expiry).toLocaleString() : 'Permanent'}
              </div>
            )}
            <div className="mb-2">
              <span className="font-semibold">Created:</span> {new Date(user.created_at).toLocaleString()}
            </div>
            <div className="mb-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Warnings: {user.warnings || 0}</span>
                <RemoveWarningButton 
                  user={user} 
                  onRemoveWarning={handleRemoveWarning} 
                  disabled={isProcessing || isRemoving}
                />
              </div>
              <ul className="list-disc ml-6 mt-1">
                {warnings.length === 0 && <li className="text-gray-500">No warnings</li>}
                {warnings.map(w => (
                  <li key={w.id} className="mb-1">
                    <span className="text-yellow-700">⚠️</span> {w.reason} <span className="text-xs text-gray-400">({new Date(w.created_at).toLocaleDateString()})</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mb-4">
              <span className="font-semibold">Recent Activity:</span>
              <ul className="list-disc ml-6 mt-1">
                {activity.length === 0 && <li className="text-gray-500">No recent recipes</li>}
                {activity.map(a => (
                  <li key={a.id}>{a.title} <span className="text-xs text-gray-400">({new Date(a.created_at).toLocaleDateString()})</span></li>
                ))}
              </ul>
            </div>
            <button 
              onClick={onClose} 
              className="mt-4 px-4 py-2 border cursor-pointer hover:opacity-80 bg-transparent" 
              style={{ borderColor: 'var(--outline)', color: 'var(--foreground)', borderRadius: 0 }}
            >
              Close
            </button>
          </>
        )}
      </div>
    </Modal>
  );
} 