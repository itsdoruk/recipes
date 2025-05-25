import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { User, Session } from '@supabase/supabase-js';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = getBrowserClient();

  const handleAuthError = async (error: any, retryCount = 0): Promise<boolean> => {
    console.error('[Auth] Error:', error);
    setAuthError(error.message || 'Authentication error');
    
    if (error.message?.includes('JWT') || error.message?.includes('invalid session')) {
      console.warn('[Auth] Session error detected, attempting to refresh session');
      try {
        // First try a normal refresh
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('[Auth] Normal refresh failed:', refreshError);
          // If normal refresh fails, try a force refresh
          const { data: { session: forceSession }, error: forceError } = await supabase.auth.getSession();
          if (forceError) throw forceError;
          if (forceSession) {
            console.debug('[Auth] Force refresh successful');
            setSession(forceSession);
            setUser(forceSession.user);
            setAuthError(null);
            return true;
          }
          throw refreshError;
        }
        
        if (newSession) {
          console.debug('[Auth] Session refreshed successfully');
          setSession(newSession);
          setUser(newSession.user);
          setAuthError(null);
          return true;
        }
      } catch (refreshError) {
        console.error('[Auth] Failed to refresh session:', refreshError);
        if (retryCount < MAX_RETRIES) {
          console.debug(`[Auth] Retrying refresh (${retryCount + 1}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
          return handleAuthError(error, retryCount + 1);
        } else {
          // If we've exhausted retries, force a re-login
          setAuthError('Session expired. Please log in again.');
          forceClearSupabaseAuth();
          router.push('/login');
        }
      }
    }
    
    return false;
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        setLoading(true);
        
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

  const refreshSession = async (force = false): Promise<boolean> => {
    try {
      console.debug('[Auth] Manually refreshing session', force ? '(forced)' : '');
      setAuthError(null);
      
      if (force) {
        // Force a complete session refresh by signing out and back in
        await supabase.auth.signOut();
        const { data: { session: newSession }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (newSession) {
          setSession(newSession);
          setUser(newSession.user);
          return true;
        }
        return false;
      }
      
      const { data: { session: newSession }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('[Auth] Error refreshing session:', error);
        setAuthError(error.message || 'Failed to refresh session');
        return false;
      }
      
      if (newSession) {
        console.debug('[Auth] Session refreshed successfully');
        setSession(newSession);
        setUser(newSession.user);
        return true;
      }
      
      setAuthError('No active session found');
      return false;
    } catch (error: any) {
      console.error('[Auth] Unexpected error refreshing session:', error);
      setAuthError(error.message || 'Unexpected error refreshing session');
      return false;
    }
  };

  return {
    user,
    session,
    loading,
    isAuthenticated: !!session,
    authError,
    refreshSession,
    handleAuthError,
    forceClearAuth: forceClearSupabaseAuth
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