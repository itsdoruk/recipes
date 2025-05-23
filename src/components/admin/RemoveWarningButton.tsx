import { useState } from 'react';
import { Profile } from '@/types/supabase';

interface RemoveWarningButtonProps {
  user: Profile;
  onRemoveWarning: () => void;
  disabled?: boolean;
}

export default function RemoveWarningButton({ user, onRemoveWarning, disabled = false }: RemoveWarningButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleClick = () => {
    if (isConfirming) {
      setIsLoading(true);
      onRemoveWarning();
      setIsConfirming(false);
      // We don't set isLoading back to false here because the parent component
      // will re-render this component with updated props when the operation completes
    } else {
      setIsConfirming(true);
    }
  };
  
  const handleCancel = () => {
    setIsConfirming(false);
  };
  
  // If user has no warnings, disable the button
  const noWarnings = !user.warnings || user.warnings <= 0;
  const isDisabled = disabled || noWarnings || isLoading;
  
  return (
    <div className="inline-flex items-center">
      {isConfirming ? (
        <>
          <button
            onClick={handleClick}
            className="px-3 py-1 border border-yellow-200 dark:border-yellow-800 text-yellow-500 font-medium cursor-pointer hover:opacity-80 transition-opacity rounded-lg mr-2 bg-transparent"
            disabled={isDisabled}
          >
            {isLoading ? 'Removing...' : 'Confirm'}
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-1 border border-outline font-medium cursor-pointer hover:opacity-80 transition-opacity rounded-lg bg-transparent"
            disabled={isLoading}
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          onClick={handleClick}
          className="px-3 py-1 border border-outline font-medium cursor-pointer hover:opacity-80 transition-opacity rounded-lg bg-transparent"
          style={{ 
            color: isDisabled ? 'var(--muted)' : 'var(--success)', 
            cursor: isDisabled ? 'not-allowed' : 'pointer'
          }}
          disabled={isDisabled}
          title={noWarnings ? "User has no warnings to remove" : "Remove a warning from this user"}
        >
          {isLoading ? 'Removing...' : 'Remove Warning'}
        </button>
      )}
    </div>
  );
} 