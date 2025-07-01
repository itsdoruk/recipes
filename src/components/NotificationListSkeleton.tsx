import Skeleton from './Skeleton';

export default function NotificationListSkeleton() {
  return (
    <div className="w-80 max-h-96 overflow-y-auto border border-outline rounded-xl shadow-lg" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <div className="p-4 border-b border-outline">
        <Skeleton width={100} height={20} />
      </div>
      
      <div className="divide-y divide-outline">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4">
            <div className="flex items-start gap-3">
              <Skeleton width={32} height={32} className="rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <Skeleton width={`${70 + Math.random() * 20}%`} height={16} className="mb-2" />
                <Skeleton width={`${40 + Math.random() * 30}%`} height={12} />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="p-4 border-t border-outline">
        <Skeleton width="100%" height={32} className="rounded-lg" />
      </div>
    </div>
  );
} 