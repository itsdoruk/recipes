import { User } from '@supabase/supabase-js';
import { useTranslation } from '@/lib/hooks/useTranslation';

interface AvatarProps {
  user: User;
}

export function Avatar({ user }: AvatarProps) {
  const { t } = useTranslation();

  return (
    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {user.email?.[0]?.toUpperCase() || t('common.anonymous')}
      </span>
    </div>
  );
} 