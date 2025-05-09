import Modal from 'react-modal';

interface BulkWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWarning: () => void;
  warningReason: string;
  setWarningReason: (reason: string) => void;
}

export default function BulkWarningModal({
  isOpen,
  onClose,
  onAddWarning,
  warningReason,
  setWarningReason
}: BulkWarningModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Add Bulk Warning"
      className="fixed inset-0 flex items-center justify-center z-50"
      overlayClassName="fixed inset-0 bg-black/50"
      ariaHideApp={false}
    >
      <div className="p-8 shadow-2xl max-w-lg w-full border" style={{ background: 'var(--background)', borderColor: 'var(--outline)', color: 'var(--foreground)', borderRadius: 0 }}>
        <h2 className="text-2xl font-bold mb-4">add bulk warning</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">warning reason</label>
            <textarea
              value={warningReason}
              onChange={(e) => setWarningReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800"
              rows={4}
              placeholder="enter warning reason..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 dark:border-gray-800"
            >
              cancel
            </button>
            <button
              onClick={onAddWarning}
              disabled={!warningReason.trim()}
              className="px-4 py-2 border border-yellow-200 dark:border-yellow-800 text-yellow-500 disabled:opacity-50"
            >
              add warning
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
} 