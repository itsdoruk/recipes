import Skeleton from './Skeleton';

export default function ProfileSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="space-y-8">
        {/* Profile Header */}
        <div className="flex items-center gap-4">
          <Skeleton width={64} height={64} className="rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton width={150} height={28} />
            <Skeleton width={200} height={16} />
            <div className="flex gap-4">
              <Skeleton width={80} height={16} />
              <Skeleton width={80} height={16} />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton width={80} height={40} className="rounded-lg" />
            <Skeleton width={40} height={40} className="rounded-lg" />
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex gap-6 text-sm">
          <Skeleton width={80} height={16} />
          <Skeleton width={80} height={16} />
        </div>
        
        {/* Tabs */}
        <div className="flex gap-4 pt-8 border-t border-outline">
          <Skeleton width={80} height={24} />
          <Skeleton width={80} height={24} />
        </div>
        
        {/* Content */}
        <div className="pt-6 border-t border-outline">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton width="100%" height={180} className="rounded-xl" />
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Skeleton width={60} height={24} className="rounded-full" />
                    <Skeleton width={60} height={24} className="rounded-full" />
                  </div>
                  <Skeleton width="70%" height={24} />
                  <Skeleton width="90%" height={16} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 