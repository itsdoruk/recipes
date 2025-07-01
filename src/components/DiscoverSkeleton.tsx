import Skeleton from './Skeleton';

export default function DiscoverSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 rounded-2xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <Skeleton width={120} height={32} />
        </div>
        
        {/* Preference Selection Cards */}
        <div className="space-y-4">
          <Skeleton width={300} height={24} className="mx-auto" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 justify-center">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton width="100%" height={120} className="rounded-xl" />
                <Skeleton width="80%" height={16} className="mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 