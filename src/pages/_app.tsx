import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { AuthProvider } from '@/lib/auth';
import { appWithTranslation } from 'next-i18next';
import { ThemeProvider } from 'next-themes';

function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <div className="min-h-screen flex flex-col" style={{ background: "var(--background)", color: "var(--foreground)" }}>
          <Navbar />
          <main className="flex-1">
            <Component {...pageProps} />
          </main>
          <Footer />
        </div>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default appWithTranslation(App);