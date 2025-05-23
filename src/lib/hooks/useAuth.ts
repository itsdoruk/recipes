import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { User, Session } from '@supabase/supabase-js';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = getBrowserClient();

  const handleAuthError = async (error: any, retryCount = 0): Promise<boolean> => {
    console.error('[Auth] Error:', error);
    
    // Handle JWT errors
    if (error.message?.includes('JWT')) {
      console.warn('[Auth] JWT error detected, attempting to refresh session');
      try {
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;
        if (newSession) {
          console.debug('[Auth] Session refreshed successfully');
          setSession(newSession);
          setUser(newSession.user);
          return true;
        }
      } catch (refreshError) {
        console.error('[Auth] Failed to refresh session:', refreshError);
        if (retryCount < MAX_RETRIES) {
          console.debug(`[Auth] Retrying refresh (${retryCount + 1}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
          return handleAuthError(error, retryCount + 1);
        }
      }
    }
    
    return false;
  };

  const handleSessionChange = async (event: string, currentSession: Session | null, isMounted: boolean) => {
    console.debug('[Auth] Session change:', event);
    
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      if (currentSession) {
        // Validate session expiration
        const expiresAt = currentSession.expires_at;
        const now = Math.floor(Date.now() / 1000);
        
        if (expiresAt && expiresAt < now) {
          console.warn('[Auth] Session expired, attempting refresh');
          const { data: { session: newSession }, error } = await supabase.auth.refreshSession();
          if (error) {
            console.error('[Auth] Failed to refresh expired session:', error);
            await supabase.auth.signOut();
            if (isMounted && router.pathname !== '/login') {
              router.push('/login');
            }
            return;
          }
          if (newSession) {
            setSession(newSession);
            setUser(newSession.user);
            return;
          }
        }
        
        setSession(currentSession);
        setUser(currentSession.user);
      }
    } else if (event === 'SIGNED_OUT') {
      setSession(null);
      setUser(null);
      if (isMounted && router.pathname !== '/login') {
        router.push('/login');
      }
    }
  };

  const refreshSession = async (): Promise<boolean> => {
    try {
      console.debug('[Auth] Manually refreshing session');
      const { data: { session: newSession }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('[Auth] Error refreshing session:', error);
        return false;
      }
      
      if (newSession) {
        console.debug('[Auth] Session refreshed successfully');
        setSession(newSession);
        setUser(newSession.user);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[Auth] Unexpected error refreshing session:', error);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;

    // Set up initial session
    const initializeAuth = async () => {
      try {
        setLoading(true);
        
        // First try to get the current session
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[Auth] Error getting initial session:', error);
          if (mounted) {
            await handleAuthError(error);
          }
          return;
        }
        
        if (initialSession) {
          console.debug('[Auth] Initial session found');
          if (mounted) {
            setSession(initialSession);
            setUser(initialSession.user);
          }
        } else {
          console.debug('[Auth] No initial session found');
          if (mounted) {
            setSession(null);
            setUser(null);
          }
        }
      } catch (error) {
        console.error('[Auth] Unexpected error in initialization:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, currentSession: Session | null) => {
      console.debug('[Auth] Auth state changed:', event);
      
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        // Only redirect if we're not already on the login page and not in the middle of loading
        if (router.pathname !== '/login' && !loading) {
          router.push('/login');
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    session,
    loading,
    isAuthenticated: !!session,
    authError: null,
    refreshSession,
    handleAuthError
  };
};

// Utility to forcibly clear Supabase auth cookies and local/session storage
export function forceClearSupabaseAuth() {
  // Remove all cookies that start with 'sb-'
  document.cookie.split(';').forEach((c) => {
    if (c.trim().startsWith('sb-')) {
      document.cookie = c
        .replace(/^ +/, '')
        .replace(/=.*/, '=;expires=' + new Date(0).toUTCString() + ';path=/');
    }
  });

  // Remove all localStorage keys that start with 'rate_limit_'
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('rate_limit_')) {
      localStorage.removeItem(key);
    }
  });

  // Remove Supabase session tokens if present
  localStorage.removeItem('supabase.auth.token');
  sessionStorage.removeItem('supabase.auth.token');

  // Remove any other potential Supabase-related keys
  Object.keys(localStorage).forEach((key) => {
    if (key.includes('supabase')) {
      localStorage.removeItem(key);
    }
  });

  // Reload the page to ensure a clean state
  window.location.reload();
} 