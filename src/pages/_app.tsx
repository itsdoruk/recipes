import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from 'next-themes';
import { getSupabaseClient } from '@/lib/supabase';
import Layout from '@/components/Layout';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { useState, useEffect } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  const [supabaseClient] = useState(() => getSupabaseClient());

  return (
    <SessionContextProvider supabaseClient={supabaseClient}>
      <ThemeProvider attribute="class">
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </ThemeProvider>
    </SessionContextProvider>
  );
}