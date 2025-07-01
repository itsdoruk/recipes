import Skeleton from './Skeleton';

export default function RecipeCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden border border-outline bg-[var(--background)] flex flex-col shadow-md">
      <Skeleton height={180} className="w-full" />
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="flex gap-2 mb-2">
          <Skeleton width={60} height={24} />
          <Skeleton width={60} height={24} />
          <Skeleton width={60} height={24} />
        </div>
        <Skeleton width={120} height={28} className="mb-2" />
        <Skeleton width="80%" height={18} />
        <div className="flex gap-2 mt-auto pt-4">
          <Skeleton width={32} height={32} className="rounded-full" />
          <Skeleton width={32} height={32} className="rounded-full" />
          <Skeleton width={32} height={32} className="rounded-full" />
        </div>
      </div>
    </div>
  );
} 