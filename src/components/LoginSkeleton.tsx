import Skeleton from './Skeleton';

export default function LoginSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="rounded-2xl p-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <Skeleton width={120} height={32} className="mb-8" />
        
        <div className="space-y-6">
          <div>
            <Skeleton width={60} height={20} className="mb-2" />
            <Skeleton width="100%" height={40} className="rounded-lg" />
          </div>
          
          <div>
            <Skeleton width={80} height={20} className="mb-2" />
            <Skeleton width="100%" height={40} className="rounded-lg" />
          </div>
          
          <div>
            <Skeleton width={80} height={20} className="mb-2" />
            <Skeleton width="100%" height={40} className="rounded-lg" />
          </div>
          
          <Skeleton width="100%" height={40} className="rounded-lg" />
          
          <div className="flex items-center justify-center">
            <Skeleton width={200} height={20} />
          </div>
          
          <div className="flex items-center gap-4">
            <Skeleton width="100%" height={1} />
            <Skeleton width={80} height={20} />
            <Skeleton width="100%" height={1} />
          </div>
          
          <Skeleton width="100%" height={40} className="rounded-lg" />
        </div>
      </div>
    </div>
  );
} 