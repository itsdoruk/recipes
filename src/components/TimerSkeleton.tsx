import Skeleton from './Skeleton';

export default function TimerSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <Skeleton width={200} height={32} className="mx-auto" />
          <Skeleton width={300} height={24} className="mx-auto" />
        </div>
        
        {/* Timer Display */}
        <div className="text-center space-y-6">
          <div className="space-y-4">
            <Skeleton width={300} height={80} className="mx-auto rounded-xl" />
            <div className="flex justify-center gap-4">
              <Skeleton width={100} height={40} className="rounded-lg" />
              <Skeleton width={100} height={40} className="rounded-lg" />
              <Skeleton width={100} height={40} className="rounded-lg" />
            </div>
          </div>
        </div>
        
        {/* Timer Controls */}
        <div className="flex justify-center gap-4">
          <Skeleton width={120} height={48} className="rounded-lg" />
          <Skeleton width={120} height={48} className="rounded-lg" />
          <Skeleton width={120} height={48} className="rounded-lg" />
        </div>
        
        {/* Quick Timer Buttons */}
        <div className="space-y-4">
          <Skeleton width={150} height={20} className="mx-auto" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} width="100%" height={40} className="rounded-lg" />
            ))}
          </div>
        </div>
        
        {/* Recipe Section */}
        <div className="space-y-4">
          <Skeleton width={120} height={24} />
          <div className="space-y-3">
            <Skeleton width="100%" height={60} className="rounded-xl" />
            <Skeleton width="100%" height={60} className="rounded-xl" />
            <Skeleton width="100%" height={60} className="rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
} 