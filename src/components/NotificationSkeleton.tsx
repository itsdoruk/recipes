import Skeleton from './Skeleton';

export default function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-outline last:border-b-0">
      <Skeleton width={32} height={32} className="rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <Skeleton width={140} height={16} className="mb-2" />
        <Skeleton width={80} height={12} />
      </div>
    </div>
  );
} 