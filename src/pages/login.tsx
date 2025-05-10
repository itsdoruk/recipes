import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isOtpLogin, setIsOtpLogin] = useState(false);
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
      if (isOtpLogin) {
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
      } else if (isSignUp) {
        // Sign up with email, password, and username
        await signUp(email, password, username);
        router.push('/');
      } else {
        // Regular sign in
        await signIn(email, password);
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{isSignUp ? 'Sign Up' : 'Sign In'} | [recipes]</title>
      </Head>

      <main className="max-w-sm mx-auto px-4 py-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <h1 className="text-2xl mb-8 text-center">
          {isOtpLogin ? 'magic link login' : isSignUp ? 'create account' : 'sign in'}
        </h1>

        {error && (
          <div className="mb-4 p-3 border border-red-200 dark:border-red-800 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent focus:outline-none"
            required
          />

          {isSignUp && (
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent focus:outline-none"
              required
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_-]+"
              title="Username can only contain letters, numbers, underscores, and hyphens"
            />
          )}

          {!isOtpLogin && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent focus:outline-none"
              required
              minLength={6}
            />
          )}

          {isOtpLogin && otpSent && (
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="enter the code sent to your email"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent focus:outline-none"
              required
            />
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50 rounded-lg"
            >
              {isLoading ? 'Loading...' : isOtpLogin ? (otpSent ? 'verify' : 'send magic link') : isSignUp ? 'create' : 'sign in'}
            </button>
          </div>
        </form>

        <div className="mt-4 space-y-2 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setIsOtpLogin(false);
              setOtpSent(false);
            }}
            className="text-sm text-gray-600 dark:text-gray-400 hover:underline block w-full"
          >
            {isSignUp ? 'already have an account?' : 'need an account?'}
          </button>
          <button
            onClick={() => {
              setIsOtpLogin(!isOtpLogin);
              setIsSignUp(false);
              setOtpSent(false);
            }}
            className="text-sm text-gray-600 dark:text-gray-400 hover:underline block w-full"
          >
            {isOtpLogin ? 'use password instead' : 'use magic link instead'}
          </button>
        </div>
      </main>
    </>
  );
} 
