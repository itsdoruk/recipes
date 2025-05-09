import { useRouter } from 'next/router';
import { useAuth } from '@/lib/auth';

export default function AccountSettings() {
  const router = useRouter();
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <p className="text-gray-500 dark:text-gray-400">please sign in to access account settings</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">account</h1>
      
      <div className="space-y-4">
        <button
          onClick={() => router.push('/account/change-password')}
          className="w-full h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity text-left"
        >
          change password
        </button>
        
        <button
          onClick={() => router.push('/account/change-email')}
          className="w-full h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity text-left"
        >
          change email
        </button>

        <button
          onClick={() => router.push('/account/delete')}
          className="w-full h-10 px-3 border border-red-200 dark:border-red-800 text-red-500 hover:opacity-80 transition-opacity text-left"
        >
          delete account
        </button>
      </div>
    </div>
  );
} 