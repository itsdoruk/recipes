import Modal from 'react-modal';
import { Profile } from '@/types/supabase';

interface WarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: Profile;
  onAddWarning: () => void;
  warningReason: string;
  setWarningReason: (reason: string) => void;
}

export default function WarningModal({ isOpen, onClose, user, onAddWarning, warningReason, setWarningReason }: WarningModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Add Warning"
      className="fixed inset-0 flex items-center justify-center z-50"
      overlayClassName="fixed inset-0 bg-black/50"
      ariaHideApp={false}
      shouldCloseOnOverlayClick={true}
      shouldCloseOnEsc={true}
      shouldReturnFocusAfterClose={true}
    >
      <div className="p-8 shadow-2xl max-w-md w-full border rounded-xl" style={{ background: 'var(--background)', borderColor: 'var(--outline)', color: 'var(--foreground)' }}>
        <h2 className="text-xl font-bold mb-4">add warning</h2>
        <p className="mb-2">enter a reason for the warning:</p>
        <textarea
          className="w-full border border-outline p-2 mb-4 rounded-lg"
          style={{ borderColor: 'var(--outline)', background: 'var(--background)', color: 'var(--foreground)' }}
          rows={3}
          value={warningReason}
          onChange={e => setWarningReason(e.target.value)}
          placeholder="reason for warning..."
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1 border border-outline font-medium cursor-pointer hover:opacity-80 transition-opacity rounded-lg bg-transparent" style={{ color: 'var(--foreground)' }}>Cancel</button>
          <button onClick={onAddWarning} className="px-3 py-1 border border-yellow-200 dark:border-yellow-800 text-yellow-500 font-medium cursor-pointer hover:opacity-80 transition-opacity rounded-lg bg-transparent">Add Warning</button>
        </div>
      </div>
    </Modal>
  );
} 
