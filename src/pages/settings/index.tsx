import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@/lib/hooks/useUser';
import { useAuth } from '@/lib/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Head from 'next/head';
import Link from 'next/link';

export default function SettingsPage() {
  const router = useRouter();
  const user = useUser();
  const { session, loading: sessionLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const supabase = useSupabaseClient();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('app');

  // Handle authentication and admin check
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (sessionLoading || profileLoading) {
        console.log('Still loading session or profile...');
        return;
      }
      
      if (!session) {
        console.log('No session found, redirecting to login');
        router.push('/login');
        return;
      }

      if (!profile?.is_admin) {
        console.log('User is not an admin, redirecting to home');
        router.push('/');
        return;
      }

      setIsAdmin(true);
      setIsLoading(false);
    };

    checkAdminStatus();
  }, [session, profile, sessionLoading, profileLoading, router]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Settings - My Neighborhood App</title>
      </Head>

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>

        {/* Tabs */}
        <div className="flex space-x-4 mb-8">
          <button
            className={`px-4 py-2 rounded ${
              activeTab === 'app' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
            onClick={() => setActiveTab('app')}
          >
            App Settings
          </button>
          <button
            className={`px-4 py-2 rounded ${
              activeTab === 'account' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
            onClick={() => setActiveTab('account')}
          >
            Account Settings
          </button>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow p-6">
          {activeTab === 'app' && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">App Settings</h2>
              {/* Add your app settings form here */}
            </div>
          )}

          {activeTab === 'account' && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Account Settings</h2>
              {/* Add your account settings form here */}
            </div>
          )}
        </div>
      </div>
    </>
  );
} 