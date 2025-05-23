import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getSupabaseClient } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data: { user }, error } = await getSupabaseClient().auth.getUser();
      if (error) {
        console.error('Error in auth callback:', error);
        router.push('/login');
      } else if (user) {
        router.push('/');
      } else {
        router.push('/login');
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 text-center">
      <p>completing sign in...</p>
    </div>
  );
} 