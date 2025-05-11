import Modal from 'react-modal';
import { Profile } from '@/types';

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
      contentLabel="Add Warning"as
      className="fixed inset-0 flex items-center justify-center z-50"
      overlayClassName="fixed inset-0 bg-black/50"
      ariaHideApp={false}
    >
      <div className="p-8 shadow-2xl max-w-md w-full border rounded-xl" style={{ background: 'var(--background)', borderColor: 'var(--outline)', color: 'var(--foreground)' }}>
        <h2 className="text-xl font-bold mb-4">Add Warning</h2>
        <p className="mb-2">Enter a reason for the warning:</p>
        <textarea
          className="w-full border p-2 mb-4 rounded-lg"
          style={{ borderColor: 'var(--outline)', background: 'var(--background)', color: 'var(--foreground)' }}
          rows={3}
          value={warningReason}
          onChange={e => setWarningReason(e.target.value)}
          placeholder="Reason for warning..."
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity rounded-lg" style={{ color: 'var(--foreground)', background: 'var(--background)' }}>Cancel</button>
          <button onClick={onAddWarning} className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity rounded-lg" style={{ color: 'var(--warning)', background: 'var(--background)' }}>Add Warning</button>
        </div>
      </div>
    </Modal>
  );
} 