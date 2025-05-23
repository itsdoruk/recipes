import { useEffect, useState } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
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

export const useBanInfo = () => {
  const [banInfo, setBanInfo] = useState<BanInfo>({
    banned: false,
    banType: null,
    banReason: null,
    banExpiry: null,
    banCount: 0,
    lastBanDate: null
  });
  const [loading, setLoading] = useState(true);
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    const checkBanStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      const supabase = getBrowserClient();
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('banned, ban_type, ban_reason, ban_expiry, ban_count, last_ban_date')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking ban status:', error);
          setLoading(false);
          return;
        }

        if (!profile) {
          setLoading(false);
          return;
        }

        const isBanned = profile.banned && 
          (!profile.ban_expiry || new Date(profile.ban_expiry) > new Date());

        setBanInfo({
          banned: isBanned,
          banType: profile.ban_type as 'temporary' | 'permanent' | 'warning' | null,
          banReason: profile.ban_reason,
          banExpiry: profile.ban_expiry ? new Date(profile.ban_expiry) : null,
          banCount: profile.ban_count || 0,
          lastBanDate: profile.last_ban_date ? new Date(profile.last_ban_date) : null
        });

        if (isBanned && router.pathname !== '/banned') {
          router.replace('/banned');
        }

        if (profile.banned && profile.ban_expiry && new Date(profile.ban_expiry) < new Date()) {
          await supabase
            .from('profiles')
            .update({
              banned: false,
              ban_type: null,
              ban_reason: null,
              ban_expiry: null
            })
            .eq('user_id', user.id);
        }
      } catch (error) {
        console.error('Error in checkBanStatus:', error);
      } finally {
        setLoading(false);
      }
    };

    checkBanStatus();
  }, [user, router]);

  return { banInfo, loading };
}; 