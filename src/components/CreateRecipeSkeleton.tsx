import Skeleton from './Skeleton';

export default function CreateRecipeSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="rounded-2xl p-8 bg-[var(--background)] text-[var(--foreground)]">
        <div className="space-y-8">
          {/* Header */}
          <Skeleton width={200} height={32} />
          
          {/* Image Upload Section */}
          <div className="space-y-4">
            <Skeleton width={60} height={20} />
            <div className="space-y-4">
              <div className="flex gap-4">
                <Skeleton width={120} height={40} className="rounded-xl" />
                <Skeleton width="100%" height={40} className="rounded-xl" />
              </div>
              <Skeleton width="100%" height={192} className="rounded-xl" />
            </div>
          </div>
          
          {/* Title */}
          <div className="space-y-2">
            <Skeleton width={60} height={20} />
            <Skeleton width="100%" height={48} className="rounded-xl" />
          </div>
          
          {/* Description */}
          <div className="space-y-2">
            <Skeleton width={100} height={20} />
            <Skeleton width="100%" height={72} className="rounded-xl" />
          </div>
          
          {/* Cuisine & Diet Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Skeleton width={100} height={20} />
              <Skeleton width="100%" height={48} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton width={80} height={20} />
              <Skeleton width="100%" height={48} className="rounded-xl" />
            </div>
          </div>
          
          {/* Cooking Time Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton width={100} height={20} />
              <Skeleton width="100%" height={48} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton width={40} height={20} />
              <Skeleton width="100%" height={48} className="rounded-xl" />
            </div>
          </div>
          
          {/* Ingredients */}
          <div className="space-y-2">
            <Skeleton width={120} height={20} />
            <Skeleton width="100%" height={96} className="rounded-xl" />
          </div>
          
          {/* Instructions */}
          <div className="space-y-2">
            <Skeleton width={120} height={20} />
            <Skeleton width="100%" height={96} className="rounded-xl" />
          </div>
          
          {/* Nutrition Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton width={80} height={20} />
                <Skeleton width="100%" height={48} className="rounded-xl" />
              </div>
            ))}
          </div>
          
          {/* Submit Button */}
          <div className="flex justify-end">
            <Skeleton width={140} height={48} className="rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
} 