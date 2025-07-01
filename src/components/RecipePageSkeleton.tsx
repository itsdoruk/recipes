import Skeleton from './Skeleton';

export default function RecipePageSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="space-y-8">
        {/* Image */}
        <Skeleton width="100%" height={300} className="rounded-xl" />
        
        {/* Title and basic info */}
        <div className="space-y-4">
          <Skeleton width="80%" height={32} />
          <div className="flex gap-2">
            <Skeleton width={80} height={24} className="rounded-full" />
            <Skeleton width={80} height={24} className="rounded-full" />
            <Skeleton width={80} height={24} className="rounded-full" />
          </div>
        </div>
        
        {/* Description */}
        <div className="space-y-2">
          <Skeleton width={100} height={20} />
          <Skeleton width="100%" height={16} />
          <Skeleton width="90%" height={16} />
          <Skeleton width="70%" height={16} />
        </div>
        
        {/* Ingredients */}
        <div className="space-y-4">
          <Skeleton width={120} height={24} />
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton width={4} height={4} className="rounded-full" />
                <Skeleton width={`${60 + Math.random() * 30}%`} height={16} />
              </div>
            ))}
          </div>
        </div>
        
        {/* Instructions */}
        <div className="space-y-4">
          <Skeleton width={120} height={24} />
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton width={24} height={24} className="rounded-full" />
                <Skeleton width={`${70 + Math.random() * 20}%`} height={16} />
              </div>
            ))}
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-4">
          <Skeleton width={40} height={40} className="rounded-lg" />
          <Skeleton width={40} height={40} className="rounded-lg" />
          <Skeleton width={40} height={40} className="rounded-lg" />
        </div>
      </div>
    </div>
  );
} 