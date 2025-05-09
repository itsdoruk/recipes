import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from 'next-themes';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Layout from '@/components/Layout';
import { AuthProvider } from '@/lib/auth';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error('Error initializing auth:', error);
          if (router.pathname !== '/login') {
            router.push('/login');
          }
        } else if (!user && router.pathname !== '/login') {
          router.push('/login');
        } else if (user && router.pathname === '/login') {
          router.push('/');
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('Error getting user:', error);
        return;
      }

      if (event === 'SIGNED_IN' && user && router.pathname === '/login') {
        router.push('/');
      } else if (event === 'SIGNED_OUT' && router.pathname !== '/login') {
        router.push('/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system">
      <AuthProvider>
        <div style={{ background: String('var(--background)'), color: String('var(--foreground)') }}>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}