import Skeleton from './Skeleton';

export default function SearchSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="space-y-8">
        {/* Search Header */}
        <Skeleton width={200} height={32} className="mb-8" />
        
        {/* Search Form */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <Skeleton width="100%" height={40} className="rounded-lg" />
            <Skeleton width={80} height={40} className="rounded-lg" />
          </div>
          <div className="flex gap-2">
            <Skeleton width="100%" height={40} className="rounded-lg" />
            <Skeleton width="100%" height={40} className="rounded-lg" />
            <Skeleton width="100%" height={40} className="rounded-lg" />
          </div>
        </div>
        
        {/* Active Filters */}
        <div className="flex flex-wrap gap-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} width={100} height={24} className="rounded-lg" />
          ))}
        </div>
        
        {/* Search Results */}
        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton width="100%" height={180} className="rounded-xl" />
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Skeleton width={60} height={24} className="rounded-full" />
                  <Skeleton width={60} height={24} className="rounded-full" />
                </div>
                <Skeleton width="70%" height={24} />
                <Skeleton width="90%" height={16} />
                <Skeleton width="60%" height={16} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 