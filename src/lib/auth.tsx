'use client'

import { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getBrowserClient } from './supabase/browserClient';
import { useRouter } from 'next/router';

interface BanInfo {
  banned: boolean;
  banType: 'temporary' | 'permanent' | 'warning' | null;
  banReason: string | null;
  banExpiry: Date | null;
  banCount: number;
  lastBanDate: Date | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  banInfo: BanInfo;
  warnings: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [banInfo, setBanInfo] = useState<BanInfo>({
    banned: false,
    banType: null,
    banReason: null,
    banExpiry: null,
    banCount: 0,
    lastBanDate: null
  });
  const [warnings, setWarnings] = useState<number>(0);
  const router = useRouter();

  // Helper function to check ban status
  const checkBanStatus = async (userId: string) => {
    const supabase = getBrowserClient();
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('banned, ban_type, ban_reason, ban_expiry, ban_count, last_ban_date')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error checking ban status:', error);
        return false;
      }

      if (!profile) return false;

      // Check if user is banned and if ban has not expired
      const isBanned = profile.banned && 
        (!profile.ban_expiry || new Date(profile.ban_expiry) > new Date());

      // Update ban info state
      setBanInfo({
        banned: isBanned,
        banType: profile.ban_type as 'temporary' | 'permanent' | 'warning' | null,
        banReason: profile.ban_reason,
        banExpiry: profile.ban_expiry ? new Date(profile.ban_expiry) : null,
        banCount: profile.ban_count || 0,
        lastBanDate: profile.last_ban_date ? new Date(profile.last_ban_date) : null
      });
      
      // If banned, force redirect to banned page
      if (isBanned && router.pathname !== '/banned') {
        router.replace('/banned');
        return true;
      }

      // If ban has expired, update the profile
      if (profile.banned && profile.ban_expiry && new Date(profile.ban_expiry) < new Date()) {
        await supabase
          .from('profiles')
          .update({
            banned: false,
            ban_type: null,
            ban_reason: null,
            ban_expiry: null
          })
          .eq('user_id', userId);
      }

