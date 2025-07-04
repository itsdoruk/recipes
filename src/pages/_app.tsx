import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from 'next-themes';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import Layout from '@/components/Layout';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { useState, useEffect } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import PizzaTimeEasterEgg from '@/components/PizzaTimeEasterEgg';
import { ProfileProvider } from '@/contexts/ProfileContext';

export default function App({ Component, pageProps }: AppProps) {
  const [supabaseClient] = useState(() => getBrowserClient());

  return (
    <ErrorBoundary>
      <SessionContextProvider supabaseClient={supabaseClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ProfileProvider>
          <Layout>
              <PizzaTimeEasterEgg />
            <Component {...pageProps} />
          </Layout>
          </ProfileProvider>
        </ThemeProvider>
      </SessionContextProvider>
    </ErrorBoundary>
  );
}