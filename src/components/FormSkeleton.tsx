import Skeleton from './Skeleton';

export default function FormSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="rounded-2xl p-8 bg-[var(--background)] text-[var(--foreground)]">
        <Skeleton width={150} height={32} className="mb-8" />
        
        <div className="space-y-6">
          {/* Image Upload */}
          <div className="space-y-4">
            <Skeleton width={60} height={20} />
            <div className="flex flex-col items-center gap-4">
              <Skeleton width={128} height={128} className="rounded-xl" />
              <Skeleton width="100%" height={40} className="rounded-xl" />
            </div>
          </div>
          
          {/* Title */}
          <div>
            <Skeleton width={60} height={20} className="mb-2" />
            <Skeleton width="100%" height={48} className="rounded-xl" />
          </div>
          
          {/* Description */}
          <div>
            <Skeleton width={80} height={20} className="mb-2" />
            <Skeleton width="100%" height={80} className="rounded-xl" />
          </div>
          
          {/* Grid Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Skeleton width={60} height={20} className="mb-2" />
              <Skeleton width="100%" height={48} className="rounded-xl" />
            </div>
            <div>
              <Skeleton width={80} height={20} className="mb-2" />
              <Skeleton width="100%" height={48} className="rounded-xl" />
            </div>
            <div>
              <Skeleton width={70} height={20} className="mb-2" />
              <Skeleton width="100%" height={48} className="rounded-xl" />
            </div>
            <div>
              <Skeleton width={90} height={20} className="mb-2" />
              <Skeleton width="100%" height={48} className="rounded-xl" />
            </div>
          </div>
          
          {/* Nutrition Section */}
          <div className="space-y-4">
            <Skeleton width={100} height={24} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i}>
                  <Skeleton width={60} height={16} className="mb-2" />
                  <Skeleton width="100%" height={40} className="rounded-xl" />
                </div>
              ))}
            </div>
          </div>
          
          {/* Ingredients */}
          <div className="space-y-4">
            <Skeleton width={100} height={24} />
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} width="100%" height={40} className="rounded-xl" />
              ))}
            </div>
            <Skeleton width={120} height={40} className="rounded-xl" />
          </div>
          
          {/* Instructions */}
          <div className="space-y-4">
            <Skeleton width={100} height={24} />
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} width="100%" height={60} className="rounded-xl" />
              ))}
            </div>
            <Skeleton width={120} height={40} className="rounded-xl" />
          </div>
          
          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <Skeleton width={120} height={48} className="rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
} 