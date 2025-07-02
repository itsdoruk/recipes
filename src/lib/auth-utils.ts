import { createServerClient } from '@supabase/ssr';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import { CookieOptions } from '@supabase/ssr';
import { getSupabaseClient } from './supabase';

export type AuthUser = {
  id: string;
  email?: string;
  role?: string;
};

export type Session = {
  user: AuthUser | null;
  error?: Error;
};

// Helper function to parse auth cookies
const parseAuthCookie = (cookie: string | undefined): any => {
  if (!cookie) return null;
  
  try {
    // Handle base64-encoded cookies
    if (cookie.startsWith('base64-')) {
      const base64Data = cookie.substring(7); // Remove 'base64-' prefix
      const decodedData = Buffer.from(base64Data, 'base64').toString('utf-8');
      let parsed;
      try {
        parsed = JSON.parse(decodedData);
      } catch (e) {
        console.error('Failed to parse decoded base64 data as JSON:', e, decodedData);
        parsed = null;
      }
      return parsed;
    }
    
    // Handle regular JSON cookies
    let parsed2;
    try {
      parsed2 = JSON.parse(cookie);
    } catch (e) {
      console.error('Failed to parse cookie as JSON:', e, cookie);
      parsed2 = null;
    }
    return parsed2;
  } catch (error) {
    console.error('Error parsing auth cookie:', error);
    return null;
  }
};

export async function getSession(cookies?: { get: (name: string) => string | undefined }): Promise<Session> {
  try {
    if (!cookies) {
      return { user: null };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const cookieName = `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;
    const authCookie = cookies.get(cookieName);

    if (!authCookie) {
      return { user: null };
    }

    const parsedCookie = parseAuthCookie(authCookie);
    if (!parsedCookie?.user?.id) {
      return { user: null };
    }

    // Verify the session is still valid
    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get: (name) => cookies.get(name),
        set: () => {},
        remove: () => {}
      }
    });

    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.error('Error verifying session:', error);
      return { user: null, error: error as Error };
    }

    return { user: session.user };
  } catch (error) {
    console.error('Error getting session:', error);
    return { user: null, error: error as Error };
  }
}

export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get: () => undefined,
        set: () => {},
        remove: () => {}
      }
    });

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }

    return profile?.is_admin || false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

export async function ensureProfile(userId: string): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get: () => undefined,
        set: () => {},
        remove: () => {}
      }
    });

    // First check if user is verified
    const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError) throw authError;
    
    if (!user?.email_confirmed_at) {
      throw new Error('User email not verified');
    }

    // Check if profile exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    // If profile doesn't exist, create it
    if (!existingProfile) {
      const { error: createError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          username: `user_${userId.slice(0, 8)}`,
          is_private: false,
          show_email: false,
          banned: false,
          ban_count: 0,
          warnings: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          dietary_restrictions: [],
          cooking_skill_level: null
        });

      if (createError) {
        throw createError;
      }
    }
  } catch (error) {
    console.error('Error ensuring profile:', error);
    throw error;
  }
}

// Update these constants for better rate limit handling
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000; // 2 seconds
const MAX_RETRY_DELAY = 60000; // 1 minute
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minute window
const MAX_ATTEMPTS_PER_WINDOW = 5;

// Add this helper function before the signIn function
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getRetryDelay = (attempt: number): number => {
  const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attempt), MAX_RETRY_DELAY);
  return delay + Math.random() * 2000; // Add more jitter
};

// Add this function to track rate limit attempts
const getRateLimitKey = (email: string) => `rate_limit_${email}`;

const checkRateLimit = (email: string): boolean => {
  const key = getRateLimitKey(email);
  let attempts;
  try {
    attempts = JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) {
    console.error('Failed to parse localStorage attempts as JSON:', e, localStorage.getItem(key));
    attempts = [];
  }
  const now = Date.now();
  
  // Remove attempts older than the rate limit window
  const recentAttempts = attempts.filter((timestamp: number) => now - timestamp < RATE_LIMIT_WINDOW);
  
  // Store updated attempts
  localStorage.setItem(key, JSON.stringify(recentAttempts));
  
  // Check if we've hit the rate limit
  return recentAttempts.length >= MAX_ATTEMPTS_PER_WINDOW;
};

const recordRateLimitAttempt = (email: string) => {
  const key = getRateLimitKey(email);
  const attempts = JSON.parse(localStorage.getItem(key) || '[]');
  attempts.push(Date.now());
  localStorage.setItem(key, JSON.stringify(attempts));
};

export const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
  let retryCount = 0;
  let retryDelay = INITIAL_RETRY_DELAY;

  while (retryCount < MAX_RETRIES) {
    try {
      const supabase = getSupabaseClient();
      
      // Sign in with password
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Too many login attempts') || error.message.includes('rate limit')) {
          console.warn(`[Auth Debug] Rate limited, attempt ${retryCount + 1}/${MAX_RETRIES}`);
          
          // Wait with exponential backoff
          await sleep(retryDelay);
          retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
          retryCount++;
          continue;
        }
        console.error('Error signing in:', error);
        return { error };
      }

      // Success - reset retry count and delay
      retryCount = 0;
      retryDelay = INITIAL_RETRY_DELAY;

      if (!data.session) {
        console.error('No session returned after sign in');
        return { error: new Error('No session returned after sign in') };
      }

      // Ensure the session is persisted
      const { error: persistError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (persistError) {
        console.error('Error persisting session:', persistError);
        return { error: persistError };
      }

      // Add a delay to ensure the session is properly set
      await sleep(1000);

      // Verify the session with retries
      let session = null;
      let verifyError = null;
      let verifyRetryCount = 0;

      while (verifyRetryCount < MAX_RETRIES) {
        const { data: { session: currentSession }, error: currentError } = await supabase.auth.getSession();
        
        if (currentError) {
          verifyError = currentError;
          verifyRetryCount++;
          await sleep(getRetryDelay(verifyRetryCount));
          continue;
        }

        if (currentSession) {
          session = currentSession;
          break;
        }

        verifyRetryCount++;
        await sleep(getRetryDelay(verifyRetryCount));
      }

      if (!session) {
        console.error('Failed to verify session after retries:', verifyError);
        return { error: verifyError || new Error('Failed to verify session') };
      }

      return { error: null };
    } catch (error) {
      console.error('[Auth Debug] Sign in error:', error);
      return { error: error as Error };
    }
  }

  return { 
    error: new Error('Too many login attempts. Please wait a few minutes before trying again.') 
  };
};

export async function signUp(email: string, password: string, username: string): Promise<{ error: Error | null }> {
  try {
    const supabase = getSupabaseClient();
    
    // Sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`
      },
    });

    if (error) {
      console.error('Error signing up:', error);
      return { error };
    }

    if (!data.user) {
      console.error('No user returned after sign up');
      return { error: new Error('No user returned after sign up') };
    }

    // Don't create profile immediately - wait for email verification
    // The profile will be created when the user verifies their email
    // and visits the site for the first time

    console.log('Successfully signed up user:', data.user.id);
    return { error: null };
  } catch (error) {
    console.error('Error in signUp:', error);
    return { error: error as Error };
  }
}

