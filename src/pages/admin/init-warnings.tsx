import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { useProfile } from '@/hooks/useProfile';
import Head from 'next/head';

export default function InitWarnings() {
  const router = useRouter();
  const session = useSession();
  const supabase = useSupabaseClient();
  const { profile, isLoading } = useProfile();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  useEffect(() => {
    // Check admin status directly
    const checkAdminStatus = async () => {
      if (!supabase) return;
      
      try {
        // Try to get the session
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (!sessionData?.session) {
          console.log('No session found, redirecting to login');
          router.push('/login');
          return;
        }
        
        // Get user ID from session
        const userId = sessionData.session.user.id;
        
        // Check if user is admin
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('is_admin, is_moderator')
          .eq('user_id', userId)
          .single();
          
        if (error) {
          console.error('Error fetching profile:', error);
          setIsAdmin(false);
        } else if (profileData && (profileData.is_admin || profileData.is_moderator)) {
          console.log('User is admin or moderator');
          setIsAdmin(true);
        } else {
          console.log('User is not admin or moderator');
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
        setIsAdmin(false);
      } finally {
        setIsCheckingAdmin(false);
      }
    };
    
    checkAdminStatus();
  }, [supabase, router]);

  const initializeWarnings = async () => {
    setStatus('loading');
    setMessage('Initializing warnings system...');
    
    try {
      // Get the session token to use for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch('/api/init-warnings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize warnings system');
      }
      
      setStatus('success');
      setMessage('Warnings system initialized successfully!');
    } catch (error) {
      console.error('Error initializing warnings:', error);
      setStatus('error');
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (isCheckingAdmin) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Head>
          <title>Initialize Warnings System</title>
        </Head>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <p className="text-lg">Checking permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Head>
          <title>Access Denied</title>
        </Head>
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-6">Access Denied</h1>
          <p className="mb-4">You need admin privileges to access this page.</p>
          <button
            onClick={() => router.push('/admin')}
            className="px-4 py-2 border border-outline bg-[var(--background)] text-[var(--foreground)] hover:opacity-80 transition-opacity rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Return to Admin Panel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Head>
        <title>Initialize Warnings System</title>
      </Head>
      <h1 className="text-3xl font-bold mb-6">Initialize Warnings System</h1>
      
      <div className="mb-8">
        <p className="mb-4">
          This page will initialize the warnings system by creating the necessary database tables and functions.
          You only need to do this once.
        </p>
        
        <button
          onClick={initializeWarnings}
          disabled={status === 'loading'}
          className={`px-4 py-2 border border-outline bg-[var(--background)] text-[var(--foreground)] hover:opacity-80 transition-opacity rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
            status === 'loading'
              ? 'cursor-not-allowed'
              : ''
          }`}
        >
          {status === 'loading' ? 'Initializing...' : 'Initialize Warnings System'}
        </button>
      </div>
      
      {message && (
        <div
          className={`p-4 rounded-lg ${
            status === 'error'
              ? 'bg-red-100 text-red-800 border border-red-300'
              : status === 'success'
              ? 'bg-green-100 text-green-800 border border-green-300'
              : 'bg-gray-100 text-gray-800 border border-gray-300'
          }`}
        >
          {message}
        </div>
      )}
      
      {status === 'success' && (
        <div className="mt-6">
          <p className="mb-4">The warnings system has been initialized successfully.</p>
          <button
            onClick={() => router.push('/admin')}
            className="px-4 py-2 border border-outline bg-[var(--background)] text-[var(--foreground)] hover:opacity-80 transition-opacity rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Return to Admin Panel
          </button>
        </div>
      )}
    </div>
  );
} 