      return isBanned;
    } catch (error) {
      console.error('Error in checkBanStatus:', error);
      return false;
    }
  };

  // Helper function to create profile
  const createProfile = async (userId: string, username: string) => {
    const supabase = getBrowserClient();
    try {
      const { error } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          username,
          banned: false,
          ban_type: null,
          ban_reason: null,
          ban_expiry: null,
          ban_count: 0,
          last_ban_date: null,
          warnings: 0
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error creating profile:', error);
      return false;
    }
  };

  useEffect(() => {
    const supabase = getBrowserClient();

    // Get initial user and session
    const initializeAuth = async () => {
      try {
        // First try to get the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting session:', sessionError);
          setLoading(false);
          return;
        }

        // If we have a session, get the user
        if (session) {
          setUser(session.user);
          
          // Check ban status if we have a user
          const isBanned = await checkBanStatus(session.user.id);
          if (isBanned) {
            router.replace('/banned');
          }
        } else {
          // If no session, check if we have a stored session in localStorage
          const storedSession = localStorage.getItem('supabase.auth.token');
          if (storedSession) {
            try {
              // Try to recover the session
              const { data: { session: recoveredSession }, error: recoverError } = await supabase.auth.setSession({
                access_token: JSON.parse(storedSession).access_token,
                refresh_token: JSON.parse(storedSession).refresh_token
              });

              if (recoverError) {
                console.error('Error recovering session:', recoverError);
                // Clear invalid stored session
                localStorage.removeItem('supabase.auth.token');
              } else if (recoveredSession) {
                setUser(recoveredSession.user);
                const isBanned = await checkBanStatus(recoveredSession.user.id);
                if (isBanned) {
                  router.replace('/banned');
                }
              }
            } catch (error) {
              console.error('Error parsing stored session:', error);
              localStorage.removeItem('supabase.auth.token');
            }
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes with error handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      try {
        setUser(session?.user ?? null);
        
        // Only handle redirects for specific auth events
        if (event === 'SIGNED_IN' && session) {
          // Store session in localStorage when signing in
          localStorage.setItem('supabase.auth.token', JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token
          }));
          // Only redirect if we're on the login page
          if (router.pathname === '/login') {
            router.push('/');
          }
        } else if (event === 'SIGNED_OUT') {
          // Clear stored session on sign out, but avoid auto-redirect on focus
          localStorage.removeItem('supabase.auth.token');
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // Update stored session on token refresh
          localStorage.setItem('supabase.auth.token', JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token
          }));
          // Check ban status on token refresh
          const isBanned = await checkBanStatus(session.user.id);
          if (isBanned) {
            router.replace('/banned');
          }
        }
      } catch (error) {
        console.error('Error handling auth state change:', error);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // Add a more frequent ban status check with error handling
  useEffect(() => {
    if (!user) return;

    let checkInterval: NodeJS.Timeout | null = null;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    const setupBanCheck = async () => {
      try {
        // Check ban status immediately
        await checkBanStatus(user.id);

        // Then check every 10 seconds
        checkInterval = setInterval(async () => {
          try {
            const isBanned = await checkBanStatus(user.id);
            if (isBanned) {
              router.replace('/banned');
            }
            // Reset retry count on successful check
            retryCount = 0;
          } catch (error) {
            console.error('Error in periodic ban check:', error);
            retryCount++;
            
            // If we've exceeded max retries, clear the interval
            if (retryCount >= MAX_RETRIES) {
              if (checkInterval) {
                clearInterval(checkInterval);
                checkInterval = null;
              }
              // Try to re-establish the check after a longer delay
              setTimeout(setupBanCheck, 30000);
            }
          }
        }, 10000);
      } catch (error) {
        console.error('Error in initial ban check:', error);
        // Retry after 5 seconds
        setTimeout(setupBanCheck, 5000);
      }
    };

    setupBanCheck();

    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [user, router]);

  // Add ban check on route change with error handling
  useEffect(() => {
    if (!user) return;

    const handleRouteChange = async () => {
      try {
        const isBanned = await checkBanStatus(user.id);
        if (isBanned) {
          router.replace('/banned');
        }
      } catch (error) {
        console.error('Error checking ban status on route change:', error);
        // If the check fails, we'll still allow the route change
        // The middleware will catch any ban status on the server side
      }
    };

    router.events.on('routeChangeStart', handleRouteChange);
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [user, router]);

  useEffect(() => {
    // Ensure every authenticated user has a profile
    const ensureProfile = async () => {
      if (!user) return;
      setProfileLoading(true);
      try {
        const supabase = getBrowserClient();
        const { data: existingProfile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          return;
        }

        if (existingProfile) {
          // Check if user is banned and if ban has expired
          const isBanned = existingProfile.banned && 
            (!existingProfile.ban_expiry || new Date(existingProfile.ban_expiry) > new Date());
          
          setBanInfo({
            banned: isBanned,
            banType: existingProfile.ban_type as 'temporary' | 'permanent' | 'warning' | null,
            banReason: existingProfile.ban_reason,
            banExpiry: existingProfile.ban_expiry ? new Date(existingProfile.ban_expiry) : null,
            banCount: existingProfile.ban_count || 0,
            lastBanDate: existingProfile.last_ban_date ? new Date(existingProfile.last_ban_date) : null
          });
          setWarnings(existingProfile.warnings || 0);
          
          if (isBanned && router.pathname !== '/banned') {
            router.push('/banned');
          }
        } else {
          // Use email prefix as default username
          const emailPrefix = user.email ? user.email.split('@')[0] : 'user';
          const success = await createProfile(user.id, emailPrefix);
          if (!success) {
            console.error('Failed to create profile after multiple attempts');
          }
        }
      } catch (error) {
        console.error('Error checking/creating profile:', error);
      } finally {
        setProfileLoading(false);
      }
    };
    ensureProfile();
  }, [user, router]);

  const signIn = async (email: string, password: string) => {
    const supabase = getBrowserClient();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      // Check ban status immediately after sign in
      if (data.user) {
        const isBanned = await checkBanStatus(data.user.id);
        if (isBanned) {
          router.push('/banned');
        }
      }
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, username: string) => {
    const supabase = getBrowserClient();
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      
      if (data.user) {
        const success = await createProfile(data.user.id, username);
        if (!success) {
          throw new Error('Failed to create profile');
        }
      }
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  };

  const signInWithOtp = async (email: string) => {
    const supabase = getBrowserClient();
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
    } catch (error) {
      console.error('Error signing in with OTP:', error);
      throw error;
    }
  };

  const verifyOtp = async (email: string, token: string) => {
    const supabase = getBrowserClient();
    try {
      const { data: { user }, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email'
      });
      if (error) throw error;
      
      // Create a profile if one doesn't exist
      if (user) {
        setProfileLoading(true);
        try {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('user_id', user.id)
            .single();

          if (!existingProfile) {
            const username = email.split('@')[0]; // Use part of email as username
            const success = await createProfile(user.id, username);
            if (!success) {
              throw new Error('Failed to create profile after multiple attempts');
            }
          }

          // Check ban status after OTP verification
          const isBanned = await checkBanStatus(user.id);
          if (isBanned) {
            router.push('/banned');
          }
        } finally {
          setProfileLoading(false);
        }
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      throw error;
    }
  };

  const signOut = async () => {
    const supabase = getBrowserClient();
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, signInWithOtp, verifyOtp, banInfo, warnings }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};