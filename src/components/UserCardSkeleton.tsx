import Skeleton from './Skeleton';

export default function UserCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border border-outline rounded-xl bg-[var(--background)]">
      <Skeleton width={48} height={48} className="rounded-full" />
      <div className="flex-1">
        <Skeleton width={100} height={20} className="mb-2" />
        <Skeleton width={180} height={16} />
      </div>
    </div>
  );
} 