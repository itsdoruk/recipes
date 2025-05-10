import Modal from 'react-modal';
import { Profile } from '@/types';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: Profile;
  warnings: any[];
  activity: any[];
}

export default function UserModal({ isOpen, onClose, user, warnings, activity }: UserModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="User Details"
      className="fixed inset-0 flex items-center justify-center z-50"
      overlayClassName="fixed inset-0 bg-black/50"
      ariaHideApp={false}
    >
      <div className="p-8 shadow-2xl max-w-lg w-full border rounded-xl" style={{ background: 'var(--background)', borderColor: 'var(--outline)', color: 'var(--foreground)' }}>
        <h2 className="text-2xl font-bold mb-4">User Details</h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full overflow-hidden border border-gray-200 dark:border-gray-800 flex items-center justify-center">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.username || 'avatar'} className="object-cover w-full h-full" />
            ) : (
              <span className="text-2xl font-bold text-gray-300">{user.username?.[0]?.toUpperCase() || 'A'}</span>
            )}
          </div>
          <div>
            <div className="font-semibold text-xl flex items-center gap-2">
              {user.username || 'anonymous'}
              {user.is_admin && <span className="text-blue-400 text-xs font-bold border border-blue-400 px-1">admin</span>}
              {user.banned && <span className="text-red-400 text-xl ml-1">🔒</span>}
            </div>
            <div className="text-sm text-gray-500">{user.email || user.user_id}</div>
          </div>
        </div>
        <div className="mb-2">
          <span className="font-semibold">Registration date:</span> {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
        </div>
        <div className="mb-2">
          <span className="font-semibold">Ban expiry:</span> {user.ban_expiry ? new Date(user.ban_expiry).toLocaleString() : 'N/A'}
        </div>
        <div className="mb-4">
          <span className="font-semibold">Warnings:</span>
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
        <button onClick={onClose} className="mt-4 px-4 py-2 border cursor-pointer hover:opacity-80" style={{ borderColor: 'var(--outline)', background: 'var(--background)', color: 'var(--foreground)', borderRadius: 0 }}>Close</button>
      </div>
    </Modal>
  );
} 