export async function signInWithOtp(email: string): Promise<{ error: Error | null }> {
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error('Error sending magic link:', error);
      return { error };
    }

    console.log('Magic link sent to:', email);
    return { error: null };
  } catch (error) {
    console.error('Error in signInWithOtp:', error);
    return { error: error as Error };
  }
}

export async function verifyOtp(email: string, token: string): Promise<{ error: Error | null }> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error) {
      console.error('Error verifying OTP:', error);
      return { error };
    }

    if (!data.session) {
      console.error('No session returned after OTP verification');
      return { error: new Error('No session returned after OTP verification') };
    }

    // Ensure the session is persisted
    const { error: persistError } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });

    if (persistError) {
      console.error('Error persisting session:', persistError);
      return { error: persistError };
    }

    console.log('Successfully verified OTP for user:', data.session.user.id);
    return { error: null };
  } catch (error) {
    console.error('Error in verifyOtp:', error);
    return { error: error as Error };
  }
}

export async function signInWithGoogle(redirectTo?: string): Promise<{ error: Error | null }> {
  try {
    const supabase = getSupabaseClient();
    
    // Debug: Log the current origin
    console.log('Current origin:', window.location.origin);
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Let Supabase handle the redirect automatically
        // This will use the default Supabase callback URL
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('Error signing in with Google:', error);
      return { error };
    }

    if (!data.url) {
      console.error('No URL returned from Google OAuth');
      return { error: new Error('No URL returned from Google OAuth') };
    }

    // Debug: Log the Google OAuth URL
    console.log('Google OAuth URL:', data.url);

    // Redirect to Google's OAuth page
    window.location.href = data.url;
    return { error: null };
  } catch (error) {
    console.error('Error in signInWithGoogle:', error);
    return { error: error as Error };
  }
}

export async function unlinkGoogleAccount(): Promise<{ error: Error | null }> {
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase.auth.unlinkIdentity({
      provider: 'google',
    });

    if (error) {
      console.error('Error unlinking Google account:', error);
      return { error };
    }

    console.log('Successfully unlinked Google account');
    return { error: null };
  } catch (error) {
    console.error('Error in unlinkGoogleAccount:', error);
    return { error: error as Error };
  }
} 

export async function signInWithGithub(redirectTo?: string): Promise<{ error: Error | null }> {
  try {
    const supabase = getSupabaseClient();
    
    // Debug: Log the current origin
    console.log('Current origin:', window.location.origin);
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        // Let Supabase handle the redirect automatically
        // This will use the default Supabase callback URL and handle PKCE properly
      },
    });
    
    if (error) {
      console.error('Error signing in with GitHub:', error);
      return { error };
    }
    
    if (!data.url) {
      console.error('No URL returned from GitHub OAuth');
      return { error: new Error('No URL returned from GitHub OAuth') };
    }
    
    // Debug: Log the GitHub OAuth URL
    console.log('GitHub OAuth URL:', data.url);
    
    // Redirect to GitHub's OAuth page
    window.location.href = data.url;
    return { error: null };
  } catch (error) {
    console.error('Error in signInWithGithub:', error);
    return { error: error as Error };
  }
} 