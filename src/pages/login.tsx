import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { signIn, signUp, signInWithOtp, verifyOtp } from '@/lib/auth-utils';
import { useAuth } from '@/lib/hooks/useAuth';

type AuthMode = 'signin' | 'signup' | 'magic';

export default function Login() {
  const router = useRouter();
  const { redirectTo } = router.query;
  const { user, isAuthenticated, loading, authError } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [loginAttempted, setLoginAttempted] = useState(false);

  // Handle auth errors from the useAuth hook
  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  // If user is already authenticated, redirect to home
  useEffect(() => {
    if (isAuthenticated && !loading) {
      const redirectPath = typeof redirectTo === 'string' ? redirectTo : '/';
      // Only redirect if we're not already on the target path
      if (router.pathname !== redirectPath) {
        router.push(redirectPath);
      }
    }
  }, [isAuthenticated, loading, redirectTo, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setLoginAttempted(true);

    try {
      if (mode === 'magic') {
        if (!otpSent) {
          console.log("Sending magic link to:", email);
          const { error: otpError } = await signInWithOtp(email);
          if (otpError) {
            throw otpError;
          }
          setOtpSent(true);
        } else {
          console.log("Verifying OTP for:", email);
          const { error: verifyError } = await verifyOtp(email, otp);
          if (verifyError) {
            throw verifyError;
          }
        }
      } else if (mode === 'signup') {
        console.log("Signing up with email:", email);
        const { error: signUpError } = await signUp(email, password, username);
        if (signUpError) {
          throw signUpError;
        }
      } else {
        console.log("Signing in with email:", email);
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          throw signInError;
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      // Provide more user-friendly error messages
      let errorMessage = err.message || 'An error occurred';
      
      // Handle common error cases
      if (errorMessage.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password';
      } else if (errorMessage.includes('Email not confirmed')) {
        errorMessage = 'Please check your email to confirm your account';
      } else if (errorMessage.includes('User already registered')) {
        errorMessage = 'An account with this email already exists';
      } else if (errorMessage.includes('Password should be at least 6 characters')) {
        errorMessage = 'Password must be at least 6 characters long';
      } else if (errorMessage.toLowerCase().includes('rate limit') || errorMessage.includes('too many login attempts')) {
        errorMessage = 'Too many login attempts. Please wait a minute before trying again.';
        // Disable the form for 1 minute on rate limit
        const disableUntil = Date.now() + 60 * 1000; // 1 minute
        localStorage.setItem('loginDisabledUntil', disableUntil.toString());
      } else if (errorMessage.includes('Maximum retry attempts reached')) {
        errorMessage = 'Unable to sign in after multiple attempts. Please try again in a minute.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Update the effect to handle form disable state with countdown
  useEffect(() => {
    const checkDisabledState = () => {
      const disabledUntil = localStorage.getItem('loginDisabledUntil');
      if (disabledUntil) {
        const timeLeft = parseInt(disabledUntil) - Date.now();
        if (timeLeft > 0) {
          setIsLoading(true);
          const secondsLeft = Math.ceil(timeLeft / 1000);
          setError(`Too many login attempts. Please wait ${secondsLeft} seconds before trying again.`);
          return true;
        } else {
          localStorage.removeItem('loginDisabledUntil');
          setIsLoading(false);
          setError(null);
        }
      }
      return false;
    };

    checkDisabledState();
    const interval = setInterval(checkDisabledState, 1000);
    return () => clearInterval(interval);
  }, []);

  // If still loading, return a loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <p className="mb-4">Loading...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
        </div>
      </div>
    );
  }

  // If already authenticated, don't show the login form
  if (isAuthenticated) {
    return null;
  }

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
                className="w-full h-10 px-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg"
                required
                disabled={isLoading}
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block mb-2">username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-10 px-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg"
                  required
                  disabled={isLoading}
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
                  className="w-full h-10 px-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg"
                  required
                  disabled={isLoading}
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
                  className="w-full h-10 px-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg"
                  required
                  disabled={isLoading}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full h-10 px-3 border border-outline hover:opacity-80 transition-opacity rounded-lg ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900 dark:border-white mr-2"></div>
                  {mode === 'magic' ? (otpSent ? 'verifying...' : 'sending...') : 'processing...'}
                </div>
              ) : (
                mode === 'magic' ? (otpSent ? 'verify code' : 'send magic link') : mode === 'signup' ? 'create account' : 'sign in'
              )}
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
                disabled={isLoading}
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
                disabled={isLoading}
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
