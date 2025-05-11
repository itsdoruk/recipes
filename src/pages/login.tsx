import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type AuthMode = 'signin' | 'signup' | 'magic';

export default function Login() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'magic') {
        if (!otpSent) {
          // Send OTP
          const { error: otpError } = await supabase.auth.signInWithOtp({
            email,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`
            }
          });
          if (otpError) throw otpError;
          setOtpSent(true);
        } else {
          // Verify OTP
          const { error: verifyError } = await supabase.auth.verifyOtp({
            email,
            token: otp,
            type: 'email'
          });
          if (verifyError) throw verifyError;
          router.push('/');
        }
      } else if (mode === 'signup') {
        // Sign up with email, password, and username
        await signUp(email, password, username);
        router.push('/');
      } else {
        // Regular sign in
        await signIn(email, password);
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'an error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>login | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="rounded-2xl p-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
          <h1 className="text-2xl mb-8">login</h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block mb-2">email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3 border border-gray-200 dark:border-gray-800 bg-transparent hover:opacity-80 transition-opacity rounded-lg"
                required
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block mb-2">username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-200 dark:border-gray-800 bg-transparent hover:opacity-80 transition-opacity rounded-lg"
                  required
                />
              </div>
            )}

            {mode !== 'magic' && (
              <div>
                <label className="block mb-2">password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-200 dark:border-gray-800 bg-transparent hover:opacity-80 transition-opacity rounded-lg"
                  required
                />
              </div>
            )}

            {mode === 'magic' && otpSent && (
              <div>
                <label className="block mb-2">enter the code sent to your email</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-200 dark:border-gray-800 bg-transparent hover:opacity-80 transition-opacity rounded-lg"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity rounded-lg"
            >
              {isLoading ? 'loading...' : mode === 'magic' ? (otpSent ? 'verify code' : 'send magic link') : mode === 'signup' ? 'create account' : 'sign in'}
            </button>

            {error && (
              <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <p className="text-red-500">{error}</p>
              </div>
            )}

            {mode === 'magic' && otpSent && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                check your email for the magic link code
              </p>
            )}
          </form>

          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
            <div className="flex flex-col gap-2 text-center text-gray-500 dark:text-gray-400">
              <button
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setError(null);
                  setOtpSent(false);
                }}
                className="hover:opacity-80 transition-opacity"
              >
                {mode === 'signin' ? "don't have an account? sign up" : "already have an account? sign in"}
              </button>
              <button
                onClick={() => {
                  setMode('magic');
                  setError(null);
                  setOtpSent(false);
                }}
                className="hover:opacity-80 transition-opacity"
              >
                or sign in with a magic link
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
} 
