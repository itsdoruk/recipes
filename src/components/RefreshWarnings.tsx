import { useProfile } from '@/hooks/useProfile';
import { useEffect, useState } from 'react';

interface RefreshWarningsProps {
  triggerRefresh?: boolean;
}

export default function RefreshWarnings({ triggerRefresh = false }: RefreshWarningsProps) {
  const { refreshProfile } = useProfile();
  const [lastRefresh, setLastRefresh] = useState<number>(0);
  
  // Refresh the profile data when the component mounts or triggerRefresh changes
  useEffect(() => {
    if (triggerRefresh || lastRefresh === 0) {
      const refreshData = async () => {
        console.log('Refreshing profile data for warnings...');
        await refreshProfile();
        setLastRefresh(Date.now());
      };
      
      refreshData();
    }
  }, [triggerRefresh, refreshProfile, lastRefresh]);
  
  // This component doesn't render anything
  return null;
} 