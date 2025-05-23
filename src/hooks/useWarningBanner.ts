import { useState, useEffect } from 'react';
import { useProfile } from './useProfile';

export function useWarningBanner() {
  const { profile } = useProfile();
  const warnings = profile?.warnings ?? 0;
  const [isDismissed, setIsDismissed] = useState(false);

  // Load dismissed state from localStorage on mount
  useEffect(() => {
    const storedDismissed = localStorage.getItem('warningBannerDismissed');
    if (storedDismissed) {
      setIsDismissed(true);
    }
  }, []);

  // Reset dismissed state when warning count changes
  useEffect(() => {
    if (warnings > 0) {
      const storedWarningCount = localStorage.getItem('warningCount');
      // If warning count changed, show banner again
      if (storedWarningCount && parseInt(storedWarningCount, 10) !== warnings) {
        setIsDismissed(false);
        localStorage.removeItem('warningBannerDismissed');
      }
      // Store current warning count
      localStorage.setItem('warningCount', warnings.toString());
    }
  }, [warnings]);

  const dismissBanner = () => {
    setIsDismissed(true);
    localStorage.setItem('warningBannerDismissed', 'true');
  };

  return {
    warnings,
    isDismissed,
    dismissBanner,
    shouldShowBanner: warnings > 0 && !isDismissed
  };
} 