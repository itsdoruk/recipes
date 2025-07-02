import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getSupabaseClient } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const { code, error: authError, next } = router.query;

      if (authError) {
        console.error('Auth error:', authError);
        setError('Authentication failed. Please try again.');
        return;
      }

      if (!code) {
        console.error('No code provided');
        setError('No authentication code provided.');
        return;
      }

      try {
        const supabase = getSupabaseClient();
        
        // Exchange the code for a session
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code as string);
        
        if (exchangeError) {
          console.error('Error exchanging code for session:', exchangeError);
          setError('Failed to complete authentication. Please try again.');
          return;
        }

        // Redirect immediately to the intended page or home
        const redirectPath = typeof next === 'string' ? next : '/';
        router.replace(redirectPath);
      } catch (err: any) {
        console.error('Unexpected error during auth callback:', err);
        setError('An unexpected error occurred. Please try again.');
      }
    };

    // Handle callback immediately when query params are available
    if (router.query.code || router.query.error) {
      handleCallback();
    }
  }, [router.query]);

  // Show minimal loading state only if we're still waiting for query params
  if (!router.query.code && !router.query.error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <>
        <Head>
          <title>Sign in error | [recipes]</title>
        </Head>
        <div className="flex justify-center items-center h-screen">
          <div className="text-center max-w-md mx-auto px-4">
            <h1 className="text-2xl mb-4">sign in error</h1>
            <p className="mb-6 text-red-500">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 border border-outline hover:opacity-80 transition-opacity rounded-lg"
            >
              try again
            </button>
          </div>
        </div>
      </>
    );
  }

  return null;
} 