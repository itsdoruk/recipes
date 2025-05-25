import { useProfile } from '@/hooks/useProfile';
import { useEffect, useRef } from 'react';

interface RefreshWarningsProps {
  triggerRefresh?: boolean;
  minRefreshInterval?: number; // Minimum time between refreshes in ms
}

export default function RefreshWarnings({ 
  triggerRefresh = false,
  minRefreshInterval = 10000 // Increased to 10 seconds between refreshes
}: RefreshWarningsProps) {
  const { refreshProfile } = useProfile();
  const lastRefreshRef = useRef<number>(0);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  // Refresh the profile data when the component mounts or triggerRefresh changes
  useEffect(() => {
    if (!triggerRefresh) return;

    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshRef.current;
    
    // If it's been less than minRefreshInterval since the last refresh,
    // schedule a refresh for later
    if (timeSinceLastRefresh < minRefreshInterval) {
      const timeToWait = minRefreshInterval - timeSinceLastRefresh;
      
      // Clear any existing timeout
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      
      // Schedule new refresh
      refreshTimeoutRef.current = setTimeout(() => {
        refreshProfile();
        lastRefreshRef.current = Date.now();
      }, timeToWait);
      
      return;
    }
    
    // Otherwise refresh immediately
    refreshProfile();
    lastRefreshRef.current = now;
  }, [triggerRefresh, refreshProfile, minRefreshInterval]);
  
  // This component doesn't render anything
  return null;
